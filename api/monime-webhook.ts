import { createClient } from "@supabase/supabase-js";

const getEnv = (name: string) => {
  const value = process.env[name];
  if (!value) return "";
  return value;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
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

    const supabaseUrl = process.env.SUPABASE_URL || getEnv("VITE_SUPABASE_URL");
    const supabaseKey = process.env.SUPABASE_ANON_KEY || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the payment attempt
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

    // Extract rideId from attempt metadata or data
    const rideId = attempt.metadata?.rideId || data?.rideId;

    // Update payment attempt status to completed
    await supabaseAdmin
      .from("payment_attempts")
      .update({
        status: "completed",
        monime_status: "completed",
      })
      .eq("id", attempt.id);

    if (rideId) {
      console.log(`🚀 Advancing Ride ID ${rideId} to paid_and_dispatched`);
      const { error: rideUpdateError } = await supabaseAdmin
        .from("rides")
        .update({
          status: "paid_and_dispatched",
          payment_status: "paid",
        })
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
