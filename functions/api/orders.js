// Public order endpoint: anyone can call it, so everything is validated and rate limited.
// Prices are always read from the database; prices sent by the browser are ignored.
import { HttpError, json, fail } from "../../src/lib/http.js";
import { deliveryFee, toCents, formatMad } from "../../src/lib/delivery.js";

const MAX_LINES = 50;
const MAX_QTY = 99;
const ORDERS_PER_HOUR = 10;
const HOUR = 3600 * 1000;

function text(v, max, label, keepLines = false) {
  let s = typeof v === "string" ? v.trim() : "";
  if (!keepLines) s = s.replace(/\s+/g, " ");
  if (s.length > max) throw new HttpError(400, `${label} est trop long (max ${max} caractères)`);
  return s;
}

export async function onRequestPost({ request, env }) {
  try {
    return await createOrder(request, env);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status);
    console.error(e);
    return fail(500, "Erreur du serveur");
  }
}

async function createOrder(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) throw new HttpError(403, "Interdit");
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) throw new HttpError(400, "Requête invalide");

  let b;
  try { b = await request.json(); } catch (e) { b = null; }
  if (!b || typeof b !== "object") throw new HttpError(400, "Requête invalide");

  // Rate limit first: cheap, and protects the free daily write budget.
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const bucket = "order:" + ip;
  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND at > ?")
    .bind(bucket, now - HOUR).first();
  if (recent.n >= ORDERS_PER_HOUR) {
    throw new HttpError(429, "Trop de commandes en peu de temps. Réessayez plus tard ou écrivez-nous sur WhatsApp.");
  }

  const items = b.items;
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "Le panier est vide");
  if (items.length > MAX_LINES) throw new HttpError(400, `Trop de produits dans une seule commande (max ${MAX_LINES} lignes)`);
  const qtyById = new Map();
  for (const it of items) {
    const id = Number(it && it.id), qty = Number(it && it.qty);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Produit invalide");
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError(400, `Quantité invalide (1 à ${MAX_QTY})`);
    if (qtyById.has(id)) throw new HttpError(400, "Produit en double dans la commande");
    qtyById.set(id, qty);
  }
  const name = text(b.name, 80, "Le nom");
  const city = text(b.city, 80, "La ville");
  const note = text(b.note, 300, "Les précisions", true);

  const ids = [...qtyById.keys()];
  const [prodRes, zoneRes, minRes] = await env.DB.batch([
    env.DB.prepare(`SELECT id, name, price FROM products WHERE visible = 1 AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids),
    env.DB.prepare("SELECT id, label, fee, free_from FROM delivery_zones"),
    env.DB.prepare("SELECT value FROM settings WHERE key = 'minOrder'")
  ]);

  const byId = new Map(prodRes.results.map((p) => [p.id, p]));
  const unavailable = ids.filter((id) => !byId.has(id));
  if (unavailable.length) {
    const err = new HttpError(400, "Certains produits ne sont plus disponibles. Le catalogue a été mis à jour, vérifiez votre panier.");
    err.extra = { unavailable };
    throw err;
  }

  let zone = null;
  if (zoneRes.results.length) {
    zone = zoneRes.results.find((z) => z.id === Number(b.zone_id)) || null;
    if (!zone) throw new HttpError(400, "Choisissez une zone de livraison");
  }

  const lines = ids.map((id) => {
    const p = byId.get(id), qty = qtyById.get(id), unitC = toCents(p.price);
    return { product_id: id, name: p.name, unit_c: unitC, qty, line_c: unitC * qty };
  });
  const subC = lines.reduce((s, l) => s + l.line_c, 0);
  const subtotal = subC / 100;

  const minOrder = minRes.results[0] ? Number(minRes.results[0].value) : 0;
  if (minOrder > 0 && subtotal < minOrder) throw new HttpError(400, `Minimum de commande : ${formatMad(minOrder)}`);

  const feeC = toCents(deliveryFee(zone, subtotal));
  const total = (subC + feeC) / 100;
  const ref = crypto.randomUUID();

  // One batch = one transaction: the order, its lines and the rate-limit mark are saved together or not at all.
  const res = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO orders (ref, created_at, status, customer_name, zone_label, city, note, subtotal, delivery_fee, total) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(ref, now, "new", name, zone ? zone.label : "", city, note, subtotal, feeC / 100, total),
    ...lines.map((l) => env.DB.prepare(
      "INSERT INTO order_items (order_id, product_id, name, unit_price, qty) VALUES ((SELECT id FROM orders WHERE ref = ?), ?, ?, ?, ?)"
    ).bind(ref, l.product_id, l.name, l.unit_c / 100, l.qty)),
    env.DB.prepare("INSERT INTO rate_limits (bucket, at) VALUES (?, ?)").bind(bucket, now),
    env.DB.prepare("DELETE FROM rate_limits WHERE at < ?").bind(now - 24 * HOUR),
    env.DB.prepare("SELECT id FROM orders WHERE ref = ?").bind(ref)
  ]);
  const id = res[res.length - 1].results[0].id;

  return json({
    number: "QP-" + (1000 + id),
    lines: lines.map((l) => ({ name: l.name, qty: l.qty, unitPrice: l.unit_c / 100, lineTotal: l.line_c / 100 })),
    subtotal,
    deliveryFee: feeC / 100,
    total,
    zone: zone ? zone.label : null
  }, 201);
}
