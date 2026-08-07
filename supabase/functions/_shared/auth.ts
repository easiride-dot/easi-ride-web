// Shared auth helpers for edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

export function getAuthToken(authorization: string | null): string | null {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export function getEnv(name: string): string {
  return Deno.env.get(name) ?? "";
}

export function createSupabase(token: string) {
  const url = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_ANON_KEY") || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function createAdminSupabase() {
  const url = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request): Promise<{ user: { id: string }; token: string } | Response> {
  const token = getAuthToken(req.headers.get("authorization"));
  if (!token) {
    return jsonResponse({ error: "Missing auth token" }, 401);
  }
  const supabase = createSupabase(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return jsonResponse({ error: "Invalid auth token" }, 401);
  }
  return { user: { id: data.user.id }, token };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}