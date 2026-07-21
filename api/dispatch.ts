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
  type: z.enum(["pick", "cancel", "accept", "decline"]),
  rideId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
});

const getEnv = (name: string) => {
  const value = process.env[name] || process.env[`VITE_${name}`];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const getSupabase = (token: string) =>
  createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

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

  const { type, rideId, driverId } = parsed.data;

  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Authentication required" });
  const token = (Array.isArray(authHeader) ? authHeader[0] : authHeader).replace("Bearer ", "");

  const supabase = getSupabase(token);

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  try {
    if (type === "pick") {
      if (!driverId) return res.status(400).json({ error: "driverId required" });
      return await handlePick(supabase, user, rideId, driverId, res);
    }
    if (type === "cancel") {
      return await handleCancel(supabase, user, rideId, res);
    }
    if (type === "accept") {
      return await handleAccept(supabase, user, rideId, res);
    }
    return await handleDecline(supabase, user, rideId, res);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Request failed";
    return res.status(500).json({ error: message });
  }
}

async function handlePick(supabase: ReturnType<typeof getSupabase>, user: { id: string }, rideId: string, driverId: string, res: ApiResponse) {
  const { data, error } = await supabase.rpc("pick_driver", { p_ride_id: rideId, p_driver_id: driverId });
  if (error) return res.status(500).json({ error: `Pick failed: ${error.message}` });

  const result = data as { success: boolean; error?: string };
  if (!result.success) return res.status(400).json({ success: false, error: result.error || "Could not pick driver" });

  // Push notification to the chosen driver
  const { data: rideInfo } = await supabase
    .from("rides")
    .select("pickup, destination")
    .eq("id", rideId)
    .single();

  fetch(`${getEnv("SUPABASE_URL")}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": getEnv("PUSH_NOTIFICATIONS_API_KEY") },
    body: JSON.stringify({
      userId: driverId,
      title: "New Ride Available",
      message: `${rideInfo?.pickup || "N/A"} → ${rideInfo?.destination || "N/A"}`,
      type: "ride",
      url: "/dashboard",
    }),
  }).catch(() => {});

  return res.status(200).json({ success: true });
}

async function handleCancel(supabase: ReturnType<typeof getSupabase>, user: { id: string }, rideId: string, res: ApiResponse) {
  const { data, error } = await supabase.rpc("expire_pending_invitations", { p_ride_id: rideId });
  if (error) return res.status(500).json({ error: `Cancel failed: ${error.message}` });
  const result = data as { success: boolean; error?: string };
  if (!result.success) return res.status(400).json({ success: false, error: result.error || "Could not cancel" });
  return res.status(200).json({ success: true });
}

async function handleAccept(supabase: ReturnType<typeof getSupabase>, user: { id: string }, rideId: string, res: ApiResponse) {
  const driverId = user.id;

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, full_name, vehicle")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) return res.status(403).json({ error: "Not a registered driver" });

  const { data, error } = await supabase.rpc("accept_ride", { p_ride_id: rideId, p_driver_id: driverId });
  if (error) return res.status(500).json({ error: `Accept failed: ${error.message}` });

  const result = data as { success: boolean; reason?: string; driver_name?: string; driver_phone?: string; vehicle?: string };
  if (!result.success) return res.status(409).json({ success: false, reason: result.reason || "Ride already assigned" });

  const { data: rideData } = await supabase
    .from("rides")
    .select("user_id")
    .eq("id", rideId)
    .single();

  if (rideData?.user_id) {
    fetch(`${getEnv("SUPABASE_URL")}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": getEnv("PUSH_NOTIFICATIONS_API_KEY") },
      body: JSON.stringify({
        userId: rideData.user_id,
        title: "Driver Assigned!",
        message: `${result.driver_name || "Driver"} is on the way in a ${result.vehicle || "vehicle"}`,
        type: "ride",
        url: `/matching/${rideId}`,
      }),
    }).catch(() => {});
  }

  return res.status(200).json({
    success: true,
    driver_name: result.driver_name,
    driver_phone: result.driver_phone,
    vehicle: result.vehicle,
  });
}

async function handleDecline(supabase: ReturnType<typeof getSupabase>, user: { id: string }, rideId: string, res: ApiResponse) {
  const driverId = user.id;

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) return res.status(403).json({ error: "Not a registered driver" });

  const { data, error } = await supabase.rpc("decline_ride_invitation", { p_ride_id: rideId, p_driver_id: driverId });
  if (error) return res.status(500).json({ error: `Decline failed: ${error.message}` });

  return res.status(200).json({ success: true });
}
