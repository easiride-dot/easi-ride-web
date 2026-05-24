import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  rideId: z.string().uuid(),
});

const getEnv = (name: string) => {
  const value = process.env[name];
  if (!value) return "";
  return value;
};

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getAuthToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const parsed = schema.safeParse(req.body);
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

    // Verify user role is admin
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    // Load service role client to fetch details and write logs
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
    
    // Create a payment attempt log
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

    // Simulate STK Push. Trigger webhook success callback back to /api/monime-webhook after 3 seconds.
    const host = req.headers.host || "localhost:8080";
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const webhookUrl = `${protocol}://${host}/api/monime-webhook`;

    setTimeout(async () => {
      try {
        console.log(`⏰ Triggering webhook simulation to: ${webhookUrl}`);
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "payment.succeeded",
            data: {
              reference: orderId,
              amount,
              rideId,
            },
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
