// Forward-geocoding helper for booking. Talks to the Supabase edge function
// geocode-location (which proxies Mapbox) so the token is not exposed in the
// client bundle. Resolves a location name to coordinates so a ride can store
// pickup/destination lat/lon at booking time.

import { callEdge } from "@/lib/edge";

export type GeoCoords = { lat: number; lon: number };

/**
 * Resolve a free-text location name to coordinates via the server geocoder.
 * Returns { lat, lon } or null when nothing is confidently found.
 */
export async function geocodeName(address: string): Promise<GeoCoords | null> {
  if (!address?.trim()) return null;

  try {
    const data = await callEdge<{ coords: GeoCoords | null }>("geocode-location", {
      body: { query: address.trim() },
    });
    return data?.coords ? { lat: data.coords.lat, lon: data.coords.lon } : null;
  } catch {
    return null;
  }
}