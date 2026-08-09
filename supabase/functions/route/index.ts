import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { haversineKm, routeDistanceKm } from "../_shared/osm.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");

const schema = z.object({
  originLat: z.number().min(-90).max(90),
  originLon: z.number().min(-180).max(180),
  destinationLat: z.number().min(-90).max(90),
  destinationLon: z.number().min(-180).max(180),
});

const OSRM_BASE = (Deno.env.get("OSRM_BASE_URL") ?? "https://router.project-osrm.org").replace(/\/$/, "");

async function routeDistanceKmMapbox(
  o: { lon: number; lat: number },
  d: { lon: number; lat: number },
): Promise<{ distanceKm: number; durationMinutes: number; polyline?: string }> {
  if (!MAPBOX_TOKEN) {
    throw new Error("MAPBOX_ACCESS_TOKEN not set");
  }
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson&steps=false&access_token=${MAPBOX_TOKEN}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`Mapbox directions error (${res.status})`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error("Mapbox routing failed");
    let polyline: string | undefined;
    if (Array.isArray(route.geometry?.coordinates)) {
      polyline = JSON.stringify(route.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lon: c[0] })));
    }
    return {
      distanceKm: (route.distance ?? 0) / 1000,
      durationMinutes: Math.round((route.duration ?? 0) / 60),
      polyline,
    };
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0].message }, 400);
  }

  const origin = { lon: parsed.data.originLon, lat: parsed.data.originLat };
  const destination = { lon: parsed.data.destinationLon, lat: parsed.data.destinationLat };

  try {
    // Prefer Mapbox Directions (higher quality); fall back to OSRM.
    const result = await routeDistanceKmMapbox(origin, destination);
    return jsonResponse(result);
  } catch {
    // OSRM fallback
    try {
      const distanceKm = await routeDistanceKm(origin, destination);
      return jsonResponse({ distanceKm, durationMinutes: Math.max(1, Math.round(distanceKm / 30 * 60)) });
    } catch {
      // Last resort: straight-line approximation.
      const straight = haversineKm(origin, destination);
      return jsonResponse({
        distanceKm: Number((straight * 1.3).toFixed(1)),
        durationMinutes: Math.max(1, Math.round((straight * 1.3) / 30 * 60)),
        estimated: true,
      });
    }
  }
});