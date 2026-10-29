// Home page with server-side title, description and product data (see src/lib/seo.js).
import { renderShop } from "../src/lib/seo.js";

export const onRequestGet = (context) => renderShop(context, null);
