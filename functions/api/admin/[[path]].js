// Admin API. Everything except login requires a valid session cookie.
// Error messages are in French: they are shown as-is in the admin.
import { HttpError, json, fail } from "../../../src/lib/http.js";
import { isConfigured, checkPassword, createSession, isAuthed, sessionCookie } from "../../../src/lib/auth.js";

const ICONS = ["visage", "corps", "bebe", "complements", "hygiene", "soins", "bag"];
const KEY_RE = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
const MAX_UPLOAD = 2 * 1024 * 1024;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const SOCIAL_KEYS = ["instagram", "facebook", "maps", "googleBusiness"];
const ORDER_STATUSES = ["new", "confirmed", "delivered", "cancelled"];
const ORDERS_PAGE = 50;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "Bébé & maman" -> "bebe-maman"
function slugify(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "categorie";
}

async function slugTaken(env, slug, exceptId) {
  return !!(await env.DB.prepare("SELECT 1 FROM categories WHERE slug = ? AND id != ?").bind(slug, exceptId || 0).first());
}

async function uniqueSlug(env, base, exceptId) {
  let slug = base, n = 2;
  while (await slugTaken(env, slug, exceptId)) slug = `${base}-${n++}`;
  return slug;
}

// Category address chosen by the owner: validated, must be free.
async function requestedSlug(env, v, exceptId) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s) return null;
  if (s.length > 60 || !SLUG_RE.test(s)) {
    throw new HttpError(400, "L'adresse ne peut contenir que des lettres minuscules sans accent, des chiffres et des tirets (ex. soins-visage)");
  }
  if (await slugTaken(env, s, exceptId)) throw new HttpError(409, "Cette adresse est déjà utilisée par une autre catégorie");
  return s;
}

/* ---------- validation helpers ---------- */
function text(v, max, label, required = false) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new HttpError(400, `${label} est obligatoire`);
  if (s.length > max) throw new HttpError(400, `${label} est trop long (max ${max} caractères)`);
  return s;
}

function money(v, label, { max = 1000000, nullable = false } = {}) {
  if (nullable && (v === null || v === undefined || v === "")) return null;
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isFinite(n) || n < 0 || n > max) {
    throw new HttpError(400, `${label} doit être un nombre entre 0 et ${max.toLocaleString("fr-FR")}`);
  }
  return Math.round(n * 100) / 100;
}

function normalizeWhatsapp(v) {
  let d = String(v ?? "").replace(/\D/g, "");
  if (/^0[5-7]\d{8}$/.test(d)) d = "212" + d.slice(1); // 0612345678 -> 212612345678
  if (d.length < 8 || d.length > 15) throw new HttpError(400, "Le numéro WhatsApp doit comporter 8 à 15 chiffres, par ex. 212612345678");
  return d;
}

// Public links: https only (never javascript:, data:, http:).
function httpsUrl(v, label) {
  const s = text(v, 300, label);
  if (!s) return "";
  let u;
  try { u = new URL(s); } catch (e) { throw new HttpError(400, `${label} : adresse invalide`); }
  if (u.protocol !== "https:") throw new HttpError(400, `${label} : l'adresse doit commencer par https://`);
  return u.toString();
}

async function body(request) {
  try {
    const b = await request.json();
    if (b && typeof b === "object") return b;
  } catch (e) { /* fall through */ }
  throw new HttpError(400, "Requête invalide");
}

// A list of ids that must be exactly the full set of ids in `table`, no duplicates.
async function fullIdList(env, table, ids) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 5000 || !ids.every((i) => Number.isInteger(i) && i > 0)) {
    throw new HttpError(400, "Liste d'identifiants invalide");
  }
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "Identifiants en double");
  const have = await env.DB.prepare(`SELECT id FROM ${table}`).all();
  const set = new Set(have.results.map((r) => r.id));
  if (set.size !== ids.length || !ids.every((i) => set.has(i))) {
    throw new HttpError(409, "La liste a changé entre-temps : rechargez la page");
  }
}

async function productFields(env, b, partial) {
  const out = {};
  out.name = text(b.name, 120, "Le nom", true);
  out.brand = text(b.brand, 60, "La marque");
  out.description = text(b.description, 300, "La description");
  out.price = money(b.price, "Le prix");
  out.old_price = money(b.old_price, "L'ancien prix", { nullable: true });
  if (out.old_price !== null && out.old_price <= out.price) {
    throw new HttpError(400, "L'ancien prix doit être supérieur au prix actuel");
  }

  if (b.category_id === null || b.category_id === "" || b.category_id === undefined) {
    out.category_id = null;
  } else {
    const cid = Number(b.category_id);
    const ok = Number.isInteger(cid) && (await env.DB.prepare("SELECT 1 FROM categories WHERE id = ?").bind(cid).first());
    if (!ok) throw new HttpError(400, "Catégorie inconnue");
    out.category_id = cid;
  }

  out.visible = b.visible === false || b.visible === 0 ? 0 : 1;
  out.is_new = b.is_new === true || b.is_new === 1 ? 1 : 0;
  out.featured = b.featured === true || b.featured === 1 ? 1 : 0;

  if ("image_key" in b) {
    if (b.image_key !== null && !KEY_RE.test(String(b.image_key))) throw new HttpError(400, "Clé d'image invalide");
    out.image_key = b.image_key;
  } else if (!partial) {
    out.image_key = null;
  }
  return out;
}

function duplicateOr(e) {
  return /UNIQUE/i.test(String(e && e.message)) ? new HttpError(409, "Une catégorie porte déjà ce nom") : e;
}

async function removePhoto(env, key) {
  if (key && KEY_RE.test(key)) {
    try { await env.PHOTOS.delete(key); } catch (e) { /* best effort */ }
  }
}

/* ---------- main handler ---------- */
export async function onRequest({ request, env, params }) {
  try {
    return await handle(request, env, "/" + (params.path || []).join("/"));
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, "Erreur du serveur");
  }
}

async function handle(request, env, path) {
  const method = request.method;
  const url = new URL(request.url);

  if (!isConfigured(env)) {
    throw new HttpError(500, "L'administration n'est pas configurée : définissez ADMIN_PASSWORD et SESSION_SECRET (16 caractères minimum)");
  }

  // Cross-site writes are refused outright.
  const origin = request.headers.get("Origin");
  if (method !== "GET" && method !== "HEAD" && origin && origin !== url.origin) throw new HttpError(403, "Interdit");

  /* --- login (no session needed) --- */
  if (path === "/login" && method === "POST") return login(request, env, url);

  if (!(await isAuthed(env, request))) throw new HttpError(401, "Non connecté");

  if (path === "/logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", url.protocol === "https:") });
  }
  if (path === "/me" && method === "GET") return json({ ok: true });
  if (path === "/data" && method === "GET") return allData(env);

  let m;

  /* --- products --- */
  if (path === "/products" && method === "POST") {
    const f = await productFields(env, await body(request), false);
    // New products go to the top: position = lowest existing position - 1.
    const r = await env.DB.prepare(
      "INSERT INTO products (name, brand, category_id, price, old_price, is_new, featured, description, image_key, visible, position, created_at) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?, (SELECT COALESCE(MIN(position), 0) - 1 FROM products), ?)"
    ).bind(f.name, f.brand, f.category_id, f.price, f.old_price, f.is_new, f.featured, f.description, f.image_key, f.visible, Date.now()).run();
    return json({ id: r.meta.last_row_id }, 201);
  }
  if (path === "/products/order" && method === "PUT") {
    const b = await body(request);
    await fullIdList(env, "products", b.ids);
    await env.DB.batch(b.ids.map((id, i) => env.DB.prepare("UPDATE products SET position = ? WHERE id = ?").bind(i, id)));
    return json({ ok: true });
  }
  if ((m = path.match(/^\/products\/(\d+)$/))) {
    const id = Number(m[1]);
    const cur = await env.DB.prepare("SELECT image_key FROM products WHERE id = ?").bind(id).first();
    if (!cur) throw new HttpError(404, "Produit introuvable");

    if (method === "PUT") {
      const f = await productFields(env, await body(request), true);
      const newKey = "image_key" in f ? f.image_key : cur.image_key;
      await env.DB.prepare(
        "UPDATE products SET name=?, brand=?, category_id=?, price=?, old_price=?, is_new=?, featured=?, description=?, image_key=?, visible=? WHERE id=?"
      ).bind(f.name, f.brand, f.category_id, f.price, f.old_price, f.is_new, f.featured, f.description, newKey, f.visible, id).run();
      if (newKey !== cur.image_key) await removePhoto(env, cur.image_key);
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
      await removePhoto(env, cur.image_key);
      return json({ ok: true });
    }
  }

  /* --- categories --- */
  if (path === "/categories" && method === "POST") {
    const b = await body(request);
    const label = text(b.label, 40, "Le nom de la catégorie", true);
    const icon = ICONS.includes(b.icon) ? b.icon : "bag";
    const description = text(b.description, 160, "La description");
    const slug = (await requestedSlug(env, b.slug, 0)) || (await uniqueSlug(env, slugify(label), 0));
    const pos = await env.DB.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM categories").first();
    try {
      const r = await env.DB.prepare("INSERT INTO categories (label, icon, position, slug, description) VALUES (?,?,?,?,?)")
        .bind(label, icon, pos.p, slug, description).run();
      return json({ id: r.meta.last_row_id, slug }, 201);
    } catch (e) {
      throw duplicateOr(e);
    }
  }
  if ((m = path.match(/^\/categories\/(\d+)$/))) {
    const id = Number(m[1]);
    const cur = await env.DB.prepare("SELECT id, slug FROM categories WHERE id = ?").bind(id).first();
    if (!cur) throw new HttpError(404, "Catégorie introuvable");

    if (method === "PUT") {
      const b = await body(request);
      const label = text(b.label, 40, "Le nom de la catégorie", true);
      const icon = ICONS.includes(b.icon) ? b.icon : "bag";
      const description = text(b.description, 160, "La description");
      // Renaming keeps the address (links already shared keep working) unless the owner changes it.
      const slug = (await requestedSlug(env, b.slug, id)) || cur.slug || (await uniqueSlug(env, slugify(label), id));
      try {
        await env.DB.prepare("UPDATE categories SET label=?, icon=?, slug=?, description=? WHERE id=?")
          .bind(label, icon, slug, description, id).run();
      } catch (e) {
        throw duplicateOr(e);
      }
      return json({ ok: true, slug });
    }
    if (method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("UPDATE products SET category_id = NULL WHERE category_id = ?").bind(id),
        env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id)
      ]);
      return json({ ok: true });
    }
  }

  /* --- delivery zones --- */
  if (path === "/zones" && method === "POST") {
    const f = zoneFields(await body(request));
    const pos = await env.DB.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM delivery_zones").first();
    const r = await env.DB.prepare("INSERT INTO delivery_zones (label, fee, free_from, position) VALUES (?,?,?,?)")
      .bind(f.label, f.fee, f.free_from, pos.p).run();
    return json({ id: r.meta.last_row_id }, 201);
  }
  if (path === "/zones/order" && method === "PUT") {
    const b = await body(request);
    await fullIdList(env, "delivery_zones", b.ids);
    await env.DB.batch(b.ids.map((id, i) => env.DB.prepare("UPDATE delivery_zones SET position = ? WHERE id = ?").bind(i, id)));
    return json({ ok: true });
  }
  if ((m = path.match(/^\/zones\/(\d+)$/))) {
    const id = Number(m[1]);
    const cur = await env.DB.prepare("SELECT id FROM delivery_zones WHERE id = ?").bind(id).first();
    if (!cur) throw new HttpError(404, "Zone introuvable");
    if (method === "PUT") {
      const f = zoneFields(await body(request));
      await env.DB.prepare("UPDATE delivery_zones SET label=?, fee=?, free_from=? WHERE id=?").bind(f.label, f.fee, f.free_from, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM delivery_zones WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
  }

  /* --- orders --- */
  if (path === "/orders" && method === "GET") return listOrders(env, url);
  if ((m = path.match(/^\/orders\/(\d+)$/)) && method === "PUT") {
    const b = await body(request);
    if (!ORDER_STATUSES.includes(b.status)) throw new HttpError(400, "Statut inconnu");
    const r = await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(b.status, Number(m[1])).run();
    if (!r.meta.changes) throw new HttpError(404, "Commande introuvable");
    return json({ ok: true });
  }

  /* --- settings (the admin always sends every field; omitted optional fields are cleared) --- */
  if (path === "/settings" && method === "PUT") {
    const b = await body(request);
    const whatsapp = normalizeWhatsapp(b.whatsapp);
    const storeName = text(b.storeName, 40, "Le nom du magasin", true);
    const hours = text(b.hours, 60, "Les horaires");
    const minOrder = money(b.minOrder, "La commande minimum", { max: 100000, nullable: true });

    const stmts = [
      env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('whatsapp', ?)").bind(whatsapp),
      env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('storeName', ?)").bind(storeName),
      env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('hours', ?)").bind(hours)
    ];
    const optional = { minOrder: minOrder ? String(minOrder) : "" };
    const labels = { instagram: "Instagram", facebook: "Facebook", maps: "Google Maps", googleBusiness: "Google Business" };
    for (const k of SOCIAL_KEYS) optional[k] = httpsUrl(b[k], labels[k]);
    for (const [k, v] of Object.entries(optional)) {
      stmts.push(v
        ? env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(k, v)
        : env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(k));
    }
    await env.DB.batch(stmts);
    return json({ ok: true, whatsapp });
  }

  /* --- photo upload: raw image bytes in the request body --- */
  if (path === "/upload" && method === "POST") return upload(request, env);

  throw new HttpError(404, "Introuvable");
}

function zoneFields(b) {
  return {
    label: text(b.label, 60, "Le nom de la zone", true),
    fee: money(b.fee, "Le tarif", { max: 100000 }),
    free_from: money(b.free_from, "Le seuil de livraison gratuite", { max: 1000000, nullable: true })
  };
}

async function login(request, env, url) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const now = Date.now();

  await env.DB.prepare("DELETE FROM login_attempts WHERE at < ?").bind(now - 24 * 3600 * 1000).run();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?")
    .bind(ip, now - FAIL_WINDOW_MS).first();
  if (recent.n >= MAX_FAILS) throw new HttpError(429, "Trop de tentatives. Réessayez dans 15 minutes.");

  const b = await body(request);
  if (!(await checkPassword(env, b.password ?? ""))) {
    await env.DB.prepare("INSERT INTO login_attempts (ip, at) VALUES (?, ?)").bind(ip, now).run();
    throw new HttpError(401, "Mot de passe incorrect");
  }
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(await createSession(env), url.protocol === "https:") });
}

async function listOrders(env, url) {
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);

  const where = [], args = [];
  if (status) {
    if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, "Statut inconnu");
    where.push("status = ?");
    args.push(status);
  }
  if (q) {
    const like = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    const num = q.match(/^(?:qp\s*-?\s*)?(\d+)$/i);
    if (num && Number(num[1]) > 1000) {
      where.push("(id = ? OR customer_name LIKE ? ESCAPE '\\')");
      args.push(Number(num[1]) - 1000, like);
    } else {
      where.push("customer_name LIKE ? ESCAPE '\\'");
      args.push(like);
    }
  }
  const W = where.length ? "WHERE " + where.join(" AND ") : "";

  const [rows, total, counts] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, created_at, status, customer_name, zone_label, city, note, subtotal, delivery_fee, total FROM orders ${W} ORDER BY id DESC LIMIT ${ORDERS_PAGE} OFFSET ?`
    ).bind(...args, (page - 1) * ORDERS_PAGE),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM orders ${W}`).bind(...args),
    env.DB.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status")
  ]);

  const ids = rows.results.map((o) => o.id);
  const items = ids.length
    ? (await env.DB.prepare(`SELECT order_id, product_id, name, unit_price, qty FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results
    : [];
  const n = total.results[0].n;
  return json({
    orders: rows.results.map((o) => ({ ...o, number: "QP-" + (1000 + o.id), items: items.filter((i) => i.order_id === o.id) })),
    total: n,
    page,
    pages: Math.max(1, Math.ceil(n / ORDERS_PAGE)),
    counts: Object.fromEntries(ORDER_STATUSES.map((s) => [s, (counts.results.find((c) => c.status === s) || { n: 0 }).n]))
  });
}

async function allData(env) {
  const [s, c, p, z] = await env.DB.batch([
    env.DB.prepare("SELECT key, value FROM settings"),
    env.DB.prepare("SELECT id, label, icon, position, slug, description FROM categories ORDER BY position, id"),
    env.DB.prepare(
      "SELECT id, name, brand, category_id, price, old_price, is_new, featured, description, image_key, visible " +
      "FROM products ORDER BY featured DESC, position ASC, id DESC"
    ),
    env.DB.prepare("SELECT id, label, fee, free_from, position FROM delivery_zones ORDER BY position, id")
  ]);
  const st = Object.fromEntries(s.results.map((r) => [r.key, r.value]));
  return json({
    settings: {
      whatsapp: st.whatsapp || "", storeName: st.storeName || "", hours: st.hours || "",
      minOrder: st.minOrder ? Number(st.minOrder) : null,
      instagram: st.instagram || "", facebook: st.facebook || "", maps: st.maps || "", googleBusiness: st.googleBusiness || ""
    },
    categories: c.results,
    zones: z.results,
    products: p.results.map((r) => ({ ...r, visible: !!r.visible, is_new: !!r.is_new, featured: !!r.featured }))
  });
}

async function upload(request, env) {
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type];
  if (!ext) throw new HttpError(400, "La photo doit être au format JPEG, PNG ou WebP");

  const buf = await request.arrayBuffer();
  if (buf.byteLength === 0) throw new HttpError(400, "Fichier vide");
  if (buf.byteLength > MAX_UPLOAD) throw new HttpError(413, "La photo est trop lourde (2 Mo maximum)");

  // Check the real file signature, not just the declared type.
  const b = new Uint8Array(buf.slice(0, 12));
  const isJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (!((ext === "jpg" && isJpg) || (ext === "png" && isPng) || (ext === "webp" && isWebp))) {
    throw new HttpError(400, "Le contenu du fichier ne correspond pas à son type");
  }

  const key = crypto.randomUUID() + "." + ext;
  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: type } });
  return json({ key }, 201);
}
