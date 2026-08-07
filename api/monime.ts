// Consolidated MoniMe payment handlers.
// Vercel treats every file in /api as a separate Serverless Function, and the
// Hobby plan caps a deployment at 12 functions. These six related endpoints
// previously lived in six files; routing all of them here (via vercel.json
// rewrites) keeps the same public URLs while using a single function.
// The action is carried in the `__monime` query param added by the rewrite.

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";
import { distanceToCampusKm } from "./_osm.js";
import { calculatePricing } from "./calculate-trip-fare.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
};

const getEnv = (name: string) => {
  const value = process.env[name];
  return value ?? "";
};

class SetupError extends Error {
  status = 500;
}

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
  typeof error === "object" && error !== null && "code" in error &&
  (error as any).code === "42P01";

const rejectOversized = (req: any, res: any): boolean => {
  const contentLength = req.headers["content-length"];
  if (contentLength && parseInt(contentLength, 10) > 10240) {
    res.status(413).json({ error: "Payload too large" });
    return true;
  }
  if (req.body && JSON.stringify(req.body).length > 10240) {
    res.status(413).json({ error: "Payload too large" });
    return true;
  }
  return false;
};

const getAppUrl = (req: { headers: Record<string, string | string[] | undefined> }) => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${Array.isArray(host) ? host[0] : host}`;
};

// ---------------------------------------------------------------------------
// create-checkout
// ---------------------------------------------------------------------------
const CHECKOUT_MULTIPLIER_WEEKLY = 6;

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

async function handleCreateCheckout(req: any, res: any) {
  if (rejectOversized(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getAuthToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return res.status(401).json({ error: "Invalid auth token" });
    }

    if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 5 }, user.id)) {
      return res.status(429).json({ error: "Too many checkout requests. Please wait a minute and try again." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      throw profileError;
    }
    if (profile?.verification_status !== "approved") {
      return res.status(403).json({ error: "Student ID must be approved before payment" });
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
        return res.status(409).json({ error: "You already have an active subscription" });
      }
      let weeklyDistanceKm: number;
      try {
        const weeklyRoute = await distanceToCampusKm(payload.originAddress, payload.campus, payload.originLat, payload.originLon, payload.campusLat, payload.campusLon);
        weeklyDistanceKm = weeklyRoute.distanceKm;
      } catch {
        weeklyDistanceKm = 9;
      }

      const { data: weeklyCfg } = await supabase
        .from("pricing_config")
        .select("per_km_rate")
        .single();
      const weeklyRate = weeklyCfg?.per_km_rate ?? 7;

      amount = Math.ceil(weeklyDistanceKm * CHECKOUT_MULTIPLIER_WEEKLY * Number(weeklyRate));
      pickupArea = payload.originAddress;
      campus = payload.campus;
      planTitle = "Easi Ride Weekly Plan";
      planDescription = `Weekly solo subscription — ${payload.originAddress} → ${payload.campus}`;
    } else {
      let dbPrice: number | null = null;
      let rideType: "solo" | "shared" = payload.rideType || payload.ride_type || "solo";
      let passengerCount = payload.passengerCount || payload.passenger_count || 1;
      if (payload.rideId) {
        const { data: ride } = await supabase
          .from("rides")
          .select("price, type, fare_amount")
          .eq("id", payload.rideId)
          .maybeSingle();
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
        const pricing = await calculatePricing(tripDistanceKm, rideType, passengerCount, supabase);
        amount = pricing.gross;
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
      console.error("Payment attempt insert error:", attemptError);
      if (isMissingPaymentAttemptsTable(attemptError)) {
        return res.status(500).json({ error: "Payment setup is incomplete. Apply the payment_attempts Supabase migration." });
      }
      throw new AppError(`Could not create payment attempt: ${getErrorMessage(attemptError)}`, 500, getErrorCode(attemptError));
    }

    const completePath = payload.paymentType === "weekly"
      ? "/checkout/complete"
      : `/matching/${payload.rideId || ""}`;

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
      console.error("Monime API error:", { status: monimeResponse.status, data: monimeData });
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

    return res.status(200).json({
      orderId,
      sessionId: monimeData.result.id,
      redirectUrl: monimeData.result.redirectUrl,
      amount,
    });
  } catch (error) {
    console.error("Monime checkout error:", error);
    if (error instanceof SetupError) return res.status(error.status).json({ error: error.message, code: "SETUP_ERROR" });
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message, code: error.code });
    return res.status(500).json({ error: "Unable to start payment", code: getErrorCode(error), detail: getErrorMessage(error) });
  }
}

// ---------------------------------------------------------------------------
// verify-checkout
// ---------------------------------------------------------------------------
const verifySchema = z.object({
  orderId: z.string().trim().min(1).max(255).transform(sanitize),
});

async function handleVerifyCheckout(req: any, res: any) {
  if (rejectOversized(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getAuthToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const supabaseUrl = process.env.SUPABASE_URL || getEnv("VITE_SUPABASE_URL");
    const supabaseKey = process.env.SUPABASE_ANON_KEY || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid auth token" });

    if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 15 }, user.id)) {
      return res.status(429).json({ error: "Too many verification requests. Please try again in a few seconds." });
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("payment_attempts")
      .select("*")
      .eq("order_id", parsed.data.orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (attemptError) {
      if (isMissingPaymentAttemptsTable(attemptError)) {
        return res.status(500).json({ error: "Payment setup is incomplete. Apply the payment_attempts Supabase migration." });
      }
      throw attemptError;
    }
    if (!attempt?.monime_session_id) return res.status(404).json({ error: "Payment attempt not found" });

    if (attempt.status === "completed" && attempt.subscription_id) {
      return res.status(200).json({ status: "completed", subscriptionId: attempt.subscription_id });
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
      return res.status(502).json({
        error: monimeData?.messages?.[0] || "Could not verify Monime checkout session",
      });
    }

    const monimeStatus = monimeData.result.status as string;
    const mappedStatus = ["completed", "cancelled", "expired"].includes(monimeStatus)
      ? monimeStatus
      : "pending";

    if (mappedStatus !== "completed") {
      await supabase
        .from("payment_attempts")
        .update({ status: mappedStatus, monime_status: monimeStatus })
        .eq("id", attempt.id);

      return res.status(200).json({ status: mappedStatus });
    }

    if (attempt.plan_type === "trip") {
      const rideId = attempt.metadata?.rideId;

      await supabase
        .from("payment_attempts")
        .update({ status: "completed", monime_status: monimeStatus })
        .eq("id", attempt.id);

      if (rideId) {
        await supabase
          .from("rides")
          .update({ payment_status: "paid" })
          .eq("id", rideId);
      }

      return res.status(200).json({ status: "completed", rideId });
    }

    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("end_date", new Date().toISOString())
      .maybeSingle();

    if (existingSubscription) {
      await supabase
        .from("payment_attempts")
        .update({
          status: "completed",
          monime_status: monimeStatus,
          subscription_id: existingSubscription.id,
        })
        .eq("id", attempt.id);

      return res.status(200).json({ status: "completed", subscriptionId: existingSubscription.id });
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

    await supabase
      .from("payment_attempts")
      .update({
        status: "completed",
        monime_status: monimeStatus,
        subscription_id: subscription.id,
      })
      .eq("id", attempt.id);

    return res.status(200).json({ status: "completed", subscriptionId: subscription.id });
  } catch (error) {
    console.error("Monime verification error:", error);
    if (error instanceof SetupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Unable to verify payment" });
  }
}

// ---------------------------------------------------------------------------
// stk-push
// ---------------------------------------------------------------------------
const stkSchema = z.object({
  rideId: z.string().uuid(),
});

async function handleStkPush(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getAuthToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const parsed = stkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { rideId } = parsed.data;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid auth token" });

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return res.status(500).json({ error: "Server configuration error: Service role key not configured" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: ride, error: rideError } = await supabaseAdmin
      .from("rides")
      .select(`*, profiles(phone, full_name)`)
      .eq("id", rideId)
      .maybeSingle();

    if (rideError || !ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const profiles: any = ride.profiles;
    const phone = profiles?.phone || "+23278000000";
    const amount = ride.price;

    console.log(`📡 STK Push triggered for Ride ID: ${rideId}. Phone: ${phone}, Price: ${amount} NLe.`);

    const orderId = `er_stk_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    await supabaseAdmin.from("payment_attempts").insert({
      user_id: ride.user_id,
      plan_type: "trip",
      amount,
      currency: "SLE",
      order_id: orderId,
      status: "pending",
      metadata: {
        source: "stk_push_dispatch",
        rideId,
        phone,
      },
    });

    const host = req.headers.host || "localhost:8080";
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const webhookUrl = `${protocol}://${host}/api/monime-webhook`;

    setTimeout(async () => {
      try {
        console.log(`⏰ Triggering webhook simulation to: ${webhookUrl}`);
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "payment.succeeded",
            data: { reference: orderId, amount, rideId },
          }),
        });
      } catch (err) {
        console.error("Webhook simulation trigger failed:", err);
      }
    }, 3000);

    return res.status(200).json({
      success: true,
      message: "STK PIN push successfully triggered on user phone",
      orderId,
    });
  } catch (err: any) {
    console.error("STK Push error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

// ---------------------------------------------------------------------------
// webhook
// ---------------------------------------------------------------------------
const verifyWebhookAuth = (req: any): boolean => {
  const webhookApiKey = process.env.MONIME_WEBHOOK_API_KEY;
  if (!webhookApiKey) {
    console.error("MONIME_WEBHOOK_API_KEY not configured");
    return false;
  }
  const authHeader = req.headers["x-webhook-api-key"];
  return authHeader === webhookApiKey;
};

async function handleWebhook(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyWebhookAuth(req)) {
    return res.status(401).json({ error: "Unauthorized: Invalid webhook API key" });
  }

  try {
    const { event, data } = req.body || {};
    console.log("📥 Received MoniMe Webhook Event:", { event, data });

    if (event !== "payment.succeeded") {
      return res.status(200).json({ received: true, message: "Ignored event type" });
    }

    const orderId = data?.reference;
    if (!orderId) {
      return res.status(400).json({ error: "Missing order reference" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment variables not configured");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("payment_attempts")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (attemptError || !attempt) {
      console.error(`❌ Webhook error: Payment attempt not found for orderId ${orderId}`, attemptError);
      return res.status(404).json({ error: "Payment attempt not found" });
    }

    if (attempt.status === "completed") {
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    const rideId = attempt.metadata?.rideId || data?.rideId;

    await supabaseAdmin
      .from("payment_attempts")
      .update({ status: "completed", monime_status: "completed" })
      .eq("id", attempt.id);

    if (rideId) {
      console.log(`🚀 Advancing Ride ID ${rideId} to paid_and_dispatched`);
      const { error: rideUpdateError } = await supabaseAdmin
        .from("rides")
        .update({ status: "paid_and_dispatched", payment_status: "paid" })
        .eq("id", rideId);

      if (rideUpdateError) {
        console.error(`❌ Failed to update ride ${rideId} status:`, rideUpdateError);
        return res.status(500).json({ error: "Failed to update ride status" });
      }
    }

    return res.status(200).json({ success: true, message: "Payment processed successfully" });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

// ---------------------------------------------------------------------------
// checkout-success (redirect)
// ---------------------------------------------------------------------------
async function handleCheckoutSuccess(req: any, res: any) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).send("Method not allowed");
  }

  const orderId = req.query.orderId ? String(req.query.orderId) : "";
  const query = new URLSearchParams();

  if (orderId) query.set("orderId", orderId);

  res.writeHead(303, { Location: `/checkout/complete?${query.toString()}` });
  return res.end();
}

// ---------------------------------------------------------------------------
// checkout-cancel (redirect)
// ---------------------------------------------------------------------------
async function handleCheckoutCancel(req: any, res: any) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).send("Method not allowed");
  }

  const orderId = req.query.orderId ? String(req.query.orderId) : "";
  const plan = req.query.plan === "solo" ? "solo" : "shared";
  const query = new URLSearchParams({ payment: "cancelled" });

  if (orderId) query.set("orderId", orderId);

  res.writeHead(303, { Location: `/checkout/${plan}?${query.toString()}` });
  return res.end();
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
const ACTION_HANDLERS: Record<string, (req: any, res: any) => Promise<unknown>> = {
  "create-checkout": handleCreateCheckout,
  "verify-checkout": handleVerifyCheckout,
  "stk-push": handleStkPush,
  "webhook": handleWebhook,
  "checkout-success": handleCheckoutSuccess,
  "checkout-cancel": handleCheckoutCancel,
};

export default async function handler(req: any, res: any) {
  let action: string = Array.isArray(req.query?.__monime) ? req.query.__monime[0] : (req.query?.__monime as string);

  if (!action) {
    // Fallback: infer action from the path (e.g. /api/monime-create-checkout)
    const path = (req.url || req.originalUrl || "").toString();
    const match = path.match(/^\/api\/monime-(.+?)(?:\?|$)/);
    if (match) action = match[1];
  }

  if (!action) {
    return res.status(404).json({ error: "Unknown MoniMe action" });
  }

  const run = ACTION_HANDLERS[action];
  if (!run) {
    return res.status(404).json({ error: `Unknown MoniMe action: ${action}` });
  }

  return run(req, res);
}