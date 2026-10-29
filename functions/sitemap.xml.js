// List of pages for search engines: home + every category that has an address.
import { siteUrl, edgeCache, escHtml } from "../src/lib/seo.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const cache = edgeCache(request);
  const key = new Request(new URL(request.url).origin + "/sitemap.xml", { method: "GET" });
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const site = siteUrl(env, request);
  const cats = await env.DB.prepare("SELECT slug FROM categories WHERE slug IS NOT NULL ORDER BY position, id").all();
  const urls = [`${site}/`, ...cats.results.map((c) => `${site}/c/${c.slug}`)];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${escHtml(u)}</loc></url>`).join("\n") + "\n</urlset>\n";

  const res = new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" }
  });
  if (cache) context.waitUntil(cache.put(key, res.clone()));
  return res;
}
