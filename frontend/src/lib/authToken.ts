// Shared single-password gate helper. The cookie never stores the raw
// password — it stores a SHA-256 token derived from it. Edge- and Node-safe
// (uses the global Web Crypto API).

export const AUTH_COOKIE = "app_auth";

export async function expectedAuthToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`receiptsys:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
