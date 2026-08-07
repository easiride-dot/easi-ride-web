import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";

const MAPBOX_TOKEN = process.env.VITE_MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
  throw new Error("VITE_MAPBOX_ACCESS_TOKEN is not set");
}

const FREETOWN_BOUND = "-13.4000,8.3500,-13.1545,8.5800";

const schema = z.object({
  query: z.string().min(1).max(300),
});

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

async function mapboxPlaces(query: string, extra: Record<string, string>): Promise<any[]> {
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Mapbox error (${res.status})`);
    const data = await res.json();
    return Array.isArray(data?.features) ? data.features : [];
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  const contentLength = req.headers["content-length"];
  if (contentLength && parseInt(contentLength, 10) > 10240) {
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

  if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 30 }, token)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { query } = parsed.data;

  try {
    let hits = await mapboxPlaces(query, { limit: "1", bbox: FREETOWN_BOUND });
    if (hits.length === 0) {
      hits = await mapboxPlaces(query, { limit: "1", country: "sl" });
    }

    const feature = hits[0];
    if (!feature?.center) {
      return res.status(200).json({ coords: null, displayName: null });
    }

    return res.status(200).json({
      coords: { lat: feature.center[1], lon: feature.center[0] },
      displayName: feature.place_name || query,
    });
  } catch (error) {
    console.error("Geocode-location error:", error);
    return res.status(502).json({ error: "Failed to geocode location" });
  }
}