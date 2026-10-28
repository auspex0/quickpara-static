-- QuickPara database schema (Cloudflare D1 / SQLite). Safe to run more than once.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  label    TEXT NOT NULL,
  icon     TEXT NOT NULL DEFAULT 'bag',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  brand       TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price       REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_key   TEXT,
  visible     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);

-- Defaults (only inserted if missing)
INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp',  '212600000000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('storeName', 'QuickPara');
INSERT OR IGNORE INTO settings (key, value) VALUES ('hours',     'Lun–Sam, 9h–20h');

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_label ON categories(label);

-- Starter categories for first setup (run this file once; re-running restores any you deleted).
INSERT OR IGNORE INTO categories (label, icon, position) VALUES
  ('Visage', 'visage', 1),
  ('Corps & cheveux', 'corps', 2),
  ('Bébé & maman', 'bebe', 3),
  ('Compléments', 'complements', 4),
  ('Hygiène', 'hygiene', 5),
  ('Premiers soins', 'soins', 6);
