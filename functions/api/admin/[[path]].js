// Admin API. Everything except login requires a valid session cookie.
import { HttpError, json, fail } from "../../../src/lib/http.js";
import { isConfigured, checkPassword, createSession, isAuthed, sessionCookie } from "../../../src/lib/auth.js";

const ICONS = ["visage", "corps", "bebe", "complements", "hygiene", "soins", "bag"];
const KEY_RE = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
const MAX_UPLOAD = 2 * 1024 * 1024;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

/* ---------- validation helpers ---------- */
function text(v, max, label, required = false) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new HttpError(400, `${label} is required`);
  if (s.length > max) throw new HttpError(400, `${label} is too long (max ${max})`);
  return s;
}

function normalizeWhatsapp(v) {
  let d = String(v ?? "").replace(/\D/g, "");
  if (/^0[5-7]\d{8}$/.test(d)) d = "212" + d.slice(1); // 0612345678 -> 212612345678
  if (d.length < 8 || d.length > 15) throw new HttpError(400, "WhatsApp number must be 8-15 digits, e.g. 212612345678");
  return d;
}

async function body(request) {
  try {
    const b = await request.json();
    if (b && typeof b === "object") return b;
  } catch (e) { /* fall through */ }
  throw new HttpError(400, "Invalid JSON body");
}

async function productFields(env, b, partial) {
  const out = {};
  out.name = text(b.name, 120, "Name", true);
  out.brand = text(b.brand, 60, "Brand");
  out.description = text(b.description, 300, "Description");

  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0 || price > 1000000) throw new HttpError(400, "Price must be a number between 0 and 1,000,000");
  out.price = Math.round(price * 100) / 100;

  if (b.category_id === null || b.category_id === "" || b.category_id === undefined) {
    out.category_id = null;
  } else {
    const cid = Number(b.category_id);
    const ok = Number.isInteger(cid) && (await env.DB.prepare("SELECT 1 FROM categories WHERE id = ?").bind(cid).first());
    if (!ok) throw new HttpError(400, "Unknown category");
    out.category_id = cid;
  }

  out.visible = b.visible === false || b.visible === 0 ? 0 : 1;

  if ("image_key" in b) {
    if (b.image_key !== null && !KEY_RE.test(String(b.image_key))) throw new HttpError(400, "Invalid image key");
    out.image_key = b.image_key;
  } else if (!partial) {
    out.image_key = null;
  }
  return out;
}

function duplicateOr(e) {
  return /UNIQUE/i.test(String(e && e.message)) ? new HttpError(409, "A category with this name already exists") : e;
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
    return fail(500, "Server error");
  }
}

async function handle(request, env, path) {
  const method = request.method;
  const url = new URL(request.url);

  if (!isConfigured(env)) {
    throw new HttpError(500, "Admin is not configured: set ADMIN_PASSWORD and SESSION_SECRET (16+ chars)");
  }

  // Cross-site writes are refused outright.
  const origin = request.headers.get("Origin");
  if (method !== "GET" && method !== "HEAD" && origin && origin !== url.origin) throw new HttpError(403, "Forbidden");

  /* --- login (no session needed) --- */
  if (path === "/login" && method === "POST") return login(request, env, url);

  if (!(await isAuthed(env, request))) throw new HttpError(401, "Not signed in");

  if (path === "/logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", url.protocol === "https:") });
  }
  if (path === "/me" && method === "GET") return json({ ok: true });
  if (path === "/data" && method === "GET") return allData(env);

  let m;

  /* --- products --- */
  if (path === "/products" && method === "POST") {
    const f = await productFields(env, await body(request), false);
    const r = await env.DB.prepare(
      "INSERT INTO products (name, brand, category_id, price, description, image_key, visible, created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(f.name, f.brand, f.category_id, f.price, f.description, f.image_key, f.visible, Date.now()).run();
    return json({ id: r.meta.last_row_id }, 201);
  }
  if ((m = path.match(/^\/products\/(\d+)$/))) {
    const id = Number(m[1]);
    const cur = await env.DB.prepare("SELECT image_key FROM products WHERE id = ?").bind(id).first();
    if (!cur) throw new HttpError(404, "Product not found");

    if (method === "PUT") {
      const f = await productFields(env, await body(request), true);
      const newKey = "image_key" in f ? f.image_key : cur.image_key;
      await env.DB.prepare(
        "UPDATE products SET name=?, brand=?, category_id=?, price=?, description=?, image_key=?, visible=? WHERE id=?"
      ).bind(f.name, f.brand, f.category_id, f.price, f.description, newKey, f.visible, id).run();
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
    const label = text(b.label, 40, "Name", true);
    const icon = ICONS.includes(b.icon) ? b.icon : "bag";
    const pos = await env.DB.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM categories").first();
    try {
      const r = await env.DB.prepare("INSERT INTO categories (label, icon, position) VALUES (?,?,?)").bind(label, icon, pos.p).run();
      return json({ id: r.meta.last_row_id }, 201);
    } catch (e) {
      throw duplicateOr(e);
    }
  }
  if ((m = path.match(/^\/categories\/(\d+)$/))) {
    const id = Number(m[1]);
    const cur = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(id).first();
    if (!cur) throw new HttpError(404, "Category not found");

    if (method === "PUT") {
      const b = await body(request);
      const label = text(b.label, 40, "Name", true);
      const icon = ICONS.includes(b.icon) ? b.icon : "bag";
      try {
        await env.DB.prepare("UPDATE categories SET label=?, icon=? WHERE id=?").bind(label, icon, id).run();
      } catch (e) {
        throw duplicateOr(e);
      }
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("UPDATE products SET category_id = NULL WHERE category_id = ?").bind(id),
        env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id)
      ]);
      return json({ ok: true });
    }
  }

  /* --- settings --- */
  if (path === "/settings" && method === "PUT") {
    const b = await body(request);
    const whatsapp = normalizeWhatsapp(b.whatsapp);
    const storeName = text(b.storeName, 40, "Store name", true);
    const hours = text(b.hours, 60, "Hours");
    await env.DB.batch([
      env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('whatsapp', ?)").bind(whatsapp),
      env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('storeName', ?)").bind(storeName),
      env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('hours', ?)").bind(hours)
    ]);
    return json({ ok: true, whatsapp });
  }

  /* --- photo upload: raw image bytes in the request body --- */
  if (path === "/upload" && method === "POST") return upload(request, env);

  throw new HttpError(404, "Not found");
}

async function login(request, env, url) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const now = Date.now();

  await env.DB.prepare("DELETE FROM login_attempts WHERE at < ?").bind(now - 24 * 3600 * 1000).run();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?")
    .bind(ip, now - FAIL_WINDOW_MS).first();
  if (recent.n >= MAX_FAILS) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");

  const b = await body(request);
  if (!(await checkPassword(env, b.password ?? ""))) {
    await env.DB.prepare("INSERT INTO login_attempts (ip, at) VALUES (?, ?)").bind(ip, now).run();
    throw new HttpError(401, "Wrong password");
  }
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(await createSession(env), url.protocol === "https:") });
}

async function allData(env) {
  const [s, c, p] = await env.DB.batch([
    env.DB.prepare("SELECT key, value FROM settings"),
    env.DB.prepare("SELECT id, label, icon, position FROM categories ORDER BY position, id"),
    env.DB.prepare("SELECT id, name, brand, category_id, price, description, image_key, visible FROM products ORDER BY id DESC")
  ]);
  const st = Object.fromEntries(s.results.map((r) => [r.key, r.value]));
  return json({
    settings: { whatsapp: st.whatsapp || "", storeName: st.storeName || "", hours: st.hours || "" },
    categories: c.results,
    products: p.results.map((r) => ({ ...r, visible: !!r.visible }))
  });
}

async function upload(request, env) {
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type];
  if (!ext) throw new HttpError(400, "Photo must be JPEG, PNG or WebP");

  const buf = await request.arrayBuffer();
  if (buf.byteLength === 0) throw new HttpError(400, "Empty file");
  if (buf.byteLength > MAX_UPLOAD) throw new HttpError(413, "Photo is too large (max 2 MB)");

  // Check the real file signature, not just the declared type.
  const b = new Uint8Array(buf.slice(0, 12));
  const isJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (!((ext === "jpg" && isJpg) || (ext === "png" && isPng) || (ext === "webp" && isWebp))) {
    throw new HttpError(400, "File content does not match its type");
  }

  const key = crypto.randomUUID() + "." + ext;
  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: type } });
  return json({ key }, 201);
}
