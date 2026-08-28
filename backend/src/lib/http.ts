import { env } from "./env.ts";

/** Keep the timeout active through body consumption, not just response headers. */
export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(env.EXTERNAL_REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Externer Dienst antwortet mit HTTP ${response.status}`);
  return response.text();
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  return JSON.parse(await fetchText(url, init)) as T;
}
