import type { Prisma, Product } from "@prisma/client";
import { getProductPricing } from "../../src/shared/promotions";

export function promotionWhere(status: string, now: Date): Prisma.ProductWhereInput {
  if (status === "active") return { promotionEnabled: true, promotionEndsAt: { gt: now }, OR: [{ promotionStartsAt: null }, { promotionStartsAt: { lte: now } }] };
  if (status === "scheduled") return { promotionEnabled: true, promotionStartsAt: { gt: now } };
  if (status === "expired") return { promotionEnabled: true, promotionEndsAt: { lte: now } };
  if (status === "none") return { promotionEnabled: false };
  return {};
}
export function pricedProduct<T extends Product>(product: T, now: Date) {
  return { ...product, ...getProductPricing(product, now), pricingAsOf: now.toISOString() };
}
