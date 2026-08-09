// Shared OpenStreetMap / routing helpers for edge functions.
// Copy of concepts from the easi-ride/api/_osm.ts, adapted for Deno.

// ── Mapbox ─────────────────────────────────────────────────────────────────
// When MAPBOX_ACCESS_TOKEN is set the geocoding functions below use Mapbox's
// Geocoding API for higher-quality, Freetown-biased results. The OSM/Nominatim
// helpers are still exported as a fallback when no token is configured.

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");

const FREETOWN_BBOX = "-13.4000,8.3500,-13.1545,8.5800"; // left,bottom,right,top

async function mapboxPlaces(
  query: string,
  extra: Record<string, string>,
): Promise<any[]> {
  if (!MAPBOX_TOKEN) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
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

/** Search locations via Mapbox Places (returns [] when no token is set). */
export async function searchLocationsMapbox(
  query: string,
  limit = 5,
): Promise<LocationSuggestion[]> {
  if (!MAPBOX_TOKEN) return [];
  // Try Freetown bbox first, fall back to country-wide Sierra Leone
  let hits = await mapboxPlaces(query, {
    limit: String(limit),
    bbox: FREETOWN_BBOX,
  });
  if (hits.length === 0) {
    hits = await mapboxPlaces(query, { limit: String(limit), country: "sl" });
  }
  return hits
    .filter((f: any) => f?.center)
    .map((f: any) => ({
      address: f.place_name || f.text || query,
      lat: f.center[1] as number,
      lon: f.center[0] as number,
    }));
}

/** Reverse geocode via Mapbox (returns null when no token is set). */
export async function reverseGeocodeMapbox(
  lat: number,
  lon: number,
): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  const hits = await mapboxPlaces(`${lon},${lat}`, {
    limit: "1",
    types: "address,place,neighborhood",
  });
  const feature = hits[0];
  if (!feature) return null;
  return (feature.place_name || feature.text || null) as string | null;
}

// ── OpenStreetMap (Nominatim) ───────────────────────────────────────────────

export const FREETOWN_CENTER = { lat: 8.4844, lon: -13.2344 };

export const FREETOWN_VIEWBOX = {
  left: -13.4,
  top: 8.58,
  right: -13.1545,
  bottom: 8.35,
};

export const CAMPUS_COORDS: Record<string, { lat: number; lon: number }> = {
  "Fourah Bay College": { lat: 8.477917, lon: -13.221056 },
  "IPAM Tower Hill": { lat: 8.484611, lon: -13.230917 },
  Limkokwing: { lat: 8.451639, lon: -13.238417 },
};

export interface GeoPoint {
  lat: number;
  lon: number;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export interface LocationSuggestion {
  address: string;
  lat: number;
  lon: number;
}

const getNominatimBase = () =>
  (Deno.env.get("NOMINATIM_BASE_URL") ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");

const getOsrmBase = () =>
  (Deno.env.get("OSRM_BASE_URL") ?? "https://router.project-osrm.org").replace(/\/$/, "");

const getUserAgent = () =>
  Deno.env.get("NOMINATIM_USER_AGENT") ??
  "EasiRide/1.0 (student campus rides; https://easi-ride-web.vercel.app)";

async function nominatimFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${getNominatimBase()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const response = await fetch(url.toString(), {
    headers: { "User-Agent": getUserAgent(), Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }
  return response.json();
}

function formatShortAddress(item: {
  display_name?: string;
  address?: Record<string, string | undefined>;
}): string {
  const a = item.address;
  if (a) {
    const parts = [a.road, a.neighbourhood, a.suburb, a.city, a.town]
      .filter(Boolean)
      .map((s) => String(s));
    if (parts.length > 0) return [...new Set(parts)].join(", ");
  }
  return item.display_name?.split(",").slice(0, 3).join(",").trim() || "Freetown";
}

export async function geocodeAddress(query: string): Promise<GeoPoint & { displayName: string }> {
  const q = `${query}, Freetown, Sierra Leone`;
  const { left, top, right, bottom } = FREETOWN_VIEWBOX;
  const results = await nominatimFetch("/search", {
    q,
    format: "json",
    limit: "1",
    countrycodes: "sl",
    viewbox: `${left},${top},${right},${bottom}`,
    bounded: "0",
  });
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`Could not find location: ${query}`);
  }
  const hit = results[0];
  return {
    lat: parseFloat(hit.lat),
    lon: parseFloat(hit.lon),
    displayName: formatShortAddress(hit),
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const result = await nominatimFetch("/reverse", {
    lat: String(lat),
    lon: String(lon),
    format: "json",
    zoom: "18",
    addressdetails: "1",
  });
  if (!result || result.error) {
    throw new Error("Location name not found");
  }
  return formatShortAddress(result);
}

export async function searchLocations(query: string, limit = 5): Promise<LocationSuggestion[]> {
  const { left, top, right, bottom } = FREETOWN_VIEWBOX;
  const results = await nominatimFetch("/search", {
    q: `${query}, Freetown`,
    format: "json",
    limit: String(limit),
    countrycodes: "sl",
    viewbox: `${left},${top},${right},${bottom}`,
    bounded: "1",
    addressdetails: "1",
  });
  if (!Array.isArray(results)) return [];
  return results.map((item: { lat: string; lon: string; display_name?: string; address?: Record<string, string> }) => ({
    address: formatShortAddress(item),
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}

export async function routeDistanceKm(origin: GeoPoint, destination: GeoPoint): Promise<number> {
  const url = `${getOsrmBase()}/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`OSRM routing failed (${response.status})`);
  }
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.[0]?.distance) {
    throw new Error("Routing failed");
  }
  return data.routes[0].distance / 1000;
}

export function getCampusCoords(campus: string): GeoPoint {
  const dest = CAMPUS_COORDS[campus];
  if (!dest) {
    throw new Error(`Unknown campus for routing: ${campus}`);
  }
  return dest;
}

export async function distanceToCampusKm(
  originAddress: string,
  campus: string,
  originLat?: number,
  originLon?: number,
  campusLat?: number,
  campusLon?: number
): Promise<{ distanceKm: number; origin: GeoPoint; campusPoint: GeoPoint; geocoded: boolean }> {
  let origin: GeoPoint;
  let geocoded = false;
  if (originLat != null && originLon != null) {
    origin = { lat: originLat, lon: originLon };
  } else {
    const hit = await geocodeAddress(originAddress);
    origin = { lat: hit.lat, lon: hit.lon };
    geocoded = true;
  }
  const campusPoint =
    campusLat != null && campusLon != null
      ? { lat: campusLat, lon: campusLon }
      : getCampusCoords(campus);
  const distanceKm = await routeDistanceKm(origin, campusPoint);
  return { distanceKm, origin, campusPoint, geocoded };
}