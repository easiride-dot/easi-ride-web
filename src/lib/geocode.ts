// Forward-geocoding helper for booking. Talks to the server-side
// /api/geocode-location route (which proxies Mapbox) so the token is not
// exposed in the client bundle. Resolves a location name to coordinates so a
// ride can store pickup/destination lat/lon at booking time.

import { supabase } from "@/integrations/supabase/client";

export type GeoCoords = { lat: number; lon: number };

/**
 * Resolve a free-text location name to coordinates via the server geocoder.
 * Returns { lat, lon } or null when nothing is confidently found.
 */
export async function geocodeName(address: string): Promise<GeoCoords | null> {
  if (!address?.trim()) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch("/api/geocode-location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query: address.trim() }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.coords ? { lat: data.coords.lat, lon: data.coords.lon } : null;
  } catch {
    return null;
  }
}