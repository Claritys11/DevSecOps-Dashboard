"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** fetch wrapper that always resolves, with the server's error message when there is one. */
export async function api<T = unknown>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const json = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
    if (!response.ok) {
      const error = typeof json?.error === "string" ? json.error : `Request failed (${response.status})`;
      return { ok: false, error };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Cannot reach the dashboard. Check your connection." };
  }
}
