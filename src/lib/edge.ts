// Client helper for calling Supabase Edge Functions.
// All backend logic previously on the Express/Vercel /api/* routes now lives
// in Supabase edge functions under .supabase.co/functions/v1/<name>.
import { supabase } from "@/integrations/supabase/client";

export const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface EdgeInit {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string>;
  extraHeaders?: Record<string, string>;
}

export async function callEdge<T = any>(name: string, options: EdgeInit = {}): Promise<T> {
  const { method = "POST", body, query, extraHeaders } = options;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const url = new URL(`${SUPABASE_FUNCTIONS_BASE}/${name}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error((data as any)?.error || `Edge function ${name} failed (${res.status})`);
  }

  return data as T;
}

export const SUPABASE_FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;