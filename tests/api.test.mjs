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
  for (const p of c.products) assert.ok(!("visible" in p) && !("image_key" in p), "no internal fields");
});
