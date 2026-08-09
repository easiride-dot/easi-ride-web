import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { searchLocations, searchLocationsMapbox } from "../_shared/osm.ts";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const schema = z.object({
  query: z.string().min(2).max(150).transform(sanitize),
});

// Public endpoint — place autocomplete needs to work for anonymous and
// logged-out visitors, so we do NOT require a JWT here (unlike most APIs).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const rawQuery = url.searchParams.get("query") ?? "";
  if (rawQuery.length > 200) {
    return jsonResponse({ error: "Search query too long" }, 400);
  }

  const parsed = schema.safeParse({ query: rawQuery });
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0].message }, 400);
  }

  try {
    // Prefer Mapbox Places for higher-quality, Freetown-biased suggestions.
    // Falls back to Nominatim/OSM when MAPBOX_ACCESS_TOKEN is not set.
    let suggestions = await searchLocationsMapbox(parsed.data.query);
    if (suggestions.length === 0) {
      suggestions = await searchLocations(parsed.data.query);
    }
    return jsonResponse({ suggestions });
  } catch (error) {
    console.error("Search API error:", error);
    return jsonResponse({ error: "Failed to search locations" }, 500);
  }
});