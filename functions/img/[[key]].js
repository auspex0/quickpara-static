// Serves product photos from R2. Keys are random, so responses can be cached forever.
const KEY_RE = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

export async function onRequestGet({ env, params }) {
  const key = Array.isArray(params.key) ? params.key.join("/") : String(params.key || "");
  if (!KEY_RE.test(key)) return new Response("Not found", { status: 404 });

  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
