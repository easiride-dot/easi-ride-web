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
  if (!authHeader) return res.status(401).json({ error: "Authentication required" });
  const token = (Array.isArray(authHeader) ? authHeader[0] : authHeader).replace("Bearer ", "");

  const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  try {
    // Verify the user owns this ride before calling the function
    const { data: ride } = await supabase
      .from("rides")
      .select("user_id")
      .eq("id", rideId)
      .maybeSingle();

    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.user_id !== user.id) return res.status(403).json({ error: "Not your ride" });

    // Call SECURITY DEFINER function — no service role key needed
    const { data, error } = await supabase.rpc("broadcast_ride", {
      p_ride_id: rideId,
    });

    if (error) return res.status(500).json({ error: `Broadcast failed: ${error.message}` });

    const result = data as { success: boolean; driverCount?: number; message?: string };

    // Send push notifications to online drivers (best-effort)
    if (result.success && result.driverCount && result.driverCount > 0) {
      const { data: onlineDrivers } = await supabase
        .from("driver_sessions")
        .select("driver_id")
        .eq("is_active", true);

      if (onlineDrivers) {
        const { data: rideInfo } = await supabase
          .from("rides")
          .select("pickup, destination")
          .eq("id", rideId)
          .single();

        onlineDrivers.forEach(({ driver_id }) => {
          fetch(`${getEnv("SUPABASE_URL")}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": getEnv("PUSH_NOTIFICATIONS_API_KEY"),
            },
            body: JSON.stringify({
              userId: driver_id,
              title: "New Ride Available",
              message: `${rideInfo?.pickup || "N/A"} → ${rideInfo?.destination || "N/A"}`,
              type: "ride",
              url: "/dashboard",
            }),
          }).catch(() => {});
        });
      }
    }

    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Broadcast failed";
    return res.status(500).json({ error: message });
  }
}
