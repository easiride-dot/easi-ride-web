import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse, requireUser, createAdminSupabase } from "../_shared/auth.ts";
import { distanceToCampusKm } from "../_shared/osm.ts";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const schema = z.object({
  originAddress: z.string().min(3).max(250).transform(sanitize),
  campus: z.string().min(1).max(100).transform(sanitize),
  originLat: z.number().min(-90).max(90).optional(),
  originLon: z.number().min(-180).max(180).optional(),
  campusLat: z.number().min(-90).max(90).optional(),
  campusLon: z.number().min(-180).max(180).optional(),
});

const MOCK_DISTANCES: Record<string, Record<string, number>> = {
  "lumley": { "Fourah Bay College": 14.2, "IPAM Tower Hill": 12.8, "Njala University": 182, "Limkokwing": 11.5 },
  "aberdeen": { "Fourah Bay College": 12.1, "IPAM Tower Hill": 10.5, "Njala University": 180, "Limkokwing": 9.8 },
  "model": { "Fourah Bay College": 11.0, "IPAM Tower Hill": 9.2, "Njala University": 178, "Limkokwing": 8.5 },
  "wilberforce": { "Fourah Bay College": 10.0, "IPAM Tower Hill": 5.0, "Njala University": 176, "Limkokwing": 7.0 },
  "congo cross": { "Fourah Bay College": 8.5, "IPAM Tower Hill": 6.2, "Njala University": 174, "Limkokwing": 6.0 },
  "murray town": { "Fourah Bay College": 9.0, "IPAM Tower Hill": 7.0, "Njala University": 175, "Limkokwing": 7.5 },
  "kingtom": { "Fourah Bay College": 9.5, "IPAM Tower Hill": 6.5, "Njala University": 175, "Limkokwing": 7.0 },
  "brookfields": { "Fourah Bay College": 11.5, "IPAM Tower Hill": 8.5, "Njala University": 177, "Limkokwing": 9.0 },
  "tower hill": { "Fourah Bay College": 7.0, "IPAM Tower Hill": 1.5, "Njala University": 173, "Limkokwing": 5.5 },
  "central": { "Fourah Bay College": 8.0, "IPAM Tower Hill": 4.0, "Njala University": 174, "Limkokwing": 6.0 },
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

  let distanceKm = 0;
  let isEstimate = false;

  try {
    const route = await distanceToCampusKm(originAddress, campus, originLat, originLon, campusLat, campusLon);
    distanceKm = route.distanceKm;
  } catch {
    distanceKm = getMockDistance(originAddress, campus);
    isEstimate = true;
  }

  const supabaseAdmin = createAdminSupabase();
  let perKmRate = 7;

  try {
    const { data: config, error } = await supabaseAdmin
      .from("pricing_config")
      .select("per_km_rate")
      .single();
    if (!error && config?.per_km_rate) {
      perKmRate = Number(config.per_km_rate);
    }
  } catch {
    // fallback to default per_km_rate
  }

  const weeklyPrice = Math.ceil(distanceKm * 6 * perKmRate);

  return jsonResponse({
    weeklyPrice,
    distanceKm: Number(distanceKm.toFixed(1)),
    isEstimate,
    perKmRate,
    originAddress,
    campus,
  });
});