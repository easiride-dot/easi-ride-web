import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";
import { reverseGeocode } from "./_osm.js";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

export default async function handler(req: any, res: any) {
  const contentLength = req.headers["content-length"];
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
    return res.status(401).json({ error: "Missing auth token" });
  }

  const getEnv = (name: string) => {
    const value = process.env[name];
    if (!value) return "";
    return value;
  };

  const supabaseUrl = process.env.SUPABASE_URL || getEnv("VITE_SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_ANON_KEY || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase environment variables not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: "Invalid auth token" });
  }

  if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 15 }, user.id)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { lat, lon } = parsed.data;

  try {
    const placeName = await reverseGeocode(lat, lon);
    return res.status(200).json({ placeName });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return res.status(404).json({ error: "Location name not found" });
  }
}
