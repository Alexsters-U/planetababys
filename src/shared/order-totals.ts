export function orderTotals(items:readonly {unitCents:number;quantity:number}[],shippingCents:number,totalCents:number) {
  const subtotalCents=items.reduce((sum,item)=>sum+item.unitCents*item.quantity,0);
  return {subtotalCents,shippingCents,totalCents,differenceCents:totalCents-subtotalCents-shippingCents};
}
