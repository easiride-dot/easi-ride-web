import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { haversineKm, routeDistanceKm } from "../_shared/osm.ts";
import { googleDirections } from "../_shared/google.ts";

const schema = z.object({
  originLat: z.number().min(-90).max(90),
  originLon: z.number().min(-180).max(180),
  destinationLat: z.number().min(-90).max(90),
  destinationLon: z.number().min(-180).max(180),
});

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

  // Prefer Google Directions (higher quality); fall back to OSRM (OSM).
  const google = await googleDirections(origin, destination);
  if (google) {
    return jsonResponse({ ...google, polyline: google.polyline ? JSON.stringify(google.polyline) : undefined });
  }

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
});