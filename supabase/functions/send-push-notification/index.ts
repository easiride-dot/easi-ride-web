import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import webPush from "npm:web-push@3.6.7";
import { z } from "npm:zod@4.3.6";

type PushSendError = {
  statusCode?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const notificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(80),
  message: z.string().min(1).max(240),
  type: z.enum(["system", "ride", "payment", "promo"]).default("system"),
  url: z.string().startsWith("/").default("/account/notifications"),
  saveInApp: z.boolean().default(true),
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const getEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const verifyApiKey = (req: Request) => {
  const expected = Deno.env.get("PUSH_NOTIFICATIONS_API_KEY");
  if (!expected) return false;
  return req.headers.get("x-api-key") === expected;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!verifyApiKey(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0].message }, 400);
  }

  try {
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    webPush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:support@easiride.app",
      getEnv("VAPID_PUBLIC_KEY"),
      getEnv("VAPID_PRIVATE_KEY"),
    );

    const { userId, title, message, type, url, saveInApp } = parsed.data;

    if (saveInApp) {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        type,
      });

      if (error) {
        console.error("Could not save in-app notification:", error);
      }
    }

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (subscriptionError) throw subscriptionError;

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      tag: `${type}-${userId}`,
      data: { type },
    });

    const results = await Promise.allSettled(
      (subscriptions || []).map((subscription) =>
        webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        )
      ),
    );

    const expiredEndpoints = results
      .map((result, index) => ({ result, subscription: subscriptions?.[index] }))
      .filter(({ result }) => {
        if (result.status !== "rejected") return false;
        const statusCode = (result.reason as PushSendError)?.statusCode;
        return statusCode === 404 || statusCode === 410;
      })
      .map(({ subscription }) => subscription?.endpoint)
      .filter(Boolean);

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    const sent = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - sent;

    return jsonResponse({ success: true, sent, failed });
  } catch (error) {
    console.error("Push notification error:", error);
    const message = error instanceof Error ? error.message : "Could not send push notification";
    return jsonResponse({ error: message }, 500);
  }
});
