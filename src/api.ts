/**
 * Calls to the BMS API, served from this site's own hostname at /api/*.
 *
 * Every request carries the signed-in user's ID token; the function verifies
 * it against the BMS user pool. POSTs also carry the body's SHA-256: CloudFront
 * signs requests to the function with Origin Access Control, and for POST that
 * signature covers the body.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function api<T>(
  path: string,
  idToken: string | null,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  // Not `Authorization`: CloudFront replaces that header with its own SigV4
  // signature for the function URL, so the token would never arrive.
  if (idToken) headers["x-id-token"] = idToken;

  let body: string | undefined;
  if (init.body !== undefined) {
    body = JSON.stringify(init.body);
    headers["content-type"] = "application/json";
    headers["x-amz-content-sha256"] = await sha256Hex(body);
  }

  const response = await fetch(`/api${path}`, { method, headers, body });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status);
  }
  return payload;
}
