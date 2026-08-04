// Shared session-token derivation (Edge + Node compatible via Web Crypto).
// Token = SHA-256(APP_PASSWORD :: APP_SECRET); stored in an httpOnly cookie.
export async function sessionToken() {
  const raw = `${process.env.APP_PASSWORD || ""}::${process.env.APP_SECRET || "rros-v1"}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
