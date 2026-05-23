import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";
import { distanceToCampusKm } from "./_osm.js";
import { calculatePricing } from "./calculate-trip-fare.js";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const checkoutSchema = z.discriminatedUnion("paymentType", [
  z.object({
    paymentType: z.literal("weekly"),
    originAddress: z.string().min(3).max(250).transform(sanitize),
    campus: z.string().min(1).max(100).transform(sanitize),
    originLat: z.number().min(-90).max(90).optional(),
    originLon: z.number().min(-180).max(180).optional(),
  }),
  z.object({
    paymentType: z.literal("trip"),
    originAddress: z.string().min(3).max(250).transform(sanitize),
    campus: z.string().min(1).max(100).transform(sanitize),
    originLat: z.number().min(-90).max(90).optional(),
    originLon: z.number().min(-180).max(180).optional(),
    rideId: z.string().uuid().optional(),
    ride_type: z.enum(["solo", "shared"]).optional(),
    rideType: z.enum(["solo", "shared"]).optional(),
    passenger_count: z.number().int().min(1).optional(),
    passengerCount: z.number().int().min(1).optional(),
  }),
]);

const WEEKLY_MULTIPLIER = 6;
const TRIP_BASE_RATE = 7;
const TRIP_MIN_FARE = 25;
const TRIP_MIN_DISTANCE_KM = 5;

// Mock distances for placeholder mode (mirrors calculate-trip-fare.ts)
const MOCK_DISTANCES: Record<string, Record<string, number>> = {
  lumley:       { "Fourah Bay College": 14.2, "IPAM Tower Hill": 12.8, "Njala University": 182, "Limkokwing": 11.5 },
  aberdeen:     { "Fourah Bay College": 12.1, "IPAM Tower Hill": 10.5, "Njala University": 180, "Limkokwing": 9.8  },
  model:        { "Fourah Bay College": 11.0, "IPAM Tower Hill": 9.2,  "Njala University": 178, "Limkokwing": 8.5  },
  wilberforce:  { "Fourah Bay College": 10.0, "IPAM Tower Hill": 5.0,  "Njala University": 176, "Limkokwing": 7.0  },
  "congo cross":{ "Fourah Bay College": 8.5,  "IPAM Tower Hill": 6.2,  "Njala University": 174, "Limkokwing": 6.0  },
  "murray town":{ "Fourah Bay College": 9.0,  "IPAM Tower Hill": 7.0,  "Njala University": 175, "Limkokwing": 7.5  },
};
const DEFAULT_KM = 9;

const getMockDistance = (origin: string, campus: string) => {
  const key = origin.toLowerCase().trim();
  for (const [area, campuses] of Object.entries(MOCK_DISTANCES)) {
    if (key.includes(area) && campuses[campus] !== undefined) return campuses[campus];
  }
  return DEFAULT_KM;
};

const getTripFare = async (originAddress: string, campus: string, rideType: "solo" | "shared", passengerCount: number, lat?: number, lon?: number): Promise<number> => {
  let distanceKm: number;

  try {
    const route = await distanceToCampusKm(originAddress, campus, lat, lon);
    distanceKm = route.distanceKm;
    console.log(`📍 Monime checkout fare: ${originAddress} → ${campus}`, {
      origin: route.origin,
      campus: route.campusPoint,
      geocoded: route.geocoded,
      distanceKm,
    });
  } catch {
    distanceKm = getMockDistance(originAddress, campus);
  }

  return calculatePricing(distanceKm, rideType, passengerCount).gross;
};

const getEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new SetupError(`Missing ${name}`);
  return value;
};

class SetupError extends Error { status = 500; }
class AppError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
};

const getAppUrl = (req: { headers: Record<string, string | string[] | undefined> }) => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${Array.isArray(host) ? host[0] : host}`;
};

const getErrorMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "object" && e !== null && "message" in e
    ? String((e as any).message) : "Unknown error";

const getErrorCode = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e ? String((e as any).code) : undefined;

const isMissingPaymentAttemptsTable = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error &&
  (error as any).code === "42P01";

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

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const supabaseUrl = process.env.SUPABASE_URL || getEnv("VITE_SUPABASE_URL");
    const supabaseKey = process.env.SUPABASE_ANON_KEY || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid auth token" });

    // Rate limiting checkout creations: max 5 requests per minute
    if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 5 }, user.id)) {
      return res.status(429).json({ error: "Too many checkout requests. Please wait a minute and try again." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
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
      // Check no active subscription exists
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
      // Server-side price calculation — client cannot manipulate this
      const singleFare = await getTripFare(payload.originAddress, payload.campus, "solo", 1, payload.originLat, payload.originLon);
      amount = singleFare * WEEKLY_MULTIPLIER;
      pickupArea = payload.originAddress;
      campus = payload.campus;
      planTitle = "Easi Ride Weekly Plan";
      planDescription = `Weekly solo subscription — ${payload.originAddress} → ${payload.campus}`;
    } else {
      // Pay per trip
      let dbPrice: number | null = null;
      let rideType: "solo" | "shared" = payload.rideType || payload.ride_type || "solo";
      let passengerCount = payload.passengerCount || payload.passenger_count || 1;
      if (payload.rideId) {
        const { data: ride } = await supabase
          .from("rides")
          .select("price, type")
          .eq("id", payload.rideId)
          .maybeSingle();
        if (ride) {
          dbPrice = ride.price;
          rideType = ride.type || "solo";
        }
      }
      amount = dbPrice ?? await getTripFare(payload.originAddress, payload.campus, rideType, passengerCount, payload.originLat, payload.originLon);
      campus = payload.campus;
      planTitle = "Easi Ride — Pay Per Trip";
      planDescription = `Single trip from ${payload.originAddress} to ${payload.campus}`;
    }

    const orderId = `er_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const appUrl = getAppUrl(req);

    const { error: attemptError } = await supabaseAdmin.from("payment_attempts").insert({
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
        rideId: payload.rideId ?? undefined,
      },
    });

    if (attemptError) {
      if (isMissingPaymentAttemptsTable(attemptError)) {
        return res.status(500).json({ error: "Payment setup is incomplete. Apply the payment_attempts Supabase migration." });
      }
      throw new AppError(`Could not create payment attempt: ${getErrorMessage(attemptError)}`, 500, getErrorCode(attemptError));
    }

    const completePath = payload.paymentType === "weekly" 
      ? "/checkout/complete" 
      : `/matching/${payload.rideId || ""}`;

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
        description: planDescription,
        reference: orderId,
        successUrl: `${appUrl}/api/monime-checkout-success?orderId=${encodeURIComponent(orderId)}`,
        cancelUrl: `${appUrl}/api/monime-checkout-cancel?paymentType=${payload.paymentType}&orderId=${encodeURIComponent(orderId)}`,
        lineItems: [{
          type: "custom",
          name: planTitle,
          quantity: 1,
          reference: orderId,
          description: planDescription,
          price: { currency: "SLE", value: Math.round(amount * 100) },
        }],
        metadata: { app: "easi-ride", userId: user.id, paymentType: payload.paymentType, orderId, campus },
        callbackState: orderId,
      }),
    });

    const monimeData = await monimeResponse.json().catch(() => null);

    if (!monimeResponse.ok || !monimeData?.result?.redirectUrl || !monimeData?.result?.id) {
      await supabaseAdmin.from("payment_attempts")
        .update({ status: "failed", monime_status: monimeData?.result?.status ?? null })
        .eq("order_id", orderId);

      throw new AppError(
        monimeData?.messages?.[0] || monimeData?.error?.message || "Could not create Monime checkout session",
        502,
        `MONIME_${monimeResponse.status}`
      );
    }

    await supabaseAdmin.from("payment_attempts")
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
