import { z } from "npm:zod@4.3.6";
import { geocodeAddress } from "../_shared/osm.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN") ?? Deno.env.get("VITE_MAPBOX_ACCESS_TOKEN");

const FREETOWN_BOUND = "-13.4000,8.3500,-13.1545,8.5800";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const bodySchema = z.object({
  query: z.string().min(1).max(300),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0].message }, 400);
  }

  const { query } = parsed.data;

  try {
    let hits = await mapboxPlaces(query, { limit: "1", bbox: FREETOWN_BOUND });
    if (hits.length === 0) {
      hits = await mapboxPlaces(query, { limit: "1", country: "sl" });
    }

    if (hits.length > 0) {
      const feature = hits[0];
      if (feature?.center) {
        return jsonResponse({
          coords: { lat: feature.center[1], lon: feature.center[0] },
          displayName: feature.place_name || query,
        });
      }
    }

    // Mapbox found nothing (token invalid, over-restricted query, or no match
    // in Freetown). Fall back to OpenStreetMap/Nominatim forward geocoding.
    try {
      const osm = await geocodeAddress(query);
      return jsonResponse({
        coords: { lat: osm.lat, lon: osm.lon },
        displayName: osm.displayName,
      });
    } catch {
      return jsonResponse({ coords: null, displayName: null });
    }
  } catch (error) {
    console.error("Geocode-location error:", error);
    return jsonResponse({ error: "Failed to geocode location" }, 502);
  }
});