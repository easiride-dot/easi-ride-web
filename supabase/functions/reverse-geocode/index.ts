import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse, requireUser } from "../_shared/auth.ts";
import { reverseGeocode, reverseGeocodeMapbox } from "../_shared/osm.ts";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const guard = await requireUser(req);
  if (guard instanceof Response) return guard;

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

  try {
    const { lat, lon } = parsed.data;

    // Prefer Mapbox Geocoding API; fall back to Nominatim/OSM when no token.
    const mapboxResult = await reverseGeocodeMapbox(lat, lon);
    const placeName = mapboxResult ?? await reverseGeocode(lat, lon);

    return jsonResponse({ placeName });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return jsonResponse({ error: "Location name not found" }, 404);
  }
});