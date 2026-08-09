// Shared Google Maps helpers for edge functions.
// Primary geocoding / place search / routing source. The GOOGLE_MAPS_API_KEY
// secret stays server-side (never shipped to clients). When a Google call
// returns nothing usable, callers fall back to OpenStreetMap (see osm.ts).

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface LocationSuggestion {
  address: string;
  lat: number;
  lon: number;
}

export interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
  /** GeoJSON-style decoded path [{lat, lon}, ...] when Google returns a polyline */
  polyline?: { lat: number; lon: number }[];
}

const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? Deno.env.get("VITE_GOOGLE_MAPS_API_KEY");
const GOOGLE_BASE = "https://maps.googleapis.com/maps/api";

async function googleFetch(path: string, params: Record<string, string>, timeoutMs = 8000): Promise<any> {
  if (!GOOGLE_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }
  const url = new URL(`${GOOGLE_BASE}${path}`);
  url.searchParams.set("key", GOOGLE_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Google request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Forward geocode an address. Returns null when nothing found / API denied. */
export async function googleGeocode(query: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  try {
    const data = await googleFetch("/geocode/json", {
      address: query,
      components: "country:SL",
      language: "en",
    });
    if (data.status !== "OK") return null;
    const result = data.results?.[0];
    if (!result?.geometry?.location) return null;
    return {
      lat: result.geometry.location.lat,
      lon: result.geometry.location.lng,
      displayName: result.formatted_address || query,
    };
  } catch {
    return null;
  }
}

/** Reverse geocode coordinates. Returns null when nothing found / API denied. */
export async function googleReverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const data = await googleFetch("/geocode/json", {
      latlng: `${lat},${lon}`,
      language: "en",
    });
    if (data.status !== "OK") return null;
    const result = data.results?.[0];
    if (!result?.formatted_address) return null;
    return result.formatted_address;
  } catch {
    return null;
  }
}

/** Places Autocomplete. Returns [] when nothing found / API denied. */
export async function googleSearchLocations(query: string, limit = 5): Promise<LocationSuggestion[]> {
  try {
    const data = await googleFetch("/place/autocomplete/json", {
      input: query,
      components: "country:SL",
      language: "en",
    });
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return [];
    const predictions = (data.predictions ?? []) as Array<{
      description: string;
      place_id: string;
    }>;
    const top = predictions.slice(0, limit);

    // Autocomplete only returns a description; resolve coordinates via Geocoding.
    const withCoords = await Promise.all(
      top.map(async (p) => {
        const coords = await googleGeocode(p.description);
        return coords
          ? { address: p.description, lat: coords.lat, lon: coords.lon }
          : null;
      }),
    );
    return withCoords.filter((x): x is LocationSuggestion => x !== null);
  } catch {
    return [];
  }
}

/**
 * Driving directions. Returns null when routing fails / API denied, so callers
 * can fall back to OSRM or straight-line estimation.
 */
export async function googleDirections(
  origin: GeoPoint,
  destination: GeoPoint,
): Promise<RouteInfo | null> {
  try {
    const data = await googleFetch("/directions/json", {
      origin: `${origin.lat},${origin.lon}`,
      destination: `${destination.lat},${destination.lon}`,
      mode: "driving",
      language: "en",
    });
    if (data.status !== "OK") return null;
    const route = data.routes?.[0];
    const leg = route?.legs?.[0];
    if (!route || !leg?.distance?.value) return null;

    let polyline: { lat: number; lon: number }[] | undefined;
    if (Array.isArray(route.overview_polyline?.points)) {
      polyline = route.overview_polyline.points;
    } else if (Array.isArray(route.legs?.[0]?.steps)) {
      // Walk the steps' end_location for a coarse path when no full polyline.
      polyline = route.legs[0].steps.map((s: any) => s.end_location).map((l: any) => ({
        lat: l.lat,
        lon: l.lng,
      }));
    }

    return {
      distanceKm: leg.distance.value / 1000,
      durationMinutes: Math.round(leg.duration.value / 60),
      polyline,
    };
  } catch {
    return null;
  }
}