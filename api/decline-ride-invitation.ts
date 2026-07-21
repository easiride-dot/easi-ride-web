import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

type HeaderValue = string | string[] | undefined;
type ApiRequest = { method?: string; headers: Record<string, HeaderValue>; body?: unknown };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (statusCode: number) => { json: (body: unknown) => unknown } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const handleCors = (req: ApiRequest, res: ApiResponse) => {
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).json(null);
  }
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  return null;
};

const bodySchema = z.object({
  rideId: z.string().uuid(),
});

const getEnv = (name: string) => {
  const value = process.env[name] || process.env[`VITE_${name}`];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const corsResult = handleCors(req, res);
  if (corsResult) return corsResult;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { rideId } = parsed.data;

  // Verify auth
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ success: false, error: "Authentication required" });
  const token = (Array.isArray(authHeader) ? authHeader[0] : authHeader).replace("Bearer ", "");

  const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ success: false, error: "Invalid token" });

  const driverId = user.id;

  // Verify user is a registered driver
  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) return res.status(403).json({ success: false, error: "Not a registered driver" });

  try {
    const { data, error } = await supabase.rpc("decline_ride_invitation", {
      p_ride_id: rideId,
      p_driver_id: driverId,
    });

    if (error) return res.status(500).json({ success: false, error: `Decline failed: ${error.message}` });

    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Decline ride failed";
    return res.status(500).json({ success: false, error: message });
  }
}
