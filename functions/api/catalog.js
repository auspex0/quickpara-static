// Public catalogue read by the storefront. Hidden products are never returned.
import { json } from "../../src/lib/http.js";

export async function onRequestGet({ env }) {
  const [settingsRes, catsRes, prodsRes] = await env.DB.batch([
    env.DB.prepare("SELECT key, value FROM settings"),
    env.DB.prepare("SELECT id, label, icon FROM categories ORDER BY position, id"),
    env.DB.prepare(
      "SELECT id, name, brand, category_id, price, description, image_key FROM products WHERE visible = 1 ORDER BY id"
    )
  ]);

  const s = Object.fromEntries(settingsRes.results.map((r) => [r.key, r.value]));
  return json(
    {
      settings: { whatsapp: s.whatsapp || "", storeName: s.storeName || "QuickPara", hours: s.hours || "" },
      categories: catsRes.results,
      products: prodsRes.results.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category_id,
        price: p.price,
        desc: p.description,
        image: p.image_key ? "/img/" + p.image_key : null
      }))
    },
    200,
    { "Cache-Control": "public, max-age=15" }
  );
}
