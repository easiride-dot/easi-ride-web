import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";
import { distanceToCampusKm } from "./_osm.js";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const schema = z.object({
  originAddress: z.string().min(3).max(250).transform(sanitize),
  campus: z.string().min(1).max(100).transform(sanitize),
  originLat: z.number().min(-90).max(90).optional(),
  originLon: z.number().min(-180).max(180).optional(),
  ride_type: z.enum(["solo", "shared"]).optional(),
  rideType: z.enum(["solo", "shared"]).optional(),
  passenger_count: z.number().int().min(1).optional(),
  passengerCount: z.number().int().min(1).optional(),
});

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
};

// Pricing engine function helper
export async function calculatePricing(distanceKm: number, rideType: "solo" | "shared", passengerCount: number, supabase: any) {
  let gross = 0;
  let commission = 0;
  let driverNet = 0;

  // Determine distance bracket
  let distanceBracket: "short" | "medium" | "long";
  if (distanceKm < 5.0) {
    distanceBracket = "short";
  } else if (distanceKm < 10.0) {
    distanceBracket = "medium";
  } else {
    distanceBracket = "long";
  }

  // Fetch pricing from database
  try {
    const { data: pricingData, error } = await supabase
      .from("pricing_config" as any)
      .select("gross_fare, commission")
      .eq("distance_bracket", distanceBracket)
      .eq("ride_type", rideType)
      .single();

    if (error || !pricingData) {
      // Fallback to hardcoded values if database fetch fails
      console.error("Error fetching pricing from database, using fallback:", error);
      return calculatePricingFallback(distanceKm, rideType, passengerCount);
    }

    gross = pricingData.gross_fare;
    commission = pricingData.commission;

    if (rideType === "shared") {
      gross = gross * passengerCount;
      commission = commission * passengerCount;
    }

    driverNet = gross - commission;
  } catch (err) {
    // Fallback to hardcoded values on any error
    console.error("Error in pricing calculation, using fallback:", err);
    return calculatePricingFallback(distanceKm, rideType, passengerCount);
  }

  return { gross, commission, driverNet };
}

// Fallback pricing function with hardcoded values
function calculatePricingFallback(distanceKm: number, rideType: "solo" | "shared", passengerCount: number) {
  let gross = 0;
  let commission = 0;
  let driverNet = 0;

  if (distanceKm < 5.0) {
    if (rideType === "solo") {
      gross = 25.0;
      commission = 5.0;
      driverNet = 20.0;
    } else {
      gross = 15.0 * passengerCount;
      commission = 3.0 * passengerCount;
      driverNet = gross - commission;
    }
  } else if (distanceKm < 10.0) {
    if (rideType === "solo") {
      gross = 55.0;
      commission = 11.0;
      driverNet = 44.0;
    } else {
      gross = 25.0 * passengerCount;
      commission = 5.0 * passengerCount;
      driverNet = gross - commission;
    }
  } else {
    if (rideType === "solo") {
      gross = 85.0;
      commission = 8.5;
      driverNet = 76.5;
    } else {
      gross = 45.0 * passengerCount;
      commission = 9.0 * passengerCount;
      driverNet = gross - commission;
    }
  }

  return { gross, commission, driverNet };
}

// ============================================================
// PLACEHOLDER: Approximate road distances (km) from known
// Freetown pickup areas to each campus.
// Fallback when OSM geocoding/routing is unavailable.
// ============================================================
const MOCK_DISTANCES: Record<string, Record<string, number>> = {
  "lumley":       { "Fourah Bay College": 14.2, "IPAM Tower Hill": 12.8, "Njala University": 182, "Limkokwing": 11.5 },
  "aberdeen":     { "Fourah Bay College": 12.1, "IPAM Tower Hill": 10.5, "Njala University": 180, "Limkokwing": 9.8  },
  "model":        { "Fourah Bay College": 11.0, "IPAM Tower Hill": 9.2,  "Njala University": 178, "Limkokwing": 8.5  },
  "wilberforce":  { "Fourah Bay College": 10.0, "IPAM Tower Hill": 5.0,  "Njala University": 176, "Limkokwing": 7.0  },
  "congo cross":  { "Fourah Bay College": 8.5,  "IPAM Tower Hill": 6.2,  "Njala University": 174, "Limkokwing": 6.0  },
  "murray town":  { "Fourah Bay College": 9.0,  "IPAM Tower Hill": 7.0,  "Njala University": 175, "Limkokwing": 7.5  },
  "kingtom":      { "Fourah Bay College": 9.5,  "IPAM Tower Hill": 6.5,  "Njala University": 175, "Limkokwing": 7.0  },
  "brookfields":  { "Fourah Bay College": 11.5, "IPAM Tower Hill": 8.5,  "Njala University": 177, "Limkokwing": 9.0  },
  "tower hill":   { "Fourah Bay College": 7.0,  "IPAM Tower Hill": 1.5,  "Njala University": 173, "Limkokwing": 5.5  },
  "central":      { "Fourah Bay College": 8.0,  "IPAM Tower Hill": 4.0,  "Njala University": 174, "Limkokwing": 6.0  },
};

const DEFAULT_DISTANCE_KM = 9; // fallback for unknown pickup areas

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
    return res.status(401).json({ error: "Authentication required" });
  }

  const getEnv = (name: string) => {
    const value = process.env[name];
    if (!value) return "";
    return value;
  };

  const supabaseUrl = process.env.SUPABASE_URL || getEnv("VITE_SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_ANON_KEY || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  // Rate limiting: max 30 requests per minute
  if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 30 }, user.id)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { originAddress, campus, originLat, originLon } = parsed.data;
  const rideType = parsed.data.rideType || parsed.data.ride_type || "solo";
  const passengerCount = parsed.data.passengerCount || parsed.data.passenger_count || 1;

  let distanceKm = 0;
  let isEstimate = false;
  let originCoords: { lat: number; lon: number } | undefined = undefined;
  let campusCoords: { lat: number; lon: number } | undefined = undefined;

  try {
    const route = await distanceToCampusKm(originAddress, campus, originLat, originLon);
    distanceKm = route.distanceKm;
    originCoords = route.origin;
    campusCoords = route.campusPoint;
  } catch (err) {
    // Log error without exposing details
    distanceKm = getMockDistance(originAddress, campus);
    isEstimate = true;
    if (originLat !== undefined && originLon !== undefined) {
      originCoords = { lat: originLat, lon: originLon };
    }
    try {
      const { getCampusCoords } = await import("./_osm.js");
      campusCoords = getCampusCoords(campus);
    } catch {
      // ignore
    }
  }

  const pricing = await calculatePricing(distanceKm, rideType, passengerCount, supabase);

  return res.status(200).json({
    distanceKm: Number(distanceKm.toFixed(1)),
    fareAmount: pricing.gross,
    commission: pricing.commission,
    driverNet: pricing.driverNet,
    isEstimate,
    originCoords,
    campusCoords,
    rideType,
    passengerCount,
  });
}
