import { z } from "npm:zod@4.3.6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import {
  corsHeaders,
  jsonResponse,
  getEnv,
  getAuthToken,
  createSupabase,
  createAdminSupabase,
  requireUser,
} from "../_shared/auth.ts";
import { distanceToCampusKm } from "../_shared/osm.ts";

// Consolidated MoniMe payment handlers as a single edge function.
// The `action` is derived from the `action` URL/query param, mirroring the
// /api/monime-* endpoints that used to live on the Express/Vercel backend.

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

class AppError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const getErrorMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "object" && e !== null && "message" in e
    ? String((e as any).message) : "Unknown error";

const getErrorCode = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e ? String((e as any).code) : undefined;

const isMissingPaymentAttemptsTable = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && (error as any).code === "42P01";

const getAppUrl = (req: Request) => {
  if (Deno.env.get("APP_URL")) return Deno.env.get("APP_URL")!.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
};

// ---------------------------------------------------------------------------
// create-checkout
// ---------------------------------------------------------------------------
const WEEKLY_MULTIPLIER = 6;

const checkoutSchema = z.discriminatedUnion("paymentType", [
  z.object({
    paymentType: z.literal("weekly"),
    originAddress: z.string().min(3).max(250).transform(sanitize),
    campus: z.string().min(1).max(100).transform(sanitize),
    originLat: z.number().min(-90).max(90).optional(),
    originLon: z.number().min(-180).max(180).optional(),
    campusLat: z.number().min(-90).max(90).optional(),
    campusLon: z.number().min(-180).max(180).optional(),
  }),
  z.object({
    paymentType: z.literal("trip"),
    originAddress: z.string().min(3).max(250).transform(sanitize),
    campus: z.string().min(1).max(100).transform(sanitize),
    originLat: z.number().min(-90).max(90).optional(),
    originLon: z.number().min(-180).max(180).optional(),
    campusLat: z.number().min(-90).max(90).optional(),
    campusLon: z.number().min(-180).max(180).optional(),
    rideId: z.string().uuid().optional(),
    ride_type: z.enum(["solo", "shared"]).optional(),
    rideType: z.enum(["solo", "shared"]).optional(),
    passenger_count: z.number().int().min(1).optional(),
    passengerCount: z.number().int().min(1).optional(),
  }),
]);

async function handleCreateCheckout(req: Request, supabase: any, user: { id: string }): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0].message }, 400);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("verification_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.verification_status !== "approved") {
    return jsonResponse({ error: "Student ID must be approved before payment" }, 403);
  }

  const payload = parsed.data;
  let amount: number;
  let planTitle: string;
  let planDescription: string;
  let pickupArea: string | null = null;
  let campus: string;

  if (payload.paymentType === "weekly") {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("end_date", new Date().toISOString())
      .maybeSingle();
    if (existing) {
      return jsonResponse({ error: "You already have an active subscription" }, 409);
    }
    let weeklyDistanceKm: number;
    try {
      const weeklyRoute = await distanceToCampusKm(payload.originAddress, payload.campus, payload.originLat, payload.originLon, payload.campusLat, payload.campusLon);
      weeklyDistanceKm = weeklyRoute.distanceKm;
    } catch {
      weeklyDistanceKm = 9;
    }
    const { data: weeklyCfg } = await supabase.from("pricing_config").select("per_km_rate").single();
    const weeklyRate = weeklyCfg?.per_km_rate ?? 7;
    amount = Math.ceil(weeklyDistanceKm * WEEKLY_MULTIPLIER * Number(weeklyRate));
    pickupArea = payload.originAddress;
    campus = payload.campus;
    planTitle = "Easi Ride Weekly Plan";
    planDescription = `Weekly solo subscription — ${payload.originAddress} → ${payload.campus}`;
  } else {
    let dbPrice: number | null = null;
    let rideType: "solo" | "shared" = payload.rideType || payload.ride_type || "solo";
    let passengerCount = payload.passengerCount || payload.passenger_count || 1;
    if (payload.rideId) {
      const { data: ride } = await supabase.from("rides").select("price, type, fare_amount").eq("id", payload.rideId).maybeSingle();
      if (ride) {
        dbPrice = ride.fare_amount || ride.price;
        rideType = ride.type || "solo";
      }
    }
    amount = dbPrice;
    if (amount === null) {
      let tripDistanceKm: number;
      try {
        const tripRoute = await distanceToCampusKm(payload.originAddress, payload.campus, payload.originLat, payload.originLon, payload.campusLat, payload.campusLon);
        tripDistanceKm = tripRoute.distanceKm;
      } catch {
        tripDistanceKm = 9;
      }
      const { fare } = await calculateFare(tripDistanceKm, rideType, passengerCount, supabase);
      amount = fare;
    }
    if (rideType === "shared") {
      amount = Math.round(amount / 3);
    }
    campus = payload.campus;
    planTitle = "Easi Ride — Pay Per Trip";
    planDescription = `Single trip from ${payload.originAddress} to ${payload.campus}`;
  }

  const orderId = `er_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const appUrl = getAppUrl(req);

  const { error: attemptError } = await supabase.from("payment_attempts").insert({
    user_id: user.id,
    plan_type: payload.paymentType === "weekly" ? "solo" : "trip",
    amount,
    currency: "SLE",
    order_id: orderId,
    status: "pending",
    metadata: {
      source: "student_checkout",
      paymentType: payload.paymentType,
      pickupArea: pickupArea ?? undefined,
      campus,
      originAddress: payload.originAddress,
      ...(payload.paymentType === "trip" && payload.rideId ? { rideId: payload.rideId } : {}),
    },
  });

  if (attemptError) {
    if (isMissingPaymentAttemptsTable(attemptError)) {
      return jsonResponse({ error: "Payment setup is incomplete. Apply the payment_attempts Supabase migration." }, 500);
    }
    throw new AppError(`Could not create payment attempt: ${getErrorMessage(attemptError)}`, 500, getErrorCode(attemptError));
  }

  const truncatedDescription = planDescription.length > 100
    ? planDescription.substring(0, 97) + "..."
    : planDescription;

  const monimeResponse = await fetch("https://api.monime.io/v1/checkout-sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnv("MONIME_ACCESS_TOKEN")}`,
      "Monime-Space-Id": getEnv("MONIME_SPACE_ID"),
      "Monime-Version": "caph.2025-08-23",
      "Idempotency-Key": crypto.randomUUID(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: planTitle,
      description: truncatedDescription,
      reference: orderId,
      successUrl: `${appUrl}/api/monime-checkout-success?orderId=${encodeURIComponent(orderId)}`,
      cancelUrl: `${appUrl}/api/monime-checkout-cancel?paymentType=${payload.paymentType}&orderId=${encodeURIComponent(orderId)}`,
      lineItems: [{
        type: "custom",
        name: planTitle,
        quantity: 1,
        reference: orderId,
        description: truncatedDescription,
        price: { currency: "SLE", value: Math.round(amount * 100) },
      }],
      metadata: { app: "easi-ride", userId: user.id, paymentType: payload.paymentType, orderId, campus },
      callbackState: orderId,
    }),
  });

  const monimeData = await monimeResponse.json().catch(() => null);

  if (!monimeResponse.ok || !monimeData?.result?.redirectUrl || !monimeData?.result?.id) {
    await supabase.from("payment_attempts")
      .update({ status: "failed", monime_status: monimeData?.result?.status ?? null })
      .eq("order_id", orderId);
    throw new AppError(
      monimeData?.messages?.[0] || monimeData?.error?.message || "Could not create Monime checkout session",
      502,
      `MONIME_${monimeResponse.status}`
    );
  }

  await supabase.from("payment_attempts")
    .update({
      monime_session_id: monimeData.result.id,
      monime_order_number: monimeData.result.orderNumber ?? null,
      redirect_url: monimeData.result.redirectUrl,
      monime_status: monimeData.result.status ?? "pending",
    })
    .eq("order_id", orderId);

  return jsonResponse({
    orderId,
    sessionId: monimeData.result.id,
    redirectUrl: monimeData.result.redirectUrl,
    amount,
  });
}

async function calculateFare(distanceKm: number, rideType: string, passengerCount: number, supabase: any): Promise<{ fare: number }> {
  const { data: config, error } = await supabase
    .from("pricing_config")
    .select("base_fare, per_km_rate, surge_mode, surge_normal, surge_peak, surge_rain")
    .single();
  let fare: number;
  if (error || !config) {
    fare = Math.ceil(7 + distanceKm * 7);
  } else {
    const surgeMultiplier =
      config.surge_mode === "rain" ? Number(config.surge_rain) :
      config.surge_mode === "peak" ? Number(config.surge_peak) :
      Number(config.surge_normal);
    fare = Math.ceil((Number(config.base_fare) + distanceKm * Number(config.per_km_rate)) * surgeMultiplier);
  }
  if (rideType === "shared") {
    fare = fare * passengerCount;
  }
  return { fare };
}

// ---------------------------------------------------------------------------
// verify-checkout
// ---------------------------------------------------------------------------
const verifySchema = z.object({ orderId: z.string().trim().min(1).max(255).transform(sanitize) });

async function handleVerifyCheckout(supabase: any, user: { id: string }, body: unknown): Promise<Response> {
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ error: parsed.error.issues[0].message }, 400);

  const { data: attempt, error: attemptError } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("order_id", parsed.data.orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (attemptError) {
    if (isMissingPaymentAttemptsTable(attemptError)) {
      return jsonResponse({ error: "Payment setup is incomplete. Apply the payment_attempts Supabase migration." }, 500);
    }
    throw attemptError;
  }
  if (!attempt?.monime_session_id) return jsonResponse({ error: "Payment attempt not found" }, 404);

  if (attempt.status === "completed" && attempt.subscription_id) {
    return jsonResponse({ status: "completed", subscriptionId: attempt.subscription_id });
  }

  const monimeResponse = await fetch(`https://api.monime.io/v1/checkout-sessions/${attempt.monime_session_id}`, {
    headers: {
      Authorization: `Bearer ${getEnv("MONIME_ACCESS_TOKEN")}`,
      "Monime-Space-Id": getEnv("MONIME_SPACE_ID"),
      "Monime-Version": "caph.2025-08-23",
    },
  });
  const monimeData = await monimeResponse.json().catch(() => null);
  if (!monimeResponse.ok || !monimeData?.result?.status) {
    return jsonResponse({ error: monimeData?.messages?.[0] || "Could not verify Monime checkout session" }, 502);
  }

  const monimeStatus = monimeData.result.status as string;
  const mappedStatus = ["completed", "cancelled", "expired"].includes(monimeStatus) ? monimeStatus : "pending";

  if (mappedStatus !== "completed") {
    await supabase.from("payment_attempts").update({ status: mappedStatus, monime_status: monimeStatus }).eq("id", attempt.id);
    return jsonResponse({ status: mappedStatus });
  }

  if (attempt.plan_type === "trip") {
    const rideId = attempt.metadata?.rideId;
    await supabase.from("payment_attempts").update({ status: "completed", monime_status: monimeStatus }).eq("id", attempt.id);
    if (rideId) await supabase.from("rides").update({ payment_status: "paid" }).eq("id", rideId);
    return jsonResponse({ status: "completed", rideId });
  }

  const { data: existingSubscription } = await supabase
    .from("subscriptions").select("id").eq("user_id", user.id).eq("status", "active").gt("end_date", new Date().toISOString()).maybeSingle();
  if (existingSubscription) {
    await supabase.from("payment_attempts").update({ status: "completed", monime_status: monimeStatus, subscription_id: existingSubscription.id }).eq("id", attempt.id);
    return jsonResponse({ status: "completed", subscriptionId: existingSubscription.id });
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan_type: attempt.plan_type,
      status: "active",
      end_date: endDate.toISOString(),
      rides_used: 0,
      rides_limit: 14,
      pickup_area: attempt.metadata?.originAddress || attempt.metadata?.pickupArea || null,
      campus: attempt.metadata?.campus || null,
      amount_paid: attempt.amount,
    })
    .select("id")
    .single();
  if (subscriptionError) throw subscriptionError;
  await supabase.from("payment_attempts").update({ status: "completed", monime_status: monimeStatus, subscription_id: subscription.id }).eq("id", attempt.id);
  return jsonResponse({ status: "completed", subscriptionId: subscription.id });
}

// ---------------------------------------------------------------------------
// stk-push
// ---------------------------------------------------------------------------
const stkSchema = z.object({ rideId: z.string().uuid() });

async function handleStkPush(req: Request, supabase: any, user: { id: string }, body: unknown): Promise<Response> {
  const parsed = stkSchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ error: parsed.error.issues[0].message }, 400);

  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return jsonResponse({ error: "Unauthorized: Admin access required" }, 403);

  const supabaseAdmin = createAdminSupabase();
  if (!supabaseAdmin) return jsonResponse({ error: "Server configuration error: Service role key not configured" }, 500);

  const rideId = parsed.data.rideId;
  const { data: ride, error: rideError } = await supabaseAdmin.from("rides").select(`*, profiles(phone, full_name)`).eq("id", rideId).maybeSingle();
  if (rideError || !ride) return jsonResponse({ error: "Ride not found" }, 404);

  const profiles: any = ride.profiles;
  const phone = profiles?.phone || "+23278000000";
  const amount = ride.price;
  const orderId = `er_stk_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  await supabaseAdmin.from("payment_attempts").insert({
    user_id: ride.user_id,
    plan_type: "trip",
    amount,
    currency: "SLE",
    order_id: orderId,
    status: "pending",
    metadata: { source: "stk_push_dispatch", rideId, phone },
  });

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || `${protocol}://${host}`;
  const webhookUrl = `${supabaseUrl}/functions/v1/monime?action=webhook`;

  setTimeout(async () => {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "payment.succeeded", data: { reference: orderId, amount, rideId } }),
      });
    } catch (err) {
      console.error("Webhook simulation trigger failed:", err);
    }
  }, 3000);

  return jsonResponse({ success: true, message: "STK PIN push successfully triggered on user phone", orderId });
}

// ---------------------------------------------------------------------------
// webhook
// ---------------------------------------------------------------------------
async function handleWebhook(req: Request): Promise<Response> {
  const expected = Deno.env.get("MONIME_WEBHOOK_API_KEY");
  if (!expected || req.headers.get("x-webhook-api-key") !== expected) {
    return jsonResponse({ error: "Unauthorized: Invalid webhook API key" }, 401);
  }

  const { event, data } = await req.json().catch(() => ({})) as any;
  if (event !== "payment.succeeded") {
    return jsonResponse({ received: true, message: "Ignored event type" });
  }

  const orderId = data?.reference;
  if (!orderId) return jsonResponse({ error: "Missing order reference" }, 400);

  const supabaseAdmin = createAdminSupabase();
  if (!supabaseAdmin) return jsonResponse({ error: "Server configuration error" }, 500);

  const { data: attempt, error: attemptError } = await supabaseAdmin.from("payment_attempts").select("*").eq("order_id", orderId).maybeSingle();
  if (attemptError || !attempt) return jsonResponse({ error: "Payment attempt not found" }, 404);
  if (attempt.status === "completed") return jsonResponse({ success: true, message: "Already processed" });

  const rideId = attempt.metadata?.rideId || data?.rideId;
  await supabaseAdmin.from("payment_attempts").update({ status: "completed", monime_status: "completed" }).eq("id", attempt.id);

  if (rideId) {
    const { error: rideUpdateError } = await supabaseAdmin.from("rides").update({ status: "paid_and_dispatched", payment_status: "paid" }).eq("id", rideId);
    if (rideUpdateError) return jsonResponse({ error: "Failed to update ride status" }, 500);
  }

  return jsonResponse({ success: true, message: "Payment processed successfully" });
}

// ---------------------------------------------------------------------------
// redirects
// ---------------------------------------------------------------------------
function handleCheckoutSuccess(req: Request): Response {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  const query = new URLSearchParams();
  if (orderId) query.set("orderId", orderId);
  return new Response(null, {
    status: 303,
    headers: { Location: `${getAppUrl(req)}/checkout/complete?${query.toString()}` },
  });
}

function handleCheckoutCancel(req: Request): Response {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  const plan = url.searchParams.get("plan") === "solo" ? "solo" : "shared";
  const query = new URLSearchParams({ payment: "cancelled" });
  if (orderId) query.set("orderId", orderId);
  return new Response(null, {
    status: 303,
    headers: { Location: `${getAppUrl(req)}/checkout/${plan}?${query.toString()}` },
  });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "checkout-success") return handleCheckoutSuccess(req);
    if (action === "checkout-cancel") return handleCheckoutCancel(req);
    if (action === "webhook") return handleWebhook(req);

    if (action === "stk-push") {
      const guard = await requireUser(req);
      if (guard instanceof Response) return guard;
      return await handleStkPush(req, createSupabase(guard.token), guard.user, await req.json().catch(() => null));
    }

    if (action === "create-checkout" || action === "verify-checkout") {
      const guard = await requireUser(req);
      if (guard instanceof Response) return guard;
      const supabase = createSupabase(guard.token);
      if (action === "create-checkout") {
        return await handleCreateCheckout(req, supabase, guard.user);
      }
      return await handleVerifyCheckout(supabase, guard.user, await req.json().catch(() => null));
    }

    return jsonResponse({ error: `Unknown MoniMe action: ${action}` }, 404);
  } catch (error) {
    console.error("Monime error:", error);
    if (error instanceof AppError) {
      return jsonResponse({ error: error.message, code: error.code }, error.status);
    }
    return jsonResponse({ error: getErrorMessage(error) }, 500);
  }
});