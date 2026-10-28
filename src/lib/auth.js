const enc = new TextEncoder();
const SESSION_MS = 7 * 24 * 3600 * 1000;
export const COOKIE = "qp_session";

function b64url(buf) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Both secrets must be set; the session secret must be long enough to be a real secret.
export function isConfigured(env) {
  return Boolean(env.ADMIN_PASSWORD) && Boolean(env.SESSION_SECRET) && env.SESSION_SECRET.length >= 16;
}

export async function checkPassword(env, input) {
  const sha = async (s) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return safeEqual(await sha(String(input)), await sha(env.ADMIN_PASSWORD));
}

export async function createSession(env) {
  const exp = String(Date.now() + SESSION_MS);
  return exp + "." + (await hmac(env.SESSION_SECRET, exp));
}

export async function isAuthed(env, request) {
  const raw = request.headers.get("Cookie") || "";
  const match = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!match) return false;
  const [exp, sig] = match.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  return safeEqual(sig, await hmac(env.SESSION_SECRET, exp));
}

export function sessionCookie(value, secure) {
  const maxAge = value ? Math.floor(SESSION_MS / 1000) : 0;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (secure ? "; Secure" : "");
}
