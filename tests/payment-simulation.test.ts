import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {config} from "../backend/src/config";
import {db} from "../backend/src/db";
import {orderToken} from "../backend/src/security";
import {applyTransaction,expireReservations} from "../backend/src/orders";
import {simulatePayment} from "../backend/src/payment-simulation";
if(config.APP_ENV!=="test"||!config.DATABASE_URL.includes("/planetababys_test?"))throw new Error("Esta suite requiere la base aislada planetababys_test");
const productIds:string[]=[],orderIds:string[]=[];
async function fixture(provider="simulator",expired=false){
  const product=await db.product.create({data:{name:"Simulación "+randomUUID(),slug:randomUUID(),priceCents:10000,stock:4}});productIds.push(product.id);
  const order=await db.order.create({data:{reference:"TEST-"+randomUUID(),totalCents:10000,customerName:"Cliente Sintético",customerPhone:"3001234567",customerEmail:"test@example.com",shippingAddress:"Calle de prueba 123",shippingCity:"Mocoa",expiresAt:new Date(Date.now()+(expired?-600000:1800000)),items:{create:{productId:product.id,name:product.name,unitCents:10000,quantity:1}},payments:{create:{reference:randomUUID(),amountInCents:10000,provider}}}});orderIds.push(order.id);
  return {product,order,token:await orderToken(order.id)};
}
after(async()=>{await db.order.deleteMany({where:{id:{in:orderIds}}});await db.product.deleteMany({where:{id:{in:productIds}}});await db.$disconnect();});
test("pendiente → aprobado: persiste y los reintentos no duplican stock ni transacciones",async()=>{
  const f=await fixture(),body={orderId:f.order.id,token:f.token,method:"NEQUI"};
  await simulatePayment({...body,status:"PENDING"});
  assert.equal((await db.order.findUniqueOrThrow({where:{id:f.order.id}})).status,"PENDING");
  await simulatePayment({...body,status:"APPROVED"});await simulatePayment({...body,status:"APPROVED"});
  const order=await db.order.findUniqueOrThrow({where:{id:f.order.id},include:{payments:true}});
  assert.equal(order.status,"PAID");assert.equal(order.payments.length,1);assert.equal(order.payments[0].provider,"simulator");assert.equal(order.payments[0].paymentMethod,"NEQUI");assert.equal((await db.product.findUniqueOrThrow({where:{id:f.product.id}})).stock,4);
});
test("rechazo simultáneo libera una sola vez y no puede convertirse después en aprobación",async()=>{
  const f=await fixture(),body={orderId:f.order.id,token:f.token,status:"DECLINED"};
  await Promise.all([simulatePayment(body),simulatePayment(body)]);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:f.product.id}})).stock,5);
  await assert.rejects(()=>simulatePayment({...body,status:"APPROVED"}),{status:409});
  const order=await db.order.findUniqueOrThrow({where:{id:f.order.id}});assert.equal(order.status,"DECLINED");assert.equal(order.reviewRequired,false);
});
test("token, monto, proveedor y ambiente impiden convertir la simulación en un pago real",async()=>{
  const f=await fixture(),real=await fixture("wompi"),body={orderId:f.order.id,token:f.token,status:"APPROVED"};
  await assert.rejects(()=>simulatePayment({...body,token:"forged"}),{status:404});
  await assert.rejects(()=>simulatePayment({...body,amountInCents:1}));
  await assert.rejects(()=>simulatePayment({...body,orderId:real.order.id,token:real.token}),{status:409});
  config.PAYMENT_MODE="wompi";try{await assert.rejects(()=>simulatePayment(body),{status:404});}finally{config.PAYMENT_MODE="test";}
  assert.equal((await db.order.findUniqueOrThrow({where:{id:f.order.id}})).status,"PENDING");
});
test("la reserva simulada vencida se cancela sin esperar 24 horas y no libera dos veces",async()=>{
  const f=await fixture("simulator",true);await expireReservations({orderIds:[f.order.id]});await expireReservations({orderIds:[f.order.id]});
  const order=await db.order.findUniqueOrThrow({where:{id:f.order.id},include:{payments:true}});
  assert.equal(order.status,"CANCELLED");assert.equal(order.stockReleased,true);assert.equal(order.payments[0].status,"VOIDED");
  assert.equal((await db.product.findUniqueOrThrow({where:{id:f.product.id}})).stock,5);
  await assert.rejects(()=>simulatePayment({orderId:f.order.id,token:f.token,status:"APPROVED"}),{status:409});
});
test("confirmación real tardía exige revisión sin volver a descontar inventario",async()=>{
  const f=await fixture("wompi",true);await db.order.update({where:{id:f.order.id},data:{status:"CANCELLED",stockReleased:true}});
  await applyTransaction({id:randomUUID(),reference:f.order.reference,amount_in_cents:10000,currency:"COP",status:"APPROVED"});
  const order=await db.order.findUniqueOrThrow({where:{id:f.order.id}});assert.equal(order.status,"PAID");assert.equal(order.reviewRequired,true);assert.equal((await db.product.findUniqueOrThrow({where:{id:f.product.id}})).stock,4);
});
test("un proveedor caído conserva la reserva para revisión y no bloquea las siguientes",async()=>{
  const real=await fixture("wompi",true),sim=await fixture("simulator",true);
  await db.payment.updateMany({where:{orderId:real.order.id},data:{transactionId:randomUUID()}});
  config.PAYMENT_MODE="wompi";
  try{await expireReservations({orderIds:[real.order.id,sim.order.id],read:async()=>{throw new Error("Proveedor indisponible");}});}finally{config.PAYMENT_MODE="test";}
  const record=await db.order.findUniqueOrThrow({where:{id:real.order.id}});assert.equal(record.stockReleased,false);assert.equal(record.reviewRequired,true);
  assert.equal((await db.order.findUniqueOrThrow({where:{id:sim.order.id}})).status,"CANCELLED");
});
test("un pago real pendiente respeta el margen y una aprobación tardía queda en revisión",async()=>{
  const f=await fixture("wompi"),id=randomUUID(),expiresAt=new Date(Date.now()-1000);
  await db.order.update({where:{id:f.order.id},data:{expiresAt}});
  await db.payment.updateMany({where:{orderId:f.order.id},data:{transactionId:id}});
  const transaction={id,reference:f.order.reference,amount_in_cents:10000,currency:"COP" as const,status:"PENDING" as const};
  config.PAYMENT_MODE="wompi";
  try{
    await expireReservations({orderIds:[f.order.id],read:async()=>transaction});
    assert.equal((await db.order.findUniqueOrThrow({where:{id:f.order.id}})).stockReleased,false);
    await expireReservations({orderIds:[f.order.id],now:new Date(expiresAt.getTime()+301000),read:async()=>transaction});
  }finally{config.PAYMENT_MODE="test";}
  assert.equal((await db.product.findUniqueOrThrow({where:{id:f.product.id}})).stock,5);
  await applyTransaction({...transaction,status:"APPROVED"});
  const order=await db.order.findUniqueOrThrow({where:{id:f.order.id}});assert.equal(order.status,"PAID");assert.equal(order.reviewRequired,true);assert.equal((await db.product.findUniqueOrThrow({where:{id:f.product.id}})).stock,5);
});
