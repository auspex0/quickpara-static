# QuickPara v2 — implementation plan

Audience: the agent implementing this (and the owner reviewing it).
Status: **all items (0, F, C, D, E, G, B, A, H) and the docs are implemented and tested locally: 31/31 tests. Not committed, not deployed. Remaining: the release (step 9.5), with the owner's OK.** Do not add features beyond this list.

## A and H — what was built (Opus)

- `db/migrations/0003_orders.sql`: `orders` (with a random `ref` used to link lines inside one atomic batch), `order_items` (name and price snapshot), `rate_limits`.
- `functions/api/orders.js` (public `POST /api/orders`): JSON only, same-origin, 10 orders/hour per visitor, 1–50 lines, qty 1–99, prices read from D1, hidden/unknown products → 400 with `unavailable: [ids]`, zone required when zones exist, `minOrder` enforced, fee rule shared in `src/lib/delivery.js` (cents, `>=` at the threshold, same as the shop's `feeFor`). Order + lines + rate mark saved in one D1 batch (transaction).
- Storefront checkout: the tab is opened during the click (pop-up rule), then filled with the WhatsApp link once the order is saved. 400 → tab closed and the reason shown in the cart (and the catalogue refreshed if a product disappeared); 429/5xx/offline → WhatsApp still opens with the message without a number. The cart subtotal is now summed in cents like the server.
- Admin: **Commandes** tab (first tab, red count of new orders), filter by status, search by number or name, details on click, status select. `GET /api/admin/orders`, `PUT /api/admin/orders/:id`.
- H: `functions/index.js` (home) and `functions/c/[slug].js` use `src/lib/seo.js` (HTMLRewriter: title, description, canonical, Open Graph, JSON-LD Store + ItemList of Products). Pages are cached 5 min at the edge (Cache API, skipped on localhost) and sent to browsers with `no-cache` so edits show at once. `functions/sitemap.xml.js`, `public/robots.txt`. `SITE_URL` var in `wrangler.toml`. Category slugs: generated on create, kept on rename, editable and validated in the admin; description (160 chars) used as the page's meta description.
- Docs: handbook rewritten for the French console and the new features; deploy guide has "Passer à une nouvelle version" and Google Search Console sections.

### Known limits
- Checked in Chrome (desktop and 375 px emulation) only. The built-in test browser refuses new tabs, so the real-click test exercised the same-tab fallback; the new-tab path still needs a check on a real phone (Safari and Chrome) after release.
- An order is saved on click, so abandoned clicks stay "Nouvelle"; a double click on two separate occasions makes two orders. Documented in the handbook.
- The sitemap has no `<lastmod>` (no "updated at" column).

## Handover notes (read before continuing with A and H)

### What is done, and verified
- `npm test`: **19/19 pass** (run twice, on a freshly rebuilt local database). Browser checks done at 375 px and desktop widths: badges and crossed-out prices, brand filter (spelling variants grouped), featured first, cart delivery totals, minimum order, WhatsApp message, French admin (product dialog, arrows, star, zones tab).
- Delivery boundary verified in the browser with 25 MAD items: 275 MAD → fee 20 + hint "Plus que 25 MAD"; exactly 300 MAD → free; below the minimum → checkout disabled.
- The migration was tested as a real upgrade: local DB built in the old shape with the 14 demo products, then `migrations apply`: all products kept, positions set to `-id`.

### What changed vs the plan text above
- `db/schema.sql` was **moved** to `db/migrations/0001_initial.sql` (idempotent). `db/migrations/0002_v2.sql` holds: `old_price`, `is_new`, `featured`, `position` on products; `slug`, `description` on categories (default categories already have slugs; **new categories get a NULL slug until step H handles it**); `delivery_zones`. The `orders`, `order_items` and `rate_limits` tables are **not** created yet: step A must add them in `0003_orders.sql`.
- `package.json`: `db:local` / `db:remote` now run `wrangler d1 migrations apply`. `wrangler.toml` has `migrations_dir = "db/migrations"` and the real D1 id.
- `GUIDE-DEPLOIEMENT.md` step 4 and `README.md` were touched only to stop pointing at `schema.sql`. The full docs update (step 9) is still to do.
- Public asset paths are absolute (`/css/style.css`, `/js/app.js`), and the admin page uses `/admin/admin.css` and `/admin/admin.js`.

### Contracts that A and H must reuse
- **Delivery rule**, client side in `public/js/app.js` function `feeFor(zone, subtotal)`: `zone.freeFrom` set and `subtotal >= freeFrom` → fee 0, otherwise `zone.fee`. The server (step A) must implement the **same** rule (`free_from` column) and the same `>=`. Add a boundary test on the server (subtotal exactly at `free_from`).
- **Minimum order**: stored in `settings.minOrder` (null = none). The storefront blocks checkout below it, but **the server in step A must also enforce it** (400).
- **Catalogue shape** (`GET /api/catalog`): products have `oldPrice`, `isNew` (no `featured`, no `visible`); `settings` has `minOrder` and `social {instagram, facebook, maps, googleBusiness}`; top-level `zones [{id,label,fee,freeFrom}]`. Product order is `featured DESC, position ASC, id DESC`.
- **Settings endpoint** `PUT /api/admin/settings` **replaces the whole set**: the admin always sends every field (`whatsapp, storeName, hours, minOrder, instagram, facebook, maps, googleBusiness`); omitted optional fields are cleared. Tests restore with the full object from `/api/admin/data`.
- **Reorder endpoints** (`/products/order`, `/zones/order`) require the **complete** list of ids (400 invalid, 409 if the list is stale).
- Admin UI conventions: French vocabulary already fixed in `public/admin/index.html` / `admin.js` (Produits, Catégories, Livraison, Réglages, Enregistrer, Annuler, Supprimer, « Se connecter »…). Server error messages are French. Add the **Commandes** tab in the same style.
- Rate limiting pattern to copy for A: `login()` in `functions/api/admin/[[path]].js` (table per bucket, window, 429). For tests use a fresh random `CF-Connecting-IP` per run (see the login lockout test).

### Local environment
- Start: `npm run dev` (port 5173). Reset the local DB to the live shape + demo data: delete `.wrangler/state/v3/d1`, then `wrangler d1 execute quickpara --local --file=db/migrations/0001_initial.sql`, `... --file=db/seed-demo.sql`, `echo y | wrangler d1 migrations apply quickpara --local`.
- The test "by default nothing changes for shoppers" requires **no delivery zones and no minimum order** in the DB it runs against.
- The local test password is in `.dev.vars` (git-ignored).

### Not done / still needs the owner
- Nothing is committed or pushed. The **live database is still at the old schema** and the live site is the old version. Release order stays: backup → `migrations apply --remote` → deploy → live smoke test (no lockout or rate-limit tests on production) → commit and push, **each with the owner's OK**.
- The handbook (`MANUEL-UTILISATEUR.md`) still describes the English admin: rewrite in step 9 using the French vocabulary above.
- Browser checks on a real phone (not only emulation) are still to do by the owner for the checkout flow after step A.

## Ground rules (read first)

- The site is **live** at https://quickpara.ma (Cloudflare Pages project `quickpara`, D1 database `quickpara`, R2 bucket `quickpara-photos`). See `README.md` for layout and local dev.
- **Ask the owner before**: applying migrations to the remote database, deploying (`wrangler pages deploy`), committing, pushing. Everything else (local DB, local dev server, tests) is fine without asking.
- Back up before touching the remote DB: `npx wrangler d1 export quickpara --remote --output=sauvegarde-avant-v2.sql` (file is git-ignored; never commit it).
- Never print or commit secrets (`.dev.vars`, `.admin-password.txt`).
- Storefront stays French. Admin becomes French (item F). Code comments/identifiers stay English, matching the existing code.
- Keep the existing style: vanilla JS (ES5-style `var`/functions in `public/js/app.js`, same in `public/admin/admin.js`), no frameworks, no build step, no new npm dependencies.
- Every item ends with: tests added to `tests/api.test.mjs` (API) and a browser check (desktop + 375 px mobile) in the local dev server. `npm test` must stay green — never weaken an existing test.
- Report to the owner in plain language: what changed, what was run and what it showed, what could not be verified.

## Effort scale used below

| Size | Meaning |
|---|---|
| **S** | Under ~1 hour. One or two layers (e.g. a column + a form field + some CSS). No new security surface. Pattern already exists in the code to copy. |
| **M** | A few hours. Touches every layer (DB, API, admin, storefront, tests), **or** opens a new public write path / new routing that needs protection and careful testing. |
| **L** | A day or more. *Nothing in this plan is L.* |

## Implementation order (dependencies)

| Step | Item | Size | Why this position |
|---|---|---|---|
| 0 | Foundation: migrations + absolute asset paths | S | Every item needs DB columns; one migration avoids touching the live DB several times. |
| 1 | F — Admin in French | S | Do it **first** so all new admin UI is written in French once, not translated later. |
| 2 | C — Promo price & badges | S | Independent, small. |
| 3 | D — Featured + manual ordering | S | Changes default sort; later items (SEO list, brand filter) rely on final ordering. |
| 4 | E — Brand filter | S | Client-only. |
| 5 | G — Footer social links | S | Settings pattern; SEO (H) reuses these URLs. |
| 6 | B — Delivery zones & minimum | S–M | Orders (A) need the fee calculation. |
| 7 | A — Order log with order numbers | M | Uses B's fee logic; biggest change to checkout. |
| 8 | H — SEO basics | M | Uses D's order, G's links, needs final category data. |
| 9 | Docs, full test run, owner approval, migrate remote, deploy, push | — | |

---

## Step 0 — Foundation (S)

**What:** a proper migration system and one migration with every v2 schema change. Plus a small fix needed by SEO routing.

**Why S:** mechanical; no behaviour change.

1. Add `migrations_dir = "db/migrations"` to the `[[d1_databases]]` block in `wrangler.toml`.
2. `db/migrations/0001_initial.sql` = current `db/schema.sql` content (it is idempotent: `CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`), so applying it to the live DB, which already has these tables, is harmless. Keep `db/schema.sql` as a pointer comment ("see db/migrations") or delete it and update `package.json` scripts (`db:local` → `wrangler d1 migrations apply quickpara --local`).
3. `db/migrations/0002_v2.sql` — all new schema, applied once by Wrangler's migration tracker:
   ```sql
   ALTER TABLE products ADD COLUMN old_price REAL;               -- C
   ALTER TABLE products ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0;   -- C
   ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0; -- D
   ALTER TABLE products ADD COLUMN position INTEGER NOT NULL DEFAULT 0; -- D
   UPDATE products SET position = -id;                           -- D: keep current "newest first"
   ALTER TABLE categories ADD COLUMN slug TEXT;                  -- H
   ALTER TABLE categories ADD COLUMN description TEXT NOT NULL DEFAULT ''; -- H
   -- H: fill slugs for existing categories (visage, corps-cheveux, bebe-maman, ...) with UPDATEs
   CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

   CREATE TABLE IF NOT EXISTS delivery_zones (                   -- B
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     label TEXT NOT NULL,
     fee REAL NOT NULL DEFAULT 0,
     free_from REAL,               -- NULL = never free
     position INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE IF NOT EXISTS orders (                           -- A
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'new',     -- new | confirmed | delivered | cancelled
     customer_name TEXT NOT NULL DEFAULT '',
     zone_label TEXT NOT NULL DEFAULT '',
     address TEXT NOT NULL DEFAULT '',
     subtotal REAL NOT NULL,
     delivery_fee REAL NOT NULL DEFAULT 0,
     total REAL NOT NULL
   );
   CREATE TABLE IF NOT EXISTS order_items (                      -- A
     order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     product_id INTEGER,
     name TEXT NOT NULL,         -- snapshot: later product edits must not rewrite history
     unit_price REAL NOT NULL,   -- snapshot
     qty INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
   CREATE TABLE IF NOT EXISTS rate_limits (                      -- A (public order endpoint)
     bucket TEXT NOT NULL,       -- e.g. 'order:<ip>'
     at INTEGER NOT NULL
   );
   ```
   New settings keys (min order, social URLs) need no schema change: they go in the existing `settings` table.
4. **Asset paths:** in `public/index.html` change relative paths (`css/style.css`, `js/app.js`, `assets/favicon.svg`) to absolute (`/css/style.css`, …). Required by H, otherwise `/c/visage` would load `/c/css/style.css` and break.
5. Apply locally: `npx wrangler d1 migrations apply quickpara --local`, run `npm test` (must stay 13/13).

---

## Step 1 — F: Admin in French (S)

**What:** every visible string in the admin page in French; server error messages in French.

**Why S:** pure text, no logic. It touches many strings but each change is trivial and visible.

- `public/admin/index.html` and `public/admin/admin.js`: translate all labels, buttons, placeholders, toasts, confirm dialogs, empty states. `<html lang="fr">`. Vocabulary (keep consistent, the handbook will use exactly these): Produits, Catégories, Réglages, Commandes, Livraison, « + Nouveau produit », Enregistrer, Annuler, Supprimer, Modifier, « Choisir une photo », « Retirer la photo », « Visible sur le site », « Voir le site », « Se déconnecter », « Se connecter », « Mot de passe ».
- Icon labels in the category icon select: Visage, Corps & cheveux, Bébé & maman, Compléments, Hygiène, Premiers soins, Générique.
- `functions/api/admin/[[path]].js`: translate `HttpError` messages (e.g. "Name is required" → « Le nom est obligatoire », "Wrong password" → « Mot de passe incorrect », "Too many attempts…" → « Trop de tentatives. Réessayez dans 15 minutes. »).
- Tests only assert status codes → should pass unchanged; run them to confirm.

---

## Step 2 — C: Promo price & badges (S)

**What:** an optional "old price" shown struck through with an automatic « -20 % » tag, and an optional « Nouveau » badge.

**Why S:** two columns (added in step 0), two form fields, one validation rule, some CSS. No new endpoint.

- API (`[[path]].js` `productFields`): accept `old_price` (null or number) — **reject with 400 if `old_price <= price`** (a "promo" that isn't cheaper is a data-entry mistake). Accept `is_new` boolean.
- `functions/api/catalog.js`: return `oldPrice` and `isNew`.
- Admin product dialog: field « Ancien prix (barré, facultatif) » and checkbox « Badge Nouveau ».
- Storefront card (`public/js/app.js` `cardFooter` / `renderGrid`): if `oldPrice` → show `<s>` old price + badge `-X %` (rounded); if `isNew` → badge « Nouveau ». Badges top-left of `.card-visual`. Max one promo badge + one Nouveau badge.
- WhatsApp message and cart: unchanged — they use the real `price`.
- Tests: old_price ≥ price rejected; promo fields appear in catalogue.

---

## Step 3 — D: Featured products + manual ordering (S)

**What:** owner decides the display order; featured products always come first.

**Why S:** one flag + one position column (step 0), one small endpoint, arrow buttons. Up/down arrows instead of drag-and-drop on purpose: drag-and-drop is unreliable on phones and the owner will use the admin on a phone.

- Sort everywhere (catalogue and admin list): `featured DESC, position ASC, id DESC`.
- New products: `position = (SELECT COALESCE(MIN(position),0) - 1 FROM products)` → they appear at the top (owner adds new stock and wants it seen).
- Endpoint `PUT /api/admin/products/order` body `{ ids: [..] }` → batch `UPDATE products SET position = ? WHERE id = ?` (index in array). Validate: all ids are integers and exist, no duplicates.
- Admin list: ▲ ▼ buttons per row, and a star toggle « À la une ». Arrows **disabled when a search or category filter is active** (reordering a filtered subset is confusing); show a one-line hint « Retirez les filtres pour réordonner ».
- Product dialog: checkbox « Mettre à la une ».
- Tests: reorder persists and changes catalogue order; featured first; invalid id list → 400.

---

## Step 4 — E: Brand filter (S)

**What:** customers can filter by brand, combined with category and search.

**Why S:** no database change — brands already exist on products. Client-side only, plus an autocomplete in admin to keep brand names consistent.

- Storefront: a `<select>` « Toutes les marques » next to the search/chips, built from distinct brands of **visible** products, sorted A→Z, grouped case-insensitively with trimmed spaces ("La Roche-Posay" and "la roche-posay " are one brand; display the most common spelling). A select rather than more chips because brand lists get long (30+) and chips would overflow on mobile.
- Hidden when fewer than 2 brands exist.
- Filters combine with AND: category + brand + search. Result count updates.
- Admin product dialog: `<datalist>` of existing brands on the Marque field, so the owner picks instead of retyping (prevents duplicates at the source).
- Test in browser (no API change).

---

## Step 5 — G: Footer social links (S)

**What:** optional Instagram, Facebook, Google Maps and Google Business links in the footer.

**Why S:** reuses the settings table and settings form; four fields, four icons.

- Settings keys: `instagram`, `facebook`, `maps`, `googleBusiness` (all optional).
- Admin Réglages: four URL fields.
- **Security:** server accepts only `https://` URLs (reject `javascript:`, `data:`, `http:`), max 300 chars — these are rendered as links on the public site. Empty = remove.
- Catalogue returns them under `settings`. Footer renders only filled ones, `target="_blank" rel="noopener"`, inline SVG icons (no external icon library).
- Tests: `javascript:alert(1)` rejected; valid https accepted and returned.

---

## Step 6 — B: Delivery zones & minimum order (S–M)

**What:** owner defines zones (e.g. « Casablanca » 20 MAD, free from 300 MAD; « Autres villes » 40 MAD) and an optional minimum order. The cart shows subtotal, delivery and total; the WhatsApp message includes them.

**Why S–M:** the admin part is S (zones CRUD is the same pattern as categories). The M part: the fee is now computed in two places (cart display in the browser, and the server in item A) and they must always agree, including the free-delivery threshold and the minimum — so it needs explicit tests on both sides.

- Admin: new tab **Livraison**: list of zones (label, fee, « gratuit à partir de » optional), add / edit / delete, ▲▼ order (reuse D's component). Field « Commande minimum (MAD, facultatif) » stored in settings `minOrder`.
- Catalogue returns `zones` and `settings.minOrder`.
- Fee rule (single definition, documented in code): `fee = (free_from != null && subtotal >= free_from) ? 0 : fee`.
- Cart drawer: select « Zone de livraison » (required **only if** zones exist) above the existing name/address fields. Keep the free-text field, relabel « Adresse / quartier ». Show « Sous-total », « Livraison » (« Gratuite » when 0), « Total ». If a zone has `free_from` and subtotal is below it, show « Plus que X MAD pour la livraison gratuite ».
- Minimum: if `subtotal < minOrder`, disable « Commander sur WhatsApp » and show « Minimum de commande : X MAD ».
- No zones configured → behaves exactly like today (no delivery lines). This is the default after deploy, so nothing changes until the owner fills it in.
- WhatsApp message adds: zone, « Livraison : X MAD » (or « Gratuite »), « Total : … ».
- Tests: zone CRUD + validation (fee ≥ 0, free_from ≥ 0 or null), catalogue exposes zones.

---

## Step 7 — A: Order log with order numbers (M)

**What:** when a customer clicks « Commander sur WhatsApp », the order is saved with a number (`QP-1001`, `QP-1002`, …) that appears in the WhatsApp message. Admin gets a **Commandes** tab with status: Nouvelle → Confirmée → Livrée / Annulée.

**Why M:**
1. It is the first **public write endpoint** — anyone on the internet can call it — so it needs validation and rate limiting.
2. The server must **recompute prices itself** (never trust prices sent by the browser).
3. It changes the checkout click flow, which has a browser trap (popup blocking, below).
4. New admin tab and tests.

Backend — `functions/api/orders.js` (`POST` only):
- Body: `{ items: [{ id, qty }], zone_id, name, address }`.
- Same-origin check (reuse the `Origin` check pattern from the admin API).
- Rate limit: max **10 orders per IP per hour** via `rate_limits` (bucket `order:<CF-Connecting-IP>`), clean rows older than 24 h; 429 with a French message.
- Validate: 1–50 lines, qty integer 1–99, every id exists **and is visible**; zone required if zones exist and must exist; name ≤ 80, address ≤ 300.
- Load prices from D1, compute subtotal, fee (B's rule), total; enforce `minOrder` (400 if below).
- Insert `orders` + `order_items` (snapshot name and unit price) in one `env.DB.batch`.
- Number = `'QP-' + (1000 + id)`. Return `{ number, lines:[{name, qty, unit_price, line_total}], subtotal, delivery_fee, total, zone_label }`.

Storefront checkout (`public/js/app.js`):
- **Popup trap:** browsers block `window.open` called after an `await` (not a direct click any more). So: on click, open the tab immediately — `var w = window.open('', '_blank')` — then `fetch('/api/orders')`, then set `w.location.href = waLink(message)`. If `w` is null (blocked), fall back to `location.href = waLink(message)`.
- Build the WhatsApp message from the **server response** (number + server prices), e.g. first line « Commande QP-1042 ».
- **Never lose a sale:** if the request fails (network, 5xx, 429), still open WhatsApp with today's message (no number). Only a 400 (e.g. below minimum, product no longer available) shows an error in the cart instead and refreshes the catalogue.
- Button shows a short busy state while sending (prevent double-submit).

Admin — tab **Commandes** (endpoints under `/api/admin/orders`, session required):
- `GET /api/admin/orders?status=&q=` → newest first, paginated (50 per page).
- `PUT /api/admin/orders/:id` `{ status }` (whitelist of 4 values).
- List: number, date/time (Africa/Casablanca), name, zone, total, status select. Click a row → lines detail. Filter by status, search by number or name.
- Label the « Nouvelle » status in the UI as « Nouvelle (en attente WhatsApp) »: a saved order only means the customer clicked; they may never send the WhatsApp message. The owner confirms when the message arrives.
- No delete (cancelled is enough; keeps history honest).

Tests: prices recomputed (client-sent price ignored), hidden/unknown product → 400, qty bounds, zone required when zones exist, fee and free threshold, minimum order, rate limit 429 on the 11th (use a random `CF-Connecting-IP` per run, like the login test), cross-origin → 403, admin orders endpoints → 401 without session, status whitelist. Browser: WhatsApp tab opens on desktop Chrome and on mobile emulation without being blocked; message contains the number.

---

## Step 8 — H: SEO basics (M)

**What:** Google can read the products (name, brand, price), each category has its own URL with its own title and description, plus `sitemap.xml` and `robots.txt`.

**Why M (not S):** the storefront is built in the browser by JavaScript, so the HTML Google first sees is empty of products. To fix that properly we add **server-side injection** of titles, descriptions and structured data — a Pages Function that edits the HTML on the way out (`HTMLRewriter`) — plus category URLs and routing. Also, those HTML pages then run a Function on every visit, which counts against the free daily limit, so it needs edge caching.

- **Category URLs:** `/c/<slug>` (e.g. `/c/visage`). Slugs generated from the label on create/rename (lowercase, accents removed, spaces → `-`), unique, editable in admin. Storefront reads the path on load to pre-select the chip, and uses `history.pushState` when a chip is clicked (back button works). « Tous » = `/`.
- **Admin:** category form gets « Description (pour Google, 160 caractères max) ».
- **Functions:** `functions/index.js` (route `/`) and `functions/c/[slug].js`:
  - fetch the static page with `env.ASSETS.fetch(new URL('/', request.url))`;
  - read catalogue data from D1;
  - with `HTMLRewriter` set `<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:title`/`og:description`/`og:url`, and inject `<script type="application/ld+json">`: `Organization`/`Store` (name, url, `sameAs` = G's social links) on `/`, and an `ItemList` of `Product` (`name`, `brand`, `image`, `offers` {`price`, `priceCurrency: "MAD"`, `availability: InStock`}) for the listed products;
  - unknown slug → 404 page (simple, French).
  - **Copy the security headers** from `public/_headers` onto these responses (`_headers` only applies to static files, not Function responses).
  - **Cache** the generated HTML at the edge with the Cache API for 5 minutes (`caches.default`), so most visits don't hit D1 or count as a full run.
  - Escape everything inserted into HTML/JSON-LD (product names are owner-entered text).
- **`functions/sitemap.xml.js`:** `/` + every category URL with `<lastmod>`. Cache 1 h.
- **`public/robots.txt`:** allow all, `Disallow: /admin`, `Disallow: /api/`, `Sitemap: https://quickpara.ma/sitemap.xml`.
- **Owner task (not code):** add the site to Google Search Console (verification by DNS TXT record in Cloudflare) and submit the sitemap. Put these steps in the guide.
- Tests: `/` and `/c/visage` contain the right `<title>` and valid JSON-LD (parse it), unknown slug 404, `sitemap.xml` lists categories, `robots.txt` served, hidden products absent from JSON-LD, security headers present on function-rendered pages.

---

## Step 9 — Docs, verification, release

1. `MANUEL-UTILISATEUR.md` (French, non-technical): replace English button names with the French ones from step 1; add sections **Commandes** (statuses, why some stay « en attente »), **Livraison** (zones, gratuit à partir de, minimum), **Promo et Nouveau**, **À la une et ordre d'affichage**, **Réseaux sociaux**. Keep the same tone.
2. `GUIDE-DEPLOIEMENT.md`: migrations command (`npx wrangler d1 migrations apply quickpara --remote`), backup-before-migration step, Google Search Console steps.
3. `README.md`: update scripts and layout.
4. Full `npm test` (paste the summary), browser pass desktop + mobile on every changed screen, Lighthouse-style sanity check of `/` (title, description, no console errors).
5. **Ask the owner**, then: export remote DB backup → `wrangler d1 migrations apply quickpara --remote` → `wrangler pages deploy public --project-name quickpara --branch main` → live smoke test (do not run the lockout/rate-limit tests against production: they would block the owner's IP) → commit and push.

## Decisions taken (defaults — owner can override)

- Order numbers: `QP-1001` upwards.
- New products appear at the top of the list.
- Badges: « Nouveau » (manual) and « -X % » (automatic from old price). No other badge types.
- Delivery: no zones configured at launch → the cart behaves exactly as today until the owner adds zones.
- Category URLs: `/c/<slug>`.
- Orders are never deleted, only cancelled.

## Explicitly out of scope

Stock management, online payment, customer accounts, multiple photos, product variants, Arabic version, bulk import, analytics. Do not build these.
