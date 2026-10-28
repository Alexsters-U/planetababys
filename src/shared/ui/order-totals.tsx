import {formatCOP} from "@/lib/money";
import {orderTotals} from "@/shared/order-totals";

export default function OrderTotals({items,shippingCents,totalCents,testPrefix="order"}:{
  items:readonly {unitCents:number;quantity:number}[];shippingCents:number;totalCents:number;testPrefix?:string;
}) {
  const totals=orderTotals(items,shippingCents,totalCents);
  return <div className="mt-4 border-t border-brand-line pt-3">
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3"><dt>Subtotal de productos</dt><dd className="shrink-0" data-testid={`${testPrefix}-subtotal`}>{formatCOP(totals.subtotalCents)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Envío</dt><dd className="shrink-0" data-testid={`${testPrefix}-shipping`}>{formatCOP(shippingCents)}{shippingCents===0&&" · Sin costo"}</dd></div>
      {totals.differenceCents!==0&&<div className="flex justify-between gap-3 text-amber-900"><dt>Diferencia por revisar</dt><dd className="shrink-0">{formatCOP(totals.differenceCents)}</dd></div>}
      <div className="flex justify-between gap-3 border-t border-brand-line pt-3 text-base font-extrabold"><dt>Total del pedido</dt><dd className="shrink-0" data-testid={`${testPrefix}-total`}>{formatCOP(totalCents)}</dd></div>
    </dl>
    {totals.differenceCents!==0&&<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">El total guardado difiere de la suma de productos y envío. Revisa el registro antes de continuar.</p>}
  </div>;
}
