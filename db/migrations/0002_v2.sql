-- QuickPara v2 schema changes. Applied once by `wrangler d1 migrations apply`.
-- Orders / rate_limits tables (item A) are added by a later migration.

-- C: promo price + "Nouveau" badge
ALTER TABLE products ADD COLUMN old_price REAL;
ALTER TABLE products ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0;

-- D: featured + manual order (lower position = shown first; new products get MIN-1)
ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
UPDATE products SET position = -id;

-- H: category addresses and descriptions (used by the SEO step)
ALTER TABLE categories ADD COLUMN slug TEXT;
ALTER TABLE categories ADD COLUMN description TEXT NOT NULL DEFAULT '';
UPDATE categories SET slug = 'visage'          WHERE label = 'Visage';
UPDATE categories SET slug = 'corps-cheveux'   WHERE label = 'Corps & cheveux';
UPDATE categories SET slug = 'bebe-maman'      WHERE label = 'Bébé & maman';
UPDATE categories SET slug = 'complements'     WHERE label = 'Compléments';
UPDATE categories SET slug = 'hygiene'         WHERE label = 'Hygiène';
UPDATE categories SET slug = 'premiers-soins'  WHERE label = 'Premiers soins';
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- B: delivery zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  label     TEXT NOT NULL,
  fee       REAL NOT NULL DEFAULT 0,
  free_from REAL,               -- NULL = never free
  position  INTEGER NOT NULL DEFAULT 0
);
