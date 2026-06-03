import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";

type HeaderValue = string | string[] | undefined;
type ApiRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};
type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => {
    json: (body: unknown) => unknown;
  };
};
type PushSendError = {
  statusCode?: number;
  message?: string;
};

const notificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(80),
  message: z.string().min(1).max(240),
  type: z.enum(["system", "ride", "payment", "promo"]).default("system"),
  url: z.string().startsWith("/").default("/account/notifications"),
  saveInApp: z.boolean().default(true),
});

const getEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const verifyApiKey = (req: ApiRequest) => {
  const expected = process.env.PUSH_NOTIFICATIONS_API_KEY;
  if (!expected) return false;
  return req.headers["x-api-key"] === expected;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 30 })) {
    return res.status(429).json({ error: "Too many requests" });
  }

  if (!verifyApiKey(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = notificationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    webPush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@easiride.app",
      getEnv("VAPID_PUBLIC_KEY"),
      getEnv("VAPID_PRIVATE_KEY")
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
          payload
        )
      )
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

    return res.status(200).json({ success: true, sent, failed });
  } catch (error: unknown) {
    console.error("Push notification error:", error);
    const message = error instanceof Error ? error.message : "Could not send push notification";
    return res.status(500).json({ error: message });
  }
}
