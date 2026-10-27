export type PromotionStatus = "none" | "scheduled" | "active" | "expired";
export type PromotionSource = {
  priceCents: number;
  promotionEnabled?: boolean;
  promotionPriceCents?: number | null;
  promotionStartsAt?: string | Date | null;
  promotionEndsAt?: string | Date | null;
  pricingAsOf?: string;
};
export function getProductPricing(product: PromotionSource, now = new Date()) {
  const starts = product.promotionStartsAt ? new Date(product.promotionStartsAt).getTime() : -Infinity;
  const ends = product.promotionEndsAt ? new Date(product.promotionEndsAt).getTime() : NaN;
  const sale = product.promotionPriceCents;
  const configured = product.promotionEnabled && Number.isInteger(sale) && sale! >= 100 && sale! < product.priceCents && Number.isFinite(ends) && starts < ends;
  const promotionStatus: PromotionStatus = !configured ? "none" : now.getTime() >= ends ? "expired" : now.getTime() < starts ? "scheduled" : "active";
  const promotionActive = promotionStatus === "active";
  const effectivePriceCents = promotionActive ? sale! : product.priceCents;
  return { promotionStatus, promotionActive, effectivePriceCents,
    originalPriceCents: promotionActive ? product.priceCents : null,
    discountPercent: promotionActive ? Math.floor((product.priceCents - effectivePriceCents) * 100 / product.priceCents) : 0 };
}
export const PROMOTION_LABELS: Record<PromotionStatus, string> = { none: "Sin promoción", scheduled: "Programada", active: "Activa", expired: "Finalizada" };
export function formatPromotionDate(value: string | Date) {
  // Stable Spanish output across Node ICU and browsers: avoids hydration drift.
  const date = new Date(new Date(value).getTime() - 5 * 60 * 60 * 1000);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const hour = date.getUTCHours();
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2,"0")} ${hour < 12 ? "a. m." : "p. m."}`;
}
export function promotionDateInput(value?: string | Date | null) {
  if (!value) return "";
  // Colombia uses UTC-05:00 year-round; avoid the administrator's device zone.
  return new Date(new Date(value).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
export function promotionDateISO(value: string) {
  if (!value) return null;
  const date = new Date(value + (value.length === 16 ? ":00" : "") + "-05:00");
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
