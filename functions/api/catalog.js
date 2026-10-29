// Public catalogue read by the storefront. Hidden products are never returned.
import { json } from "../../src/lib/http.js";

export async function onRequestGet({ env }) {
  const [settingsRes, catsRes, prodsRes, zonesRes] = await env.DB.batch([
    env.DB.prepare("SELECT key, value FROM settings"),
    env.DB.prepare("SELECT id, label, icon, slug FROM categories ORDER BY position, id"),
    env.DB.prepare(
      "SELECT id, name, brand, category_id, price, old_price, is_new, description, image_key " +
      "FROM products WHERE visible = 1 ORDER BY featured DESC, position ASC, id DESC"
    ),
    env.DB.prepare("SELECT id, label, fee, free_from FROM delivery_zones ORDER BY position, id")
  ]);

  const s = Object.fromEntries(settingsRes.results.map((r) => [r.key, r.value]));
  const minOrder = s.minOrder ? Number(s.minOrder) : null;

  return json(
    {
      settings: {
        whatsapp: s.whatsapp || "",
        storeName: s.storeName || "QuickPara",
        hours: s.hours || "",
        minOrder: Number.isFinite(minOrder) && minOrder > 0 ? minOrder : null,
        social: {
          instagram: s.instagram || "",
          facebook: s.facebook || "",
          maps: s.maps || "",
          googleBusiness: s.googleBusiness || ""
        }
      },
      categories: catsRes.results,
      zones: zonesRes.results.map((z) => ({ id: z.id, label: z.label, fee: z.fee, freeFrom: z.free_from })),
      products: prodsRes.results.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category_id,
        price: p.price,
        oldPrice: p.old_price,
        isNew: !!p.is_new,
        desc: p.description,
        image: p.image_key ? "/img/" + p.image_key : null
      }))
    },
    200,
    { "Cache-Control": "public, max-age=15" }
  );
}
