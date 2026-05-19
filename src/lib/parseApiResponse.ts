/** Parse a fetch Response as JSON, with safe handling for non-JSON error pages (e.g. Vercel 500 HTML). */
export async function parseApiJson<T extends Record<string, unknown>>(
  res: Response
): Promise<{ ok: boolean; data: T | null; error?: string }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
    return {
      ok: false,
      data: null,
      error: snippet || `Request failed (${res.status})`,
    };
  }

  const data = (await res.json()) as T;
  if (!res.ok) {
    const message =
      typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
    return { ok: false, data, error: message };
  }

  return { ok: true, data };
}
