import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { geocodeAddress } from "../_shared/osm.ts";
import { googleGeocode } from "../_shared/google.ts";

const bodySchema = z.object({
  query: z.string().min(1).max(300),
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0].message }, 400);
  }

  const { query } = parsed.data;

  // Prefer Google Geocoding (bias to Sierra Leone). Fall back to
  // OpenStreetMap/Nominatim when Google returns nothing.
  const google = await googleGeocode(query);
  if (google) {
    return jsonResponse({ coords: { lat: google.lat, lon: google.lon }, displayName: google.displayName });
  }

  try {
    const osm = await geocodeAddress(query);
    return jsonResponse({ coords: { lat: osm.lat, lon: osm.lon }, displayName: osm.displayName });
  } catch {
    return jsonResponse({ coords: null, displayName: null });
  }
});