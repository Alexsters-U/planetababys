import {test} from "node:test";
import assert from "node:assert/strict";
import {newerNotices} from "../src/shared/admin-notifications";
import {orderTotals} from "../src/shared/order-totals";

test("el pedido muestra productos y envío usando sus importes guardados",()=>{
  assert.deepEqual(orderTotals([{quantity:1,unitCents:12900000}],40000000,52900000),{subtotalCents:12900000,shippingCents:40000000,totalCents:52900000,differenceCents:0});
});
test("varias unidades, descuentos ya aplicados y centavos no se recalculan desde el catálogo",()=>{
  assert.equal(orderTotals([{quantity:3,unitCents:100050},{quantity:2,unitCents:80000}],50025,510175).differenceCents,0);
});
test("el envío gratuito es cero y una discrepancia histórica no se inventa como cargo",()=>{
  assert.equal(orderTotals([{quantity:2,unitCents:10000}],0,20000).differenceCents,0);
  assert.equal(orderTotals([{quantity:1,unitCents:10000}],1000,12000).differenceCents,1000);
  assert.equal(orderTotals([{quantity:1,unitCents:10000}],1000,9000).differenceCents,-2000);
});
const recent=[{id:"b",reference:"ENV-B",createdAt:"2026-10-28T15:00:01.000Z"},{id:"a",reference:"ENV-A",createdAt:"2026-10-28T15:00:00.000Z"}];
test("el primer acceso establece un punto de partida sin repetir avisos históricos",()=>{
  assert.deepEqual(newerNotices(recent,null),[]);
  assert.deepEqual(newerNotices(recent,{id:"b",createdAt:recent[0].createdAt}),[]);
});
test("una solicitud nueva se detecta aunque otra ya haya sido gestionada",()=>{
  assert.deepEqual(newerNotices(recent,{id:"a",createdAt:recent[1].createdAt}).map(item=>item.id),["b"]);
});
test("desempata solicitudes del mismo instante y acepta fechas ISO equivalentes",()=>{
  assert.deepEqual(newerNotices([{...recent[1],id:"c"}],{id:"a",createdAt:"2026-10-28T15:00:00Z"}).map(item=>item.id),["c"]);
});
