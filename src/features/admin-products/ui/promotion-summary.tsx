"use client";
import { formatCOP } from "@/lib/money";
import { formatPromotionDate, PROMOTION_LABELS, type PromotionSource } from "@/shared/promotions";
import { useProductPricing } from "@/shared/promotions/use-product-pricing";

export default function PromotionSummary({ product }: { product: PromotionSource }) {
  const { promotionStatus } = useProductPricing(product);
  const colors = { active: "bg-mint-100 text-mint-700", scheduled: "bg-amber-100 text-amber-800", expired: "bg-gray-100 text-gray-600", none: "bg-gray-100 text-gray-500" };
  return <div className="min-w-32 space-y-1" data-testid="row-promotion">
    <span className={"badge " + colors[promotionStatus]}>{PROMOTION_LABELS[promotionStatus]}</span>
    {promotionStatus !== "none" && <>
      <p className="text-xs text-gray-600">Oferta: {formatCOP(product.promotionPriceCents!)}</p>
      <p className="text-[11px] text-gray-500">{promotionStatus === "scheduled" ? "Desde " + formatPromotionDate(product.promotionStartsAt!) : "Hasta " + formatPromotionDate(product.promotionEndsAt!)} · Colombia</p>
    </>}
  </div>;
}
