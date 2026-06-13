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
  const actual = req.headers["x-api-key"];
  if (!expected) return false;
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
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
    const edgeResponse = await fetch(`${getEnv("SUPABASE_URL")}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getEnv("PUSH_NOTIFICATIONS_API_KEY"),
      },
      body: JSON.stringify(parsed.data),
    });

    const responseBody = await edgeResponse.json().catch(() => ({}));

    if (!edgeResponse.ok) {
      return res.status(edgeResponse.status).json(responseBody);
    }

    return res.status(200).json(responseBody);
  } catch (error: unknown) {
    console.error("Push notification error:", error);
    const message = error instanceof Error ? error.message : "Could not send push notification";
    return res.status(500).json({ error: message });
  }
}
