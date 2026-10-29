// Category page: /c/<slug> (e.g. /c/visage). Unknown slugs get a 404 page.
import { renderShop } from "../../src/lib/seo.js";

export const onRequestGet = (context) => renderShop(context, String(context.params.slug || "").toLowerCase());
