import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.ts";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const verifySchema = z.object({
  orderId: z.string().trim().min(1).max(255).transform(sanitize),
});

const getEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new SetupError(`Missing ${name}`);
  return value;
};

class SetupError extends Error {
  status = 500;
}

const isMissingPaymentAttemptsTable = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "42P01";

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

export default async function handler(req: any, res: any) {
  // Reject oversized payloads (> 10KB)
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > 10240) {
    return res.status(413).json({ error: "Payload too large" });
  }
  if (req.body && JSON.stringify(req.body).length > 10240) {
    return res.status(413).json({ error: "Payload too large" });
  }

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) return res.status(401).json({ error: "Invalid auth token" });

    // Rate limiting checkout verifications: max 15 requests per minute
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
        .update({
          status: "completed",
          monime_status: monimeStatus,
        })
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
