/** OpenStreetMap geocoding (Nominatim) and routing (OSRM) helpers — server-side only. */

export const FREETOWN_CENTER = { lat: 8.4844, lon: -13.2344 };

/**
 * Greater Freetown service area.
 * viewbox: left (min lon), top (max lat), right (max lon), bottom (min lat)
 * Eastern edge: 8°25'48.5"N 13°09'16.2"W → lon -13.1545 (decimal)
 */
export const FREETOWN_VIEWBOX = {
  left: -13.40,
  top: 8.58,
  right: -13.1545,
  bottom: 8.35,
};

/** Eastern boundary anchor (8°25'48.5"N 13°09'16.2"W) — for reference / maps */
export const FREETOWN_EAST_EDGE = { lat: 8.430139, lon: -13.1545 };

export const CAMPUS_COORDS: Record<string, { lat: number; lon: number }> = {
  "Fourah Bay College": { lat: 8.477917, lon: -13.221056 },
  "IPAM Tower Hill": { lat: 8.484611, lon: -13.230917 },
  Limkokwing: { lat: 8.451639, lon: -13.238417 },
};

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface LocationSuggestion {
  address: string;
  lat: number;
  lon: number;
}

const getNominatimBase = () =>
  (process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");

const getOsrmBase = () =>
  (process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");

const getUserAgent = () =>
  process.env.NOMINATIM_USER_AGENT ?? "EasiRide/1.0 (student campus rides; https://easi-ride-web.vercel.app)";

async function nominatimFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${getNominatimBase()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": getUserAgent(),
      Accept: "application/json",
    },
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

/** Forward geocode a free-text address in Freetown. */
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

/** Reverse geocode coordinates to a short place name. */
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

/** Search addresses for autocomplete (biased to Freetown). */
export async function searchLocations(query: string, limit = 5): Promise<LocationSuggestion[]> {
  const { left, top, right, bottom } = FREETOWN_VIEWBOX;
  const results = await nominatimFetch("/search", {
    q: `${query}, Freetown`,
    format: "json",
    limit: String(limit),
    countrycodes: "sl",
    viewbox: `${left},${top},${right},${bottom}`,
    bounded: "0",
    addressdetails: "1",
  });

  if (!Array.isArray(results)) return [];

  return results.map((item: { lat: string; lon: string; display_name?: string; address?: Record<string, string> }) => ({
    address: formatShortAddress(item),
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}

/** Road distance in km via OSRM (OpenStreetMap road network). */
export async function routeDistanceKm(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<number> {
  const url = `${getOsrmBase()}/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

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

/** Geocode origin if needed, then compute driving distance to campus in km. */
export async function distanceToCampusKm(
  originAddress: string,
  campus: string,
  originLat?: number,
  originLon?: number
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

  const campusPoint = getCampusCoords(campus);
  const distanceKm = await routeDistanceKm(origin, campusPoint);

  return { distanceKm, origin, campusPoint, geocoded };
}
