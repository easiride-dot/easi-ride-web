import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  pickupArea: z.string().min(1),
  campus: z.string().min(1),
});

const WEEKLY_MULTIPLIER = 2 * 6; // transport_fare × 2 × 6 days

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getAuthToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Validate user session
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid auth token" });

  // Look up the fare zone — never expose transport_fare to client
  const { data: zone, error: zoneError } = await supabase
    .from("fare_zones")
    .select("transport_fare")
    .eq("pickup_area", parsed.data.pickupArea)
    .eq("campus", parsed.data.campus)
    .maybeSingle();

  if (zoneError) {
    console.error("Fare zone lookup error:", zoneError);
    return res.status(500).json({ error: "Could not look up route fare" });
  }

  if (!zone) {
    return res.status(404).json({
      error: "Route not available. This pickup area and campus combination is not yet supported.",
    });
  }

  // Calculate weekly price — only this is returned to the client
  const weeklyPrice = Number(zone.transport_fare) * WEEKLY_MULTIPLIER;

  return res.status(200).json({
    weeklyPrice,           // e.g. 180 NLe
    pickupArea: parsed.data.pickupArea,
    campus: parsed.data.campus,
  });
}
