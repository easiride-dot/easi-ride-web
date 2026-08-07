import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse, requireUser, createAdminSupabase } from "../_shared/auth.ts";
import { distanceToCampusKm, geocodeAddress, getCampusCoords, haversineKm } from "../_shared/osm.ts";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const schema = z.object({
  originAddress: z.string().min(3).max(250).transform(sanitize),
  campus: z.string().min(1).max(100).transform(sanitize),
  originLat: z.number().min(-90).max(90).optional(),
  originLon: z.number().min(-180).max(180).optional(),
  campusLat: z.number().min(-90).max(90).optional(),
  campusLon: z.number().min(-180).max(180).optional(),
  ride_type: z.enum(["solo", "shared"]).optional(),
  rideType: z.enum(["solo", "shared"]).optional(),
  passenger_count: z.number().int().min(1).optional(),
  passengerCount: z.number().int().min(1).optional(),
});

async function calculateFare(
  distanceKm: number,
  supabaseAdmin: any
): Promise<{ fare: number; surgeMode: string; surgeMultiplier: number }> {
  const { data: config, error } = await supabaseAdmin
    .from("pricing_config")
    .select("base_fare, per_km_rate, surge_mode, surge_normal, surge_peak, surge_rain")
    .single();

  if (error || !config) {
    const fallback = Math.ceil(7 + distanceKm * 7);
    return { fare: fallback, surgeMode: "normal", surgeMultiplier: 1 };
  }

  const surgeMultiplier =
    config.surge_mode === "rain" ? Number(config.surge_rain) :
    config.surge_mode === "peak" ? Number(config.surge_peak) :
    Number(config.surge_normal);

  const rawFare = (Number(config.base_fare) + distanceKm * Number(config.per_km_rate)) * surgeMultiplier;

  return {
    fare: Math.ceil(rawFare),
    surgeMode: config.surge_mode,
    surgeMultiplier,
  };
}

const MOCK_DISTANCES: Record<string, Record<string, number>> = {
  "lumley":       { "Fourah Bay College": 14.2, "IPAM Tower Hill": 12.8, "Njala University": 182, "Limkokwing": 11.5 },
  "aberdeen":     { "Fourah Bay College": 12.1, "IPAM Tower Hill": 10.5, "Njala University": 180, "Limkokwing": 9.8  },
  "model":        { "Fourah Bay College": 11.0, "IPAM Tower Hill": 9.2,  "Njala University": 178, "Limkokwing": 8.5  },
  "wilberforce":  { "Fourah Bay College": 10.0, "IPAM Tower Hill": 5.0,  "Njala University": 176, "Limkokwing": 7.0  },
  "congo cross":  { "Fourah Bay College": 8.5,  "IPAM Tower Hill": 6.2,  "Njala University": 174, "Limkokwing": 6.0  },
  "murray town":  { "Fourah Bay College": 9.0,  "IPAM Tower Hill": 7.0,  "Njala University": 175, "Limkokwing": 7.5  },
  "kingtom":      { "Fourah Bay College": 9.5,  "IPAM Tower Hill": 6.5,  "Njala University": 175, "Limkokwing": 7.0  },
  "brookfields":  { "Fourah Bay College": 11.5, "IPAM Tower Hill": 8.5,  "Njala University": 177, "Limkokwing": 9.0  },
  "tower hill":   { "Fourah Bay College": 7.0,  "IPAM Tower Hill": 1.5,  "Njala University": 173, "Limkokwing": 5.5  },
  "central":      { "Fourah Bay College": 8.0,  "IPAM Tower Hill": 4.0,  "Njala University": 174, "Limkokwing": 6.0  },
};

const DEFAULT_DISTANCE_KM = 9;

const getMockDistance = (origin: string, campus: string): number => {
  const key = origin.toLowerCase().trim();
  const exactMatch = MOCK_DISTANCES[key];
  if (exactMatch && exactMatch[campus] !== undefined) {
    return exactMatch[campus];
  }
  for (const [area, campuses] of Object.entries(MOCK_DISTANCES)) {
    if (key.includes(area) && campuses[campus] !== undefined) {
      return campuses[campus];
    }
  }
  return DEFAULT_DISTANCE_KM;
};

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

  const { originAddress, campus, originLat, originLon, campusLat, campusLon } = parsed.data;
  const rideType = parsed.data.rideType || parsed.data.ride_type || "solo";
  const passengerCount = parsed.data.passengerCount || parsed.data.passenger_count || 1;

  let distanceKm = 0;
  let isEstimate = false;
  let originCoords: { lat: number; lon: number } | undefined;
  let campusCoords: { lat: number; lon: number } | undefined;

  try {
    const route = await distanceToCampusKm(originAddress, campus, originLat, originLon, campusLat, campusLon);
    distanceKm = route.distanceKm;
    originCoords = route.origin;
    campusCoords = route.campusPoint;
  } catch {
    isEstimate = true;
    if (originLat !== undefined && originLon !== undefined) {
      originCoords = { lat: originLat, lon: originLon };
    } else {
      try {
        const hit = await geocodeAddress(originAddress);
        originCoords = { lat: hit.lat, lon: hit.lon };
      } catch {
        // ignore
      }
    }
    if (campusLat !== undefined && campusLon !== undefined) {
      campusCoords = { lat: campusLat, lon: campusLon };
    } else {
      try {
        campusCoords = getCampusCoords(campus);
      } catch {
        // ignore
      }
    }
    if (originCoords && campusCoords) {
      distanceKm = haversineKm(originCoords, campusCoords) * 1.3;
    } else {
      distanceKm = getMockDistance(originAddress, campus);
    }
  }

  const supabaseAdmin = createAdminSupabase();

  const { fare, surgeMode, surgeMultiplier } = await calculateFare(distanceKm, supabaseAdmin);

  return jsonResponse({
    distanceKm: Number(distanceKm.toFixed(1)),
    fareAmount: fare,
    surgeMode,
    surgeMultiplier,
    isEstimate,
    originCoords,
    campusCoords,
    rideType,
    passengerCount,
  });
});