import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { reverseGeocode } from "../_shared/osm.ts";
import { googleReverseGeocode } from "../_shared/google.ts";

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

    // Prefer Google Geocoding; fall back to Nominatim/OSM when no result.
    const googlePlace = await googleReverseGeocode(lat, lon);
    const placeName = googlePlace ?? await reverseGeocode(lat, lon);

    return jsonResponse({ placeName });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return jsonResponse({ error: "Location name not found" }, 404);
  }
});