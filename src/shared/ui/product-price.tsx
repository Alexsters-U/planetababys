"use client";
import {formatCOP} from "@/lib/money";
import {formatPromotionDate,type PromotionSource} from "@/shared/promotions";
import {useProductPricing} from "@/shared/promotions/use-product-pricing";

export function PriceDisplay({priceCents,originalPriceCents,discountPercent=0,endsAt,large=false,testId="product-price"}:{
  priceCents:number;originalPriceCents?:number|null;discountPercent?:number;endsAt?:string|Date|null;large?:boolean;testId?:string;
}) {
  const onSale=originalPriceCents!=null && originalPriceCents>priceCents;
  return <div className="space-y-1">
    {onSale && <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only">Precio habitual:</span><del className="text-xs text-brand-muted" data-testid="product-original-price">{formatCOP(originalPriceCents!)}</del>
      <span className="rounded-full bg-brand-mintLight px-2 py-1 text-[11px] font-extrabold text-emerald-800" data-testid="promotion-badge">{discountPercent>0?`Ahorra ${discountPercent}%`:"En promoción"}</span>
    </div>}
    <p className={(large?"text-3xl":"text-lg")+" font-extrabold text-brand-primary"} data-testid={testId}>
      <span className="sr-only">{onSale?"Precio de oferta:":"Precio:"}</span>{formatCOP(priceCents)}
    </p>
    {onSale && endsAt && <p className="text-[11px] leading-4 text-brand-muted" data-testid="promotion-validity">Hasta {formatPromotionDate(endsAt)} · hora Colombia</p>}
  </div>;
}
export default function ProductPrice({product,large=false,testId}:{product:PromotionSource;large?:boolean;testId?:string}) {
  const pricing=useProductPricing(product);
  return <PriceDisplay priceCents={pricing.effectivePriceCents} originalPriceCents={pricing.originalPriceCents}
    discountPercent={pricing.discountPercent} endsAt={pricing.promotionActive?product.promotionEndsAt:null} large={large} testId={testId}/>;
}
