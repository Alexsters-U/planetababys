import {test} from "node:test";
import assert from "node:assert/strict";
import {getProductPricing,promotionDateInput,promotionDateISO,formatPromotionDate} from "../src/shared/promotions";
import {productCreateSchema,productUpdateSchema,cartQuoteSchema,priceInputSchema} from "../src/shared/validation";
import {formatCOP} from "../src/lib/money";

const base={name:"Tetero de prueba",priceCents:2500050,stock:5,promotionEnabled:true,promotionPriceCents:2000000,promotionStartsAt:"2026-10-03T15:00:00.000Z",promotionEndsAt:"2026-10-04T15:00:00.000Z"};
test("Inicio inclusivo, final exclusivo y precio habitual fuera de vigencia",()=>{
  assert.equal(getProductPricing(base,new Date("2026-10-03T14:59:59.999Z")).promotionStatus,"scheduled");
  const start=getProductPricing(base,new Date(base.promotionStartsAt));
  assert.equal(start.effectivePriceCents,2000000);assert.equal(start.originalPriceCents,2500050);assert.equal(start.discountPercent,20);
  assert.equal(getProductPricing(base,new Date("2026-10-04T14:59:59.999Z")).promotionActive,true);
  const end=getProductPricing(base,new Date(base.promotionEndsAt));
  assert.equal(end.promotionStatus,"expired");assert.equal(end.effectivePriceCents,base.priceCents);assert.equal(end.originalPriceCents,null);
});
test("Inicio inmediato, desactivación y configuraciones inválidas no descuentan",()=>{
  const now=new Date("2026-10-03T14:00:00Z");
  assert.equal(getProductPricing({...base,promotionStartsAt:null},now).promotionActive,true);
  for(const patch of [{promotionEnabled:false},{promotionPriceCents:2500050},{promotionPriceCents:99},{promotionPriceCents:1.5},{promotionEndsAt:null},{promotionStartsAt:"inválida"},{promotionEndsAt:"inválida"}])
    assert.equal(getProductPricing({...base,...patch},now).effectivePriceCents,base.priceCents);
});
test("Descuento porcentual conservador y centavos sin redondear el precio",()=>{
  const p=getProductPricing({...base,promotionStartsAt:null,promotionPriceCents:2000050},new Date("2026-10-03T14:00:00Z"));
  assert.equal(p.discountPercent,19);assert.equal(p.effectivePriceCents,2000050);
  assert.match(formatCOP(2500050),/25\.000,50/);assert.match(formatCOP(2500000),/25\.000$/);
  assert.equal(priceInputSchema.parse("20000,50"),2000050);
  assert.equal(formatCOP(2500050),"$ 25.000,50");assert.equal(formatCOP(100),"$ 1");assert.equal(formatCOP(101),"$ 1,01");
});
test("Hora de Colombia independiente de la zona del dispositivo, incluida medianoche",()=>{
  assert.equal(promotionDateISO("2026-10-03T23:59"),"2026-10-04T04:59:00.000Z");
  assert.equal(promotionDateInput("2026-10-04T04:59:00.000Z"),"2026-10-03T23:59");
  assert.equal(promotionDateISO(""),null);assert.equal(promotionDateISO("fecha inválida"),null);
  assert.equal(promotionDateInput(null),"");
  assert.equal(formatPromotionDate("2026-10-04T04:59:00.000Z"),"3 oct 2026, 11:59 p. m.");
});
test("Validación de precio menor, final obligatorio y orden de fechas",()=>{
  assert.equal(productCreateSchema.safeParse(base).success,true);
  for(const patch of [{promotionPriceCents:null},{promotionPriceCents:base.priceCents},{promotionPriceCents:base.priceCents+1},{promotionEndsAt:null},{promotionStartsAt:base.promotionEndsAt},{promotionStartsAt:"2026-10-05T15:00:00Z"},{promotionPriceCents:"2000000"}])
    assert.equal(productCreateSchema.safeParse({...base,...patch}).success,false);
  assert.equal(productCreateSchema.safeParse({...base,promotionStartsAt:null}).success,true);
  // Existing expired offers can be edited without unexpectedly renewing them.
  assert.equal(productCreateSchema.safeParse({...base,promotionEndsAt:"2026-10-03T15:01:00Z"}).success,true);
  assert.deepEqual(productUpdateSchema.parse({stock:4}),{stock:4});
});
test("Cotización limitada, productos únicos y precio esperado opcional compatible",()=>{
  assert.equal(cartQuoteSchema.safeParse({items:[{productId:"a",quantity:1}]}).success,true);
  assert.equal(cartQuoteSchema.safeParse({items:[{productId:"a",quantity:1,expectedUnitCents:2000050}]}).success,true);
  for(const items of [[],[{productId:"a",quantity:0}],[{productId:"a",quantity:1},{productId:"a",quantity:1}],[{productId:"a",quantity:1,expectedUnitCents:99}],[{productId:"a",quantity:1,promotionPriceCents:100}]])
    assert.equal(cartQuoteSchema.safeParse({items}).success,false);
});
