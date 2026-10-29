// Delivery fee rule. The storefront applies the same rule in public/js/app.js (feeFor): keep both identical,
// including the ">=" at the free-delivery threshold.
export function deliveryFee(zone, subtotal) {
  if (!zone) return 0;
  if (zone.free_from !== null && zone.free_from !== undefined && subtotal >= zone.free_from) return 0;
  return zone.fee;
}

// Money is summed in whole cents so the server and the browser never disagree by a rounding error.
export const toCents = (n) => Math.round(Number(n) * 100);

export const formatMad = (n) => Number(n).toLocaleString("fr-FR") + " MAD";
