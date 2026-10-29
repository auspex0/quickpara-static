// Server-side SEO for the storefront. The shop itself is drawn by JavaScript in the browser, so the first HTML
// a search engine downloads would otherwise have no products and the same title on every page. Here we edit
// that HTML on the way out: title, description, canonical address, Open Graph tags and JSON-LD product data.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// JSON that is safe inside <script>: a product named "</script>" cannot close the tag.
const SCRIPT_UNSAFE = new RegExp("[<>&" + String.fromCharCode(0x2028, 0x2029) + "]", "g");
export const jsonForScript = (o) =>
  JSON.stringify(o).replace(SCRIPT_UNSAFE, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

// _headers only applies to static files, so pages built here set their own.
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

const PAGE_TTL = 300; // seconds an edge copy of a generated page is reused
const MAX_LD_PRODUCTS = 100;

export function siteUrl(env, request) {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
}

// Edge cache (Cloudflare Cache API). Skipped on the local dev server so tests always see fresh data.
export function edgeCache(request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" ? null : caches.default;
}

async function loadData(env) {
  const [s, c, p] = await env.DB.batch([
    env.DB.prepare("SELECT key, value FROM settings"),
    env.DB.prepare("SELECT id, label, slug, description FROM categories ORDER BY position, id"),
    env.DB.prepare(
      "SELECT id, name, brand, category_id, price, description, image_key FROM products WHERE visible = 1 " +
      "ORDER BY featured DESC, position ASC, id DESC"
    )
  ]);
  return {
    settings: Object.fromEntries(s.results.map((r) => [r.key, r.value])),
    categories: c.results,
    products: p.results
  };
}

function productLd(p, site, pageUrl) {
  const node = {
    "@type": "Product",
    name: p.name,
    offers: {
      "@type": "Offer",
      price: Number(p.price).toFixed(2),
      priceCurrency: "MAD",
      availability: "https://schema.org/InStock",
      url: pageUrl
    }
  };
  if (p.brand) node.brand = { "@type": "Brand", name: p.brand };
  if (p.description) node.description = p.description;
  if (p.image_key) node.image = site + "/img/" + p.image_key;
  return node;
}

function notFoundPage(site) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page introuvable — QuickPara</title><meta name="robots" content="noindex"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#fbfdfc;color:#12302d;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center}a{display:inline-block;margin-top:12px;padding:12px 22px;border-radius:999px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700}</style>
</head><body><main><h1>Page introuvable</h1><p>Cette catégorie n'existe pas ou a changé d'adresse.</p><a href="${escHtml(site)}/">Voir tous les produits</a></main></body></html>`;
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS } });
}

// slug === null -> home page; otherwise the page of one category (/c/<slug>).
export async function renderShop(context, slug) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cache = edgeCache(request);
  const key = new Request(url.origin + url.pathname, { method: "GET" });
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return forBrowser(hit);
  }

  const site = siteUrl(env, request);
  const data = await loadData(env);
  const store = data.settings.storeName || "QuickPara";

  let category = null;
  if (slug !== null) {
    category = data.categories.find((c) => c.slug === slug);
    if (!category) return notFoundPage(site);
  }

  const pageUrl = category ? `${site}/c/${category.slug}` : `${site}/`;
  const products = (category ? data.products.filter((p) => p.category_id === category.id) : data.products).slice(0, MAX_LD_PRODUCTS);

  const title = category
    ? `${category.label} — ${store} | Parapharmacie au Maroc`
    : `${store} — Parapharmacie & produits paramédicaux au Maroc`;
  const description = category
    ? (category.description ||
       `${category.label} : ${products.length} produit${products.length > 1 ? "s" : ""} de parapharmacie chez ${store}. Commande simple par WhatsApp, livraison au Maroc.`)
    : "Commandez vos produits de parapharmacie et paramédicaux en quelques clics, directement par WhatsApp. Livraison rapide au Maroc.";

  const sameAs = ["instagram", "facebook", "maps", "googleBusiness"]
    .map((k) => data.settings[k]).filter((v) => typeof v === "string" && v.startsWith("https://"));
  const graph = [];
  if (!category) {
    const storeNode = { "@type": "Store", name: store, url: `${site}/`, address: { "@type": "PostalAddress", addressCountry: "MA" } };
    if (data.settings.whatsapp) storeNode.telephone = "+" + data.settings.whatsapp;
    if (sameAs.length) storeNode.sameAs = sameAs;
    graph.push(storeNode);
  }
  graph.push({
    "@type": "ItemList",
    name: category ? category.label : `Produits ${store}`,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, item: productLd(p, site, pageUrl) }))
  });
  const ld = { "@context": "https://schema.org", "@graph": graph };

  const asset = await env.ASSETS.fetch(new Request(new URL("/", url), { headers: { Accept: "text/html" } }));
  const meta = (attr, name, value) => `<meta ${attr}="${name}" content="${escHtml(value)}">`;

  const rewritten = new HTMLRewriter()
    .on("title", { element(e) { e.setInnerContent(title); } })
    .on('meta[name="description"]', { element(e) { e.replace(meta("name", "description", description), { html: true }); } })
    .on('meta[property="og:title"]', { element(e) { e.replace(meta("property", "og:title", title), { html: true }); } })
    .on('meta[property="og:description"]', { element(e) { e.replace(meta("property", "og:description", description), { html: true }); } })
    .on('meta[property="og:url"]', { element(e) { e.replace(meta("property", "og:url", pageUrl), { html: true }); } })
    .on("head", {
      element(e) {
        e.append(`<link rel="canonical" href="${escHtml(pageUrl)}">\n<script type="application/ld+json">${jsonForScript(ld)}</script>\n`, { html: true });
      }
    })
    .transform(asset);

  // The edge copy lives PAGE_TTL seconds; browsers always re-check, so the owner never sees a stale page after an edit.
  const edgeCopy = new Response(rewritten.body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": `public, max-age=${PAGE_TTL}`, ...SECURITY_HEADERS }
  });
  if (cache) context.waitUntil(cache.put(key, edgeCopy.clone()));
  return forBrowser(edgeCopy);
}

function forBrowser(res) {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "no-cache");
  return new Response(res.body, { status: res.status, headers });
}
