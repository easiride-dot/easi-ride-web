import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";
import { distanceToCampusKm } from "./_osm.js";
import { calculatePricing } from "./calculate-trip-fare.js";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const schema = z.object({
  originAddress: z.string().min(3).max(250).transform(sanitize),
  campus: z.string().min(1).max(100).transform(sanitize),
  originLat: z.number().min(-90).max(90).optional(),
  originLon: z.number().min(-180).max(180).optional(),
});

const BASE_RATE = 7;       // NLe per km
const MIN_FARE = 25;       // NLe — applied for trips under 5km
const MIN_DISTANCE_KM = 5; // threshold for minimum fare

const MOCK_DISTANCES: Record<string, Record<string, number>> = {
  "lumley": { "Fourah Bay College": 14.2, "IPAM Tower Hill": 12.8, "Njala University": 182, "Limkokwing": 11.5 },
  "aberdeen": { "Fourah Bay College": 12.1, "IPAM Tower Hill": 10.5, "Njala University": 180, "Limkokwing": 9.8 },
  "model": { "Fourah Bay College": 11.0, "IPAM Tower Hill": 9.2, "Njala University": 178, "Limkokwing": 8.5 },
  "wilberforce": { "Fourah Bay College": 10.0, "IPAM Tower Hill": 5.0, "Njala University": 176, "Limkokwing": 7.0 },
  "congo cross": { "Fourah Bay College": 8.5, "IPAM Tower Hill": 6.2, "Njala University": 174, "Limkokwing": 6.0 },
  "murray town": { "Fourah Bay College": 9.0, "IPAM Tower Hill": 7.0, "Njala University": 175, "Limkokwing": 7.5 },
  "kingtom": { "Fourah Bay College": 9.5, "IPAM Tower Hill": 6.5, "Njala University": 175, "Limkokwing": 7.0 },
  "brookfields": { "Fourah Bay College": 11.5, "IPAM Tower Hill": 8.5, "Njala University": 177, "Limkokwing": 9.0 },
  "tower hill": { "Fourah Bay College": 7.0, "IPAM Tower Hill": 1.5, "Njala University": 173, "Limkokwing": 5.5 },
  "central": { "Fourah Bay College": 8.0, "IPAM Tower Hill": 4.0, "Njala University": 174, "Limkokwing": 6.0 },
};

const DEFAULT_DISTANCE_KM = 9;

const getMockDistance = (origin: string, campus: string): number => {
  const key = origin.toLowerCase().trim();
  const exactMatch = MOCK_DISTANCES[key];
  if (exactMatch && exactMatch[campus] !== undefined) {
    return exactMatch[campus];
  }
  for (const [area, campuses] of Object.entries(MOCK_DISTANCES)) {
    if (key.includes(area) && campuses[campus] !== undefined) {
      return campuses[campus];
    }
  }
  return DEFAULT_DISTANCE_KM;
};

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
};

export default async function handler(req: any, res: any) {
  // Reject oversized payloads (> 10KB)
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > 10240) {
    return res.status(413).json({ error: "Payload too large" });
  }
  if (req.body && JSON.stringify(req.body).length > 10240) {
    return res.status(413).json({ error: "Payload too large" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getAuthToken(req.headers.authorization);
  if (!token) {
    console.error("❌ Weekly Subscription Price: Missing authorization token in request headers");
    return res.status(401).json({ error: "Missing auth token" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { originAddress, campus, originLat, originLon } = parsed.data;

  const getEnv = (name: string) => {
    const value = process.env[name];
    if (!value) return "";
    return value;
  };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Weekly Subscription Price: Supabase client variables are undefined!", { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
    return res.status(500).json({ error: "Supabase environment variables not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    console.error("❌ Weekly Subscription Price: Auth token verification failed!", {
      tokenLength: token?.length,
      userError: userError?.message || userError,
      supabaseUrl,
    });
    return res.status(401).json({ error: "Invalid auth token" });
  }

  // Rate limiting: max 30 requests per minute
  if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 30 }, user.id)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  let distanceKm = 0;
  let isEstimate = false;

  try {
    const route = await distanceToCampusKm(originAddress, campus, originLat, originLon);
    distanceKm = route.distanceKm;
    console.log(`📍 Weekly fare: ${originAddress} → ${campus}`, {
      origin: route.origin,
      campus: route.campusPoint,
      geocoded: route.geocoded,
      distanceKm: route.distanceKm,
    });
  } catch (err) {
    console.error("Weekly Subscription Distance calculation error:", err);
    distanceKm = getMockDistance(originAddress, campus);
    isEstimate = true;
  }

  const singleFare = calculatePricing(distanceKm, "solo", 1).gross;

  // Weekly plan = Single trip fare × 6
  const weeklyPrice = singleFare * 6;

  console.log(`📍 Weekly Subscription Price for ${originAddress} → ${campus}: ${weeklyPrice} NLe (Distance: ${distanceKm.toFixed(2)}km, Single: ${singleFare} NLe)`);

  return res.status(200).json({
    weeklyPrice,
    distanceKm: Number(distanceKm.toFixed(1)),
    isEstimate,
    singleFare,
    originAddress,
    campus,
  });
}
