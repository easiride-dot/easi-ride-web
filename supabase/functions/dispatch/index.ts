import { z } from "npm:zod@4.3.6";
import { corsHeaders, jsonResponse, getEnv, requireUser, createSupabase } from "../_shared/auth.ts";

const bodySchema = z.object({
  type: z.enum(["pick", "cancel", "accept", "decline"]),
  rideId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
});

async function handlePick(supabase: any, user: { id: string }, rideId: string, driverId: string): Promise<Response> {
  const { data, error } = await supabase.rpc("pick_driver", { p_ride_id: rideId, p_driver_id: driverId, p_user_id: user.id });
  if (error) return jsonResponse({ error: `Pick failed: ${error.message}` }, 500);
  const result = data as { success: boolean; error?: string; invitation_id?: string };
  if (!result.success) return jsonResponse({ success: false, error: result.error || "Could not pick driver" }, 400);

  const { data: rideInfo } = await supabase.from("rides").select("pickup, destination, type").eq("id", rideId).single();

  fetch(`${getEnv("SUPABASE_URL")}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": getEnv("PUSH_NOTIFICATIONS_API_KEY") },
    body: JSON.stringify({
      userId: driverId,
      title: "New Ride Request",
      message: "A passenger selected you for a ride. Tap to respond.",
      type: "ride",
      url: "/dashboard",
      data: { rideId, invitationId: result.invitation_id },
    }),
  }).catch(() => {});

  return jsonResponse({ success: true, invitation_id: result.invitation_id });
}

async function handleCancel(supabase: any, rideId: string): Promise<Response> {
  const { data, error } = await supabase.rpc("expire_pending_invitations", { p_ride_id: rideId });
  if (error) return jsonResponse({ error: `Cancel failed: ${error.message}` }, 500);
  const result = data as { success: boolean; error?: string };
  if (!result.success) return jsonResponse({ success: false, error: result.error || "Could not cancel" }, 400);
  return jsonResponse({ success: true });
}

async function handleAccept(supabase: any, rideId: string, driverId: string): Promise<Response> {
  const { data: driver } = await supabase.from("drivers").select("id, full_name, vehicle").eq("id", driverId).maybeSingle();
  if (!driver) return jsonResponse({ error: "Not a registered driver" }, 403);

  const { data, error } = await supabase.rpc("accept_ride", { p_ride_id: rideId, p_driver_id: driverId });
  if (error) return jsonResponse({ error: `Accept failed: ${error.message}` }, 500);
  const result = data as { success: boolean; reason?: string; driver_name?: string; driver_phone?: string; vehicle?: string };
  if (!result.success) return jsonResponse({ success: false, reason: result.reason || "Ride already assigned" }, 409);

  const { data: rideData } = await supabase.from("rides").select("user_id").eq("id", rideId).single();
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

  return jsonResponse({
    success: true,
    driver_name: result.driver_name,
    driver_phone: result.driver_phone,
    vehicle: result.vehicle,
  });
}

async function handleDecline(supabase: any, rideId: string, driverId: string): Promise<Response> {
  const { data: driver } = await supabase.from("drivers").select("id").eq("id", driverId).maybeSingle();
  if (!driver) return jsonResponse({ error: "Not a registered driver" }, 403);
  const { data, error } = await supabase.rpc("decline_ride_invitation", { p_ride_id: rideId, p_driver_id: driverId });
  if (error) return jsonResponse({ error: `Decline failed: ${error.message}` }, 500);
  return jsonResponse({ success: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const guard = await requireUser(req);
  if (guard instanceof Response) return guard;

  const body: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0].message }, 400);
  }

  const { type, rideId, driverId } = parsed.data;
  const supabase = createSupabase(guard.token);

  try {
    if (type === "pick") {
      if (!driverId) return jsonResponse({ error: "driverId required" }, 400);
      return await handlePick(supabase, guard.user, rideId, driverId);
    }
    if (type === "cancel") return await handleCancel(supabase, rideId);
    if (type === "accept") return await handleAccept(supabase, rideId, guard.user.id);
    return await handleDecline(supabase, rideId, guard.user.id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Request failed";
    return jsonResponse({ error: message }, 500);
  }
});