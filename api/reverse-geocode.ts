import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit";

const schema = z.object({
  lat: z.number(),
  lon: z.number(),
});

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getAuthToken(req.headers.authorization);
  if (!token) {
    console.error("❌ Reverse Geocode: Missing authorization token");
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
    console.error("❌ Reverse Geocode: Supabase variables undefined");
    return res.status(500).json({ error: "Supabase environment variables not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    console.error("❌ Reverse Geocode: Auth token verification failed!", userError?.message || userError);
    return res.status(401).json({ error: "Invalid auth token" });
  }

  // Rate limiting: max 15 requests per minute
  if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 15 }, user.id)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { lat, lon } = parsed.data;
  const apiKey = process.env.TOMTOM_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "TomTom API key not configured on server" });
  }

  try {
    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.addresses && data.addresses.length > 0) {
      const addressObj = data.addresses[0].address;
      const placeName = addressObj.streetName || addressObj.municipalitySubdivision || addressObj.freeformAddress || "Freetown";
      return res.status(200).json({ placeName });
    } else {
      return res.status(404).json({ error: "Location name not found" });
    }
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return res.status(500).json({ error: "Failed to reverse geocode" });
  }
}
