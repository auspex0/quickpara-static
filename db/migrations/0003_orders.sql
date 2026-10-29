-- A: order log. An order is saved when the customer clicks "Commander sur WhatsApp".
-- `ref` is a random id used to link the lines to their order inside one atomic batch.
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,   -- order number shown = 'QP-' || (1000 + id)
  ref           TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new',         -- new | confirmed | delivered | cancelled
  customer_name TEXT NOT NULL DEFAULT '',
  zone_label    TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  subtotal      REAL NOT NULL,
  delivery_fee  REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Snapshot of each line: later product edits must not rewrite history.
CREATE TABLE IF NOT EXISTS order_items (
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  name       TEXT NOT NULL,
  unit_price REAL NOT NULL,
  qty        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Public endpoint protection (orders per visitor per hour).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits ON rate_limits(bucket, at);
