// API tests. Needs the dev server running:  npm run dev   (in another terminal)
// Then:  npm test
// Override with BASE_URL / TEST_ADMIN_PASSWORD if needed (defaults read .dev.vars).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";

function devVar(name) {
  try {
    const m = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(new RegExp("^" + name + "=(.*)$", "m"));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}
const PASSWORD = process.env.TEST_ADMIN_PASSWORD || devVar("ADMIN_PASSWORD");

let cookie = "";
const createdProducts = [];
const createdCategories = [];
const createdZones = [];

async function call(method, path, { body, raw, type, headers = {}, auth = true } = {}) {
  const h = { ...headers };
  if (auth && cookie) h.Cookie = cookie;
  let payload;
  if (raw !== undefined) { payload = raw; h["Content-Type"] = type; }
  else if (body !== undefined) { payload = JSON.stringify(body); h["Content-Type"] = "application/json"; }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { res, status: res.status, json, text };
}

const admin = (m, p, o) => call(m, "/api/admin" + p, o);
const catalog = async () => (await call("GET", "/api/catalog", { auth: false })).json;
const product = (over = {}) => ({ name: "TEST product " + Math.random().toString(36).slice(2, 7), brand: "T", price: 10, description: "d", category_id: null, visible: true, ...over });

// Smallest thing the server accepts as a JPEG (it checks the real file signature).
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1), Buffer.from([0xff, 0xd9])]);

before(async () => {
  assert.ok(PASSWORD, "No admin password: set TEST_ADMIN_PASSWORD or create .dev.vars");
  const r = await admin("POST", "/login", { body: { password: PASSWORD }, auth: false });
  assert.equal(r.status, 200, "login with the real password must work: " + r.text);
  cookie = r.res.headers.getSetCookie()[0].split(";")[0];
});

after(async () => {
  for (const id of createdProducts) await admin("DELETE", "/products/" + id);
  for (const id of createdCategories) await admin("DELETE", "/categories/" + id);
  for (const id of createdZones) await admin("DELETE", "/zones/" + id);
});

test("admin API refuses requests without a session", async () => {
  for (const [m, p] of [["GET", "/data"], ["POST", "/products"], ["PUT", "/settings"], ["POST", "/upload"], ["DELETE", "/products/1"]]) {
    const r = await admin(m, p, { auth: false, body: m === "GET" ? undefined : {} });
    assert.equal(r.status, 401, `${m} ${p} should be 401, got ${r.status}`);
  }
});

test("a forged or tampered session cookie is refused", async () => {
  const r = await admin("GET", "/data", { auth: false, headers: { Cookie: "qp_session=9999999999999.forgedsignature" } });
  assert.equal(r.status, 401);
});

test("wrong password is refused, correct one works", async () => {
  const bad = await admin("POST", "/login", { body: { password: "definitely-wrong" }, auth: false, headers: { "CF-Connecting-IP": "test-" + Date.now() } });
  assert.equal(bad.status, 401);
  assert.ok(!bad.res.headers.get("set-cookie"), "no cookie on failed login");
  const ok = await admin("GET", "/me");
  assert.equal(ok.status, 200);
});

test("login is rate limited after 5 failures (per IP)", async () => {
  const ip = { "CF-Connecting-IP": "198.51.100." + (1 + Math.floor(Math.random() * 250)) + "-" + Date.now() };
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await admin("POST", "/login", { body: { password: "nope" }, auth: false, headers: ip })).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
  const right = await admin("POST", "/login", { body: { password: PASSWORD }, auth: false, headers: ip });
  assert.equal(right.status, 429, "even the right password is blocked while locked out");
});

test("product: validation rejects bad input", async () => {
  assert.equal((await admin("POST", "/products", { body: product({ name: "  " }) })).status, 400, "empty name");
  assert.equal((await admin("POST", "/products", { body: product({ price: -5 }) })).status, 400, "negative price");
  assert.equal((await admin("POST", "/products", { body: product({ price: "abc" }) })).status, 400, "non-numeric price");
  assert.equal((await admin("POST", "/products", { body: product({ category_id: 999999 }) })).status, 400, "unknown category");
  assert.equal((await admin("POST", "/products", { body: product({ image_key: "../../etc/passwd" }) })).status, 400, "bad image key");
});

test("product: create, edit, hide, show, delete — and the public catalogue follows", async () => {
  const body = product({ name: "TEST lifecycle", price: 49.5, category_id: (await catalog()).categories[0].id });
  const c = await admin("POST", "/products", { body });
  assert.equal(c.status, 201);
  const id = c.json.id;
  createdProducts.push(id);

  let found = (await catalog()).products.find((p) => p.id === id);
  assert.ok(found, "new visible product appears publicly");
  assert.equal(found.price, 49.5);

  assert.equal((await admin("PUT", "/products/" + id, { body: { ...body, price: 55, name: "TEST lifecycle 2" } })).status, 200);
  found = (await catalog()).products.find((p) => p.id === id);
  assert.equal(found.price, 55);
  assert.equal(found.name, "TEST lifecycle 2");

  await admin("PUT", "/products/" + id, { body: { ...body, visible: false } });
  assert.ok(!(await catalog()).products.some((p) => p.id === id), "hidden product must NOT appear publicly");
  assert.ok((await admin("GET", "/data")).json.products.some((p) => p.id === id), "hidden product still visible to admin");

  await admin("PUT", "/products/" + id, { body: { ...body, visible: true } });
  assert.ok((await catalog()).products.some((p) => p.id === id));

  assert.equal((await admin("DELETE", "/products/" + id)).status, 200);
  assert.ok(!(await catalog()).products.some((p) => p.id === id));
  assert.equal((await admin("DELETE", "/products/" + id)).status, 404);
});

test("photo: upload, serve, replace and delete clean up the file", async () => {
  const up = await admin("POST", "/upload", { raw: JPEG, type: "image/jpeg" });
  assert.equal(up.status, 201);
  const key = up.json.key;
  assert.match(key, /^[a-f0-9-]{36}\.jpg$/);

  const img = await fetch(BASE + "/img/" + key);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.equal((await img.arrayBuffer()).byteLength, JPEG.length);

  const c = await admin("POST", "/products", { body: product({ image_key: key }) });
  createdProducts.push(c.json.id);
  assert.equal((await catalog()).products.find((p) => p.id === c.json.id).image, "/img/" + key);

  // replace photo -> old file removed
  const key2 = (await admin("POST", "/upload", { raw: JPEG, type: "image/jpeg" })).json.key;
  await admin("PUT", "/products/" + c.json.id, { body: { ...product(), image_key: key2 } });
  assert.equal((await fetch(BASE + "/img/" + key)).status, 404, "old photo deleted on replace");
  assert.equal((await fetch(BASE + "/img/" + key2)).status, 200);

  // delete product -> photo removed
  await admin("DELETE", "/products/" + c.json.id);
  assert.equal((await fetch(BASE + "/img/" + key2)).status, 404, "photo deleted with product");
});

test("photo: rejects wrong type, fake content, oversize, empty", async () => {
  assert.equal((await admin("POST", "/upload", { raw: JPEG, type: "text/html" })).status, 400, "html type");
  assert.equal((await admin("POST", "/upload", { raw: Buffer.from("<script>alert(1)</script>"), type: "image/jpeg" })).status, 400, "html disguised as jpeg");
  assert.equal((await admin("POST", "/upload", { raw: JPEG, type: "image/png" })).status, 400, "jpeg bytes declared as png");
  assert.equal((await admin("POST", "/upload", { raw: Buffer.alloc(0), type: "image/jpeg" })).status, 400, "empty");
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2 * 1024 * 1024 + 10)]);
  assert.equal((await admin("POST", "/upload", { raw: big, type: "image/jpeg" })).status, 413, "over 2 MB");
});

test("image route rejects odd keys", async () => {
  assert.equal((await fetch(BASE + "/img/..%2F..%2Fsecret")).status, 404);
  assert.equal((await fetch(BASE + "/img/not-a-real-key.jpg")).status, 404);
});

test("categories: create, duplicate refused, delete leaves products uncategorised", async () => {
  const label = "TEST cat " + Math.random().toString(36).slice(2, 7);
  const c = await admin("POST", "/categories", { body: { label, icon: "soins" } });
  assert.equal(c.status, 201);
  createdCategories.push(c.json.id);
  assert.equal((await admin("POST", "/categories", { body: { label, icon: "soins" } })).status, 409, "duplicate name");
  assert.equal((await admin("POST", "/categories", { body: { label: " ", icon: "soins" } })).status, 400, "empty name");

  const p = await admin("POST", "/products", { body: product({ category_id: c.json.id }) });
  createdProducts.push(p.json.id);
  assert.equal((await admin("DELETE", "/categories/" + c.json.id)).status, 200);
  const after = (await admin("GET", "/data")).json.products.find((x) => x.id === p.json.id);
  assert.equal(after.category_id, null, "product kept, category cleared");
});

test("settings: Moroccan 06 number is normalised, junk refused, catalogue reflects it", async () => {
  const before = (await admin("GET", "/data")).json.settings;
  try {
    const ok = await admin("PUT", "/settings", { body: { whatsapp: "06 12 34 56 78", storeName: "QuickPara", hours: "9h-20h" } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.whatsapp, "212612345678");
    assert.equal((await catalog()).settings.whatsapp, "212612345678");
    assert.equal((await admin("PUT", "/settings", { body: { whatsapp: "abc", storeName: "X", hours: "" } })).status, 400);
    assert.equal((await admin("PUT", "/settings", { body: { whatsapp: "212612345678", storeName: "", hours: "" } })).status, 400);
  } finally {
    await admin("PUT", "/settings", { body: before });
  }
});

test("cross-site writes are refused", async () => {
  const r = await admin("POST", "/products", { body: product(), headers: { Origin: "https://evil.example" } });
  assert.equal(r.status, 403);
});

test("public catalogue never leaks admin-only data", async () => {
  const c = await catalog();
  assert.ok(Array.isArray(c.products) && Array.isArray(c.categories));
  for (const p of c.products) assert.ok(!("visible" in p) && !("image_key" in p) && !("featured" in p), "no internal fields");
});

/* ======================= v2 features ======================= */

const dataNow = async () => (await admin("GET", "/data")).json;
// Settings are replaced as a whole: always send the full set back.
const settingsBody = (s, over = {}) => ({ ...s, ...over });

test("C promo: old price must be higher than the price; promo fields reach the catalogue", async () => {
  assert.equal((await admin("POST", "/products", { body: product({ price: 100, old_price: 100 }) })).status, 400, "equal");
  assert.equal((await admin("POST", "/products", { body: product({ price: 100, old_price: 80 }) })).status, 400, "lower");
  assert.equal((await admin("POST", "/products", { body: product({ price: 100, old_price: "abc" }) })).status, 400, "not a number");
  assert.equal((await admin("POST", "/products", { body: product({ price: 100, old_price: -5 }) })).status, 400, "negative");

  const body = product({ price: 150, old_price: 200, is_new: true });
  const c = await admin("POST", "/products", { body });
  assert.equal(c.status, 201);
  createdProducts.push(c.json.id);
  let p = (await catalog()).products.find((x) => x.id === c.json.id);
  assert.equal(p.oldPrice, 200);
  assert.equal(p.isNew, true);
  assert.equal(p.price, 150, "the real price is untouched");

  // clearing the old price removes the promo
  assert.equal((await admin("PUT", "/products/" + c.json.id, { body: { ...body, old_price: null, is_new: false } })).status, 200);
  p = (await catalog()).products.find((x) => x.id === c.json.id);
  assert.equal(p.oldPrice, null);
  assert.equal(p.isNew, false);
  // raising the price above the old one is refused on update too
  assert.equal((await admin("PUT", "/products/" + c.json.id, { body: { ...body, price: 250, old_price: 200 } })).status, 400);
});

test("D order: new products first, featured always first, reorder persists and is validated", async () => {
  const mk = async (n) => {
    const body = product({ name: "TEST order " + n });
    const r = await admin("POST", "/products", { body });
    createdProducts.push(r.json.id);
    return { id: r.json.id, body };
  };
  const a = await mk("a"), b = await mk("b"), c = await mk("c");
  const idx = async (id) => (await catalog()).products.findIndex((p) => p.id === id);

  assert.ok((await idx(c.id)) < (await idx(b.id)) && (await idx(b.id)) < (await idx(a.id)), "newest first");

  // featured jumps to the top, whatever its position
  assert.equal((await admin("PUT", "/products/" + a.id, { body: { ...a.body, featured: true } })).status, 200);
  assert.equal(await idx(a.id), 0, "featured first");
  assert.ok((await dataNow()).products[0].featured, "admin list uses the same order");

  // swap b and c in the full list, as the arrows do
  const all = (await dataNow()).products.map((p) => p.id);
  const i = all.indexOf(b.id), j = all.indexOf(c.id);
  [all[i], all[j]] = [all[j], all[i]];
  assert.equal((await admin("PUT", "/products/order", { body: { ids: all } })).status, 200);
  assert.ok((await idx(b.id)) < (await idx(c.id)), "reorder persisted");
  assert.deepEqual((await dataNow()).products.map((p) => p.id), all, "admin sees the saved order");

  // validation
  assert.equal((await admin("PUT", "/products/order", { body: { ids: [] } })).status, 400, "empty");
  assert.equal((await admin("PUT", "/products/order", { body: { ids: "x" } })).status, 400, "not a list");
  assert.equal((await admin("PUT", "/products/order", { body: { ids: [all[0], all[0], ...all.slice(2)] } })).status, 400, "duplicate");
  assert.equal((await admin("PUT", "/products/order", { body: { ids: ["a", ...all.slice(1)] } })).status, 400, "non-integer");
  assert.equal((await admin("PUT", "/products/order", { body: { ids: all.slice(1) } })).status, 409, "missing one");
  assert.equal((await admin("PUT", "/products/order", { body: { ids: [...all.slice(1), 999999] } })).status, 409, "unknown id");
});

test("G footer links: https only, shown publicly, empty removes them", async () => {
  const before = (await dataNow()).settings;
  try {
    for (const bad of ["javascript:alert(1)", "http://insta.example/x", "data:text/html,x", "not a url", "ftp://x.example"]) {
      const r = await admin("PUT", "/settings", { body: settingsBody(before, { instagram: bad }) });
      assert.equal(r.status, 400, `${bad} must be refused`);
    }
    const ok = await admin("PUT", "/settings", { body: settingsBody(before, { instagram: "https://www.instagram.com/quickpara", maps: "https://maps.app.goo.gl/abc" }) });
    assert.equal(ok.status, 200);
    const s = (await catalog()).settings.social;
    assert.ok(s.instagram.startsWith("https://www.instagram.com/"));
    assert.ok(s.maps.startsWith("https://maps.app.goo.gl/"));
    assert.equal(s.facebook, "", "unset stays empty");

    await admin("PUT", "/settings", { body: settingsBody(before, { instagram: "", maps: "" }) });
    const cleared = (await catalog()).settings.social;
    assert.equal(cleared.instagram, "");
    assert.equal(cleared.maps, "");
  } finally {
    await admin("PUT", "/settings", { body: before });
  }
});

test("B delivery zones: validation, CRUD, order, free-delivery threshold exposed", async () => {
  assert.equal((await admin("POST", "/zones", { body: { label: " ", fee: 10 } })).status, 400, "empty name");
  assert.equal((await admin("POST", "/zones", { body: { label: "TEST z", fee: -1 } })).status, 400, "negative fee");
  assert.equal((await admin("POST", "/zones", { body: { label: "TEST z", fee: "abc" } })).status, 400, "fee not a number");
  assert.equal((await admin("POST", "/zones", { body: { label: "TEST z", fee: 10, free_from: -5 } })).status, 400, "negative threshold");

  const z1 = await admin("POST", "/zones", { body: { label: "TEST zone A", fee: 20, free_from: 300 } });
  const z2 = await admin("POST", "/zones", { body: { label: "TEST zone B", fee: 0, free_from: null } });
  assert.equal(z1.status, 201);
  createdZones.push(z1.json.id, z2.json.id);

  let zones = (await catalog()).zones;
  const a = zones.find((z) => z.id === z1.json.id), b = zones.find((z) => z.id === z2.json.id);
  assert.deepEqual([a.fee, a.freeFrom], [20, 300]);
  assert.deepEqual([b.fee, b.freeFrom], [0, null], "no threshold = never free by threshold");

  assert.equal((await admin("PUT", "/zones/" + z1.json.id, { body: { label: "TEST zone A2", fee: 25, free_from: 350 } })).status, 200);
  const upd = (await catalog()).zones.find((z) => z.id === z1.json.id);
  assert.deepEqual([upd.label, upd.fee, upd.freeFrom], ["TEST zone A2", 25, 350]);
  assert.equal((await admin("PUT", "/zones/999999", { body: { label: "x", fee: 1 } })).status, 404);

  // reorder: swap the two test zones inside the full list
  const all = (await dataNow()).zones.map((z) => z.id);
  const i = all.indexOf(z1.json.id), j = all.indexOf(z2.json.id);
  [all[i], all[j]] = [all[j], all[i]];
  assert.equal((await admin("PUT", "/zones/order", { body: { ids: all } })).status, 200);
  zones = (await catalog()).zones.map((z) => z.id);
  assert.ok(zones.indexOf(z2.json.id) < zones.indexOf(z1.json.id), "zone order persisted");
  assert.equal((await admin("PUT", "/zones/order", { body: { ids: all.slice(1) } })).status, 409, "missing id");

  assert.equal((await admin("DELETE", "/zones/" + z1.json.id)).status, 200);
  assert.equal((await admin("DELETE", "/zones/" + z1.json.id)).status, 404);
  assert.ok(!(await catalog()).zones.some((z) => z.id === z1.json.id));
  assert.equal((await admin("DELETE", "/zones/" + z2.json.id)).status, 200);
  assert.ok(!(await catalog()).zones.some((z) => /^TEST/.test(z.label)), "no test zone left behind");
});

test("B minimum order: validated, saved with the settings, cleared by emptying it", async () => {
  const before = (await dataNow()).settings;
  try {
    assert.equal((await admin("PUT", "/settings", { body: settingsBody(before, { minOrder: -5 }) })).status, 400, "negative");
    assert.equal((await admin("PUT", "/settings", { body: settingsBody(before, { minOrder: "abc" }) })).status, 400, "not a number");
    assert.equal((await admin("PUT", "/settings", { body: settingsBody(before, { minOrder: 150 }) })).status, 200);
    assert.equal((await catalog()).settings.minOrder, 150);
    assert.equal((await admin("PUT", "/settings", { body: settingsBody(before, { minOrder: null }) })).status, 200);
    assert.equal((await catalog()).settings.minOrder, null, "no minimum by default");
  } finally {
    await admin("PUT", "/settings", { body: before });
  }
});

/* ======================= A: orders ======================= */

// Every order call uses its own fake visitor address so the 10-per-hour limit never interferes between tests.
const randomIp = () => "test-" + Math.random().toString(36).slice(2) + "-" + Date.now();
const placeOrder = (body, ip = randomIp(), headers = {}) =>
  call("POST", "/api/orders", { body, auth: false, headers: { "CF-Connecting-IP": ip, ...headers } });
const visibleProducts = async () => (await catalog()).products;

test("A order: saved with the server's prices (browser prices ignored), numbered QP-…", async () => {
  const [p1, p2] = await visibleProducts();
  const r = await placeOrder({
    items: [{ id: p1.id, qty: 2, price: 1 }, { id: p2.id, qty: 1, price: 0.01 }],
    name: "TEST client", city: "Rabat", note: "2e étage"
  });
  assert.equal(r.status, 201, r.text);
  assert.match(r.json.number, /^QP-\d{4,}$/);
  const expected = Math.round(p1.price * 100) * 2 + Math.round(p2.price * 100);
  assert.equal(Math.round(r.json.subtotal * 100), expected, "subtotal uses database prices");
  assert.equal(r.json.lines[0].unitPrice, p1.price);
  assert.equal(r.json.deliveryFee, 0, "no zones configured: no delivery fee");
  assert.equal(r.json.zone, null);

  // visible in the admin, with a snapshot of the lines
  const list = (await admin("GET", "/orders?q=" + r.json.number)).json;
  const o = list.orders.find((x) => x.number === r.json.number);
  assert.ok(o, "order found by its number");
  assert.equal(o.status, "new");
  assert.equal(o.customer_name, "TEST client");
  assert.equal(o.items.length, 2);
  assert.equal(o.note, "2e étage");
});

test("A order: validation refuses bad carts", async () => {
  const [p] = await visibleProducts();
  const bad = [
    [{}, "no items"],
    [{ items: [] }, "empty"],
    [{ items: "x" }, "not a list"],
    [{ items: [{ id: p.id, qty: 0 }] }, "qty 0"],
    [{ items: [{ id: p.id, qty: 100 }] }, "qty 100"],
    [{ items: [{ id: p.id, qty: 1.5 }] }, "qty not integer"],
    [{ items: [{ id: "abc", qty: 1 }] }, "bad id"],
    [{ items: [{ id: p.id, qty: 1 }, { id: p.id, qty: 2 }] }, "duplicate line"],
    [{ items: Array.from({ length: 51 }, (_, i) => ({ id: i + 1, qty: 1 })) }, "over 50 lines"],
    [{ items: [{ id: p.id, qty: 1 }], name: "x".repeat(81) }, "name too long"]
  ];
  for (const [body, why] of bad) assert.equal((await placeOrder(body)).status, 400, why);

  const gone = await placeOrder({ items: [{ id: 999999, qty: 1 }] });
  assert.equal(gone.status, 400, "unknown product");
  assert.deepEqual(gone.json.unavailable, [999999], "tells the shop which product is gone");

  const notJson = await call("POST", "/api/orders", { raw: "items=1", type: "application/x-www-form-urlencoded", auth: false, headers: { "CF-Connecting-IP": randomIp() } });
  assert.equal(notJson.status, 400, "form posts refused");
  const cross = await placeOrder({ items: [{ id: p.id, qty: 1 }] }, randomIp(), { Origin: "https://evil.example" });
  assert.equal(cross.status, 403, "cross-site refused");
});

test("A order: hidden product refused; later product edits do not rewrite the order", async () => {
  const body = product({ name: "TEST snapshot", price: 40 });
  const c = await admin("POST", "/products", { body });
  createdProducts.push(c.json.id);
  const r = await placeOrder({ items: [{ id: c.json.id, qty: 3 }] });
  assert.equal(r.status, 201);
  assert.equal(r.json.total, 120);

  await admin("PUT", "/products/" + c.json.id, { body: { ...body, name: "TEST renamed", price: 99, visible: false } });
  const o = (await admin("GET", "/orders?q=" + r.json.number)).json.orders[0];
  assert.equal(o.items[0].name, "TEST snapshot", "name kept");
  assert.equal(o.items[0].unit_price, 40, "price kept");
  assert.equal(o.total, 120);

  const hidden = await placeOrder({ items: [{ id: c.json.id, qty: 1 }] });
  assert.equal(hidden.status, 400, "hidden product cannot be ordered");
  assert.deepEqual(hidden.json.unavailable, [c.json.id]);
});

test("A order: delivery zone required when zones exist; fee and free threshold match the shop's rule", async () => {
  const p = await admin("POST", "/products", { body: product({ name: "TEST fee", price: 100 }) });
  createdProducts.push(p.json.id);
  const z = await admin("POST", "/zones", { body: { label: "TEST zone fee", fee: 20, free_from: 300 } });
  createdZones.push(z.json.id);
  try {
    assert.equal((await placeOrder({ items: [{ id: p.json.id, qty: 1 }] })).status, 400, "zone missing");
    assert.equal((await placeOrder({ items: [{ id: p.json.id, qty: 1 }], zone_id: 999999 })).status, 400, "unknown zone");

    const below = await placeOrder({ items: [{ id: p.json.id, qty: 2 }], zone_id: z.json.id });   // 200 < 300
    assert.deepEqual([below.status, below.json.subtotal, below.json.deliveryFee, below.json.total, below.json.zone], [201, 200, 20, 220, "TEST zone fee"]);
    const exact = await placeOrder({ items: [{ id: p.json.id, qty: 3 }], zone_id: z.json.id });   // exactly 300
    assert.deepEqual([exact.json.subtotal, exact.json.deliveryFee, exact.json.total], [300, 0, 300], "free at exactly the threshold (>=)");
  } finally {
    await admin("DELETE", "/zones/" + z.json.id);
  }
});

test("A order: minimum order enforced on the server too", async () => {
  const p = await admin("POST", "/products", { body: product({ name: "TEST min", price: 30 }) });
  createdProducts.push(p.json.id);
  const before = (await dataNow()).settings;
  try {
    await admin("PUT", "/settings", { body: settingsBody(before, { minOrder: 100 }) });
    const low = await placeOrder({ items: [{ id: p.json.id, qty: 3 }] });   // 90
    assert.equal(low.status, 400);
    assert.match(low.json.error, /Minimum/);
    assert.equal((await placeOrder({ items: [{ id: p.json.id, qty: 4 }] })).status, 201, "120 >= 100");
  } finally {
    await admin("PUT", "/settings", { body: before });
  }
});

test("A order: rate limited to 10 per hour per visitor", async () => {
  const [p] = await visibleProducts();
  const ip = randomIp();
  const codes = [];
  for (let i = 0; i < 11; i++) codes.push((await placeOrder({ items: [{ id: p.id, qty: 1 }], name: "TEST rate" }, ip)).status);
  assert.deepEqual(codes, [...Array(10).fill(201), 429]);
  assert.equal((await placeOrder({ items: [{ id: p.id, qty: 1 }] })).status, 201, "another visitor is not affected");
});

test("A admin orders: login required, status whitelist, filters and counts", async () => {
  assert.equal((await admin("GET", "/orders", { auth: false })).status, 401);
  assert.equal((await admin("PUT", "/orders/1", { auth: false, body: { status: "confirmed" } })).status, 401);

  const [p] = await visibleProducts();
  const r = await placeOrder({ items: [{ id: p.id, qty: 1 }], name: "TEST statut" });
  const id = Number(r.json.number.slice(3)) - 1000;
  assert.equal((await admin("PUT", "/orders/" + id, { body: { status: "shipped" } })).status, 400, "unknown status");
  assert.equal((await admin("PUT", "/orders/999999", { body: { status: "confirmed" } })).status, 404);
  assert.equal((await admin("PUT", "/orders/" + id, { body: { status: "confirmed" } })).status, 200);

  const confirmed = (await admin("GET", "/orders?status=confirmed&q=TEST%20statut")).json;
  assert.ok(confirmed.orders.some((o) => o.id === id && o.status === "confirmed"));
  assert.ok(confirmed.counts.confirmed >= 1);
  assert.equal((await admin("GET", "/orders?status=bogus")).status, 400);
  const byName = (await admin("GET", "/orders?q=" + encodeURIComponent("100%"))).json;
  assert.ok(Array.isArray(byName.orders), "special characters in search are safe");
});

/* ======================= H: SEO ======================= */

const page = async (path) => {
  const res = await fetch(BASE + path);
  return { status: res.status, headers: res.headers, html: await res.text() };
};
const ldOf = (html) => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, "JSON-LD present");
  return JSON.parse(m[1]);
};

test("H home page: title, description, canonical and readable product data in the HTML", async () => {
  const r = await page("/");
  assert.equal(r.status, 200);
  assert.match(r.html, /<title>[^<]*Parapharmacie[^<]*<\/title>/);
  assert.match(r.html, /<link rel="canonical" href="https:\/\/quickpara\.ma\/">/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff", "security header on generated pages");
  assert.equal(r.headers.get("cache-control"), "no-cache", "browsers re-check, so edits show at once");
  const ld = ldOf(r.html);
  const store = ld["@graph"].find((n) => n["@type"] === "Store");
  assert.ok(store && store.url === "https://quickpara.ma/");
  const list = ld["@graph"].find((n) => n["@type"] === "ItemList");
  const visible = (await catalog()).products;
  assert.equal(list.itemListElement.length, Math.min(visible.length, 100));
  const first = list.itemListElement[0].item;
  assert.equal(first["@type"], "Product");
  assert.equal(first.offers.priceCurrency, "MAD");
  assert.ok(r.html.includes('src="/js/app.js"'), "still the normal shop page");
});

test("H category page: own address, title and only its products; unknown category is a 404", async () => {
  const cat = (await dataNow()).categories.find((c) => c.slug === "visage");
  assert.ok(cat, "default category has its address");
  const r = await page("/c/visage");
  assert.equal(r.status, 200);
  assert.match(r.html, /<title>Visage — /);
  assert.match(r.html, /<link rel="canonical" href="https:\/\/quickpara\.ma\/c\/visage">/);
  const names = ldOf(r.html)["@graph"][0].itemListElement.map((e) => e.item.name);
  const expected = (await catalog()).products.filter((p) => p.category === cat.id).map((p) => p.name);
  assert.deepEqual(names, expected);

  const missing = await page("/c/n-existe-pas");
  assert.equal(missing.status, 404);
  assert.match(missing.html, /Page introuvable/);
});

test("H hidden products and dangerous names never break or leak into the page data", async () => {
  const cat = (await dataNow()).categories.find((c) => c.slug === "visage");
  const evil = await admin("POST", "/products", { body: product({ name: '</script><script>alert(1)</script> "x"', category_id: cat.id }) });
  const hidden = await admin("POST", "/products", { body: product({ name: "TEST caché SEO", category_id: cat.id, visible: false }) });
  createdProducts.push(evil.json.id, hidden.json.id);

  const r = await page("/c/visage");
  assert.ok(!r.html.includes("<script>alert(1)</script>"), "no script injection");
  const names = ldOf(r.html)["@graph"][0].itemListElement.map((e) => e.item.name);
  assert.ok(names.includes('</script><script>alert(1)</script> "x"'), "the name survives intact inside the data");
  assert.ok(!names.includes("TEST caché SEO"), "hidden product absent");
});

test("H categories: address generated, validated, unique; description used by the page", async () => {
  const label = "TEST Soins Été " + Math.random().toString(36).slice(2, 6);
  const c = await admin("POST", "/categories", { body: { label, icon: "visage" } });
  assert.equal(c.status, 201);
  createdCategories.push(c.json.id);
  assert.match(c.json.slug, /^test-soins-ete-[a-z0-9]+$/, "accents removed, spaces to dashes");

  const put = (body) => admin("PUT", "/categories/" + c.json.id, { body: { label, icon: "visage", ...body } });
  assert.equal((await put({ slug: "Bad Slug!" })).status, 400, "invalid address");
  assert.equal((await put({ slug: "visage" })).status, 409, "address of another category");
  assert.equal((await put({ description: "x".repeat(161) })).status, 400, "description too long");

  const mySlug = "test-" + Math.random().toString(36).slice(2, 8);
  assert.equal((await put({ slug: mySlug, description: "Crèmes solaires & après-soleil" })).status, 200);
  const r = await page("/c/" + mySlug);
  assert.equal(r.status, 200);
  assert.match(r.html, /<meta name="description" content="Crèmes solaires &amp; après-soleil">/);

  // renaming keeps the address, so shared links keep working
  const renamed = await admin("PUT", "/categories/" + c.json.id, { body: { label: label + " bis", icon: "visage", slug: "" } });
  assert.equal(renamed.json.slug, mySlug);
});

test("H sitemap and robots.txt", async () => {
  const s = await page("/sitemap.xml");
  assert.equal(s.status, 200);
  assert.match(s.headers.get("content-type"), /xml/);
  assert.ok(s.html.includes("<loc>https://quickpara.ma/</loc>"));
  assert.ok(s.html.includes("<loc>https://quickpara.ma/c/visage</loc>"));
  const robots = await page("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.html, /Disallow: \/admin/);
  assert.match(robots.html, /Sitemap: https:\/\/quickpara\.ma\/sitemap\.xml/);
});

test("by default nothing changes for shoppers: no zones, no minimum", async () => {
  const c = await catalog();
  assert.equal(c.zones.filter((z) => /^TEST/.test(z.label)).length, 0, "test zones cleaned up");
  assert.equal(c.settings.minOrder, null);
});
