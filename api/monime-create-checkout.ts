import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["shared", "solo"]),
});

const plans = {
  shared: { title: "Shared Plan", amount: 100 },
  solo: { title: "Solo Plan", amount: 150 },
} as const;

const toMinorUnits = (amount: number) => Math.round(amount * 100);

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

const getAppUrl = (req: { headers: Record<string, string | string[] | undefined> }) => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${Array.isArray(host) ? host[0] : host}`;
};

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

  try {
    const token = getAuthToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const parsed = checkoutSchema.safeParse(req.body);
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.verification_status !== "approved") {
      return res.status(403).json({ error: "Student ID must be approved before payment" });
    }

    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("end_date", new Date().toISOString())
      .maybeSingle();

    if (existingSubscription) {
      return res.status(409).json({ error: "You already have an active subscription" });
    }

    const plan = plans[parsed.data.plan];
    const orderId = `er_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const appUrl = getAppUrl(req);

    const { error: attemptError } = await supabase.from("payment_attempts").insert({
      user_id: user.id,
      plan_type: parsed.data.plan,
      amount: plan.amount,
      currency: "SLE",
      order_id: orderId,
      status: "pending",
      metadata: { source: "student_checkout" },
    });

    if (attemptError) {
      if (isMissingPaymentAttemptsTable(attemptError)) {
        return res.status(500).json({ error: "Payment setup is incomplete. Apply the payment_attempts Supabase migration." });
      }

      throw attemptError;
    }

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
        name: `Easi Ride ${plan.title}`,
        description: `Weekly ${parsed.data.plan} subscription with 14 rides`,
        reference: orderId,
        successUrl: `${appUrl}/checkout/complete?orderId=${encodeURIComponent(orderId)}`,
        cancelUrl: `${appUrl}/checkout/${parsed.data.plan}?payment=cancelled&orderId=${encodeURIComponent(orderId)}`,
        lineItems: [
          {
            type: "custom",
            name: `Easi Ride ${plan.title}`,
            quantity: 1,
            reference: orderId,
            description: "Weekly student ride subscription",
            price: { currency: "SLE", value: toMinorUnits(plan.amount) },
          },
        ],
        metadata: {
          app: "easi-ride",
          userId: user.id,
          plan: parsed.data.plan,
          orderId,
        },
        callbackState: orderId,
      }),
    });

    const monimeData = await monimeResponse.json().catch(() => null);

    if (!monimeResponse.ok || !monimeData?.result?.redirectUrl || !monimeData?.result?.id) {
      await supabase
        .from("payment_attempts")
        .update({ status: "failed", monime_status: monimeData?.result?.status ?? null })
        .eq("order_id", orderId);

      return res.status(502).json({
        error: monimeData?.messages?.[0] || "Could not create Monime checkout session",
      });
    }

    await supabase
      .from("payment_attempts")
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
    });
  } catch (error) {
    console.error("Monime checkout error:", error);
    if (error instanceof SetupError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unable to start payment" });
  }
}
