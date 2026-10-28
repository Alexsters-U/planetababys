import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {POLICY_VERSION,storeProfile} from "../src/shared/store-profile";
import type {CheckoutInput} from "../src/shared/validation";
if(process.env.APP_ENV!=="test"||!process.env.DATABASE_URL?.includes("/planetababys_test?"))throw new Error("Solo se permiten fixtures en planetababys_test");
const db=new PrismaClient(),origin=process.env.SITE_URL??"http://localhost:3100",prefix="Envios fixture "+randomUUID();
const productIds:string[]=[],quoteIds:string[]=[],orderIds:string[]=[];
let cookie="";
async function request(route:string,method="GET",body?:unknown,key?:string,admin=false){
  const init={method,headers:{Origin:origin,"Content-Type":"application/json",...(key?{"Idempotency-Key":key}:{}),...(admin?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)};
  let response=await fetch(origin+"/api"+route,init);
  for(let attempt=0;response.status===429&&attempt<3;attempt++){
    await new Promise(resolve=>setTimeout(resolve,(Number(response.headers.get("retry-after"))||60)*1000+1100));
    response=await fetch(origin+"/api"+route,init);
  }
  return response;
}
async function fixture(){
  const product=await db.product.create({data:{name:prefix,slug:randomUUID(),priceCents:1200050,stock:5}});productIds.push(product.id);
  const input:CheckoutInput={items:[{productId:product.id,quantity:2,expectedUnitCents:product.priceCents}],customer:{name:"Cliente Sintético",phone:"3001234567",email:"envios@example.com",address:"Calle 10 número 20",city:"Bogotá",notes:"Prueba sin envío real"},dataConsent:true,termsAccepted:true};
  const key=randomUUID(),res=await request("/shipping/quotes","POST",input,key);
  assert.equal(res.status,201);const quote=await res.json();quoteIds.push(quote.id);
  return {product,input,key,quote};
}
async function confirm(id:string){const response=await request("/admin/shipping-quotes/"+id,"PATCH",{shippingCents:500025,deliveryEstimate:"2 a 3 días hábiles"},undefined,true);assert.equal(response.status,200);}
async function pay(input:CheckoutInput,token:string,key=randomUUID()){
  const response=await request("/orders","POST",{...input,shippingQuoteToken:token,shippingQuoteAccepted:true},key);const data=await response.json();
  if(response.status===201&&!orderIds.includes(data.orderId))orderIds.push(data.orderId);
  return {response,data};
}
before(async()=>{const login=await request("/auth/login","POST",{email:"test@admin.com",password:"password"});assert.equal(login.status,200);cookie=login.headers.get("set-cookie")!.split(";")[0];});
after(async()=>{
  await db.order.deleteMany({where:{id:{in:orderIds}}});await db.shippingQuote.deleteMany({where:{id:{in:quoteIds}}});
  await db.product.deleteMany({where:{id:{in:productIds}}});
  assert.equal(await db.shippingQuote.count({where:{id:{in:quoteIds}}}),0);
  console.log("Limpieza por IDs de fixtures verificada; no se enviaron mensajes ni se ejecutaron pagos reales.");await db.$disconnect();
});
test("Datos legales confirmados; costo desconocido no es envío gratuito",async()=>{
  const config=await (await request("/store/config")).json();assert.equal(config.shippingMode,"quote");assert.equal(config.shippingCents,null);assert.deepEqual(config.legal,storeProfile);
});
test("Solicitud privada e idempotente, consentimiento obligatorio, sin reserva ni pago",async()=>{
  const {product,input,key,quote}=await fixture();
  assert.equal((await request("/shipping/quotes","POST",{...input,dataConsent:false},randomUUID())).status,422);
  const retry=await (await request("/shipping/quotes","POST",input,key)).json();assert.equal(retry.id,quote.id);
  assert.equal((await request("/shipping/quotes","POST",{...input,customer:{...input.customer,address:"Otra dirección 123"}},key)).status,409);
  assert.equal((await request("/shipping/quotes/"+quote.id)).status,403);
  assert.equal((await request("/shipping/quotes/"+quote.id+"?token="+quote.token)).status,200);
  assert.equal((await request("/admin/shipping-quotes")).status,401);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,5);
  assert.equal(await db.order.count({where:{shippingQuoteId:quote.id}}),0);
  const record=await db.shippingQuote.findUniqueOrThrow({where:{id:quote.id}});assert.equal(record.policyVersion,POLICY_VERSION);assert.ok(record.consentAt);
  assert.equal((await pay(input,quote.token)).response.status,409);
});
test("Solo admin confirma tarifa y plazo; total exacto, pago idempotente y enlace recuperable",async()=>{
  const {product,input,quote}=await fixture();
  assert.equal((await request("/admin/shipping-quotes/"+quote.id,"PATCH",{shippingCents:500025,deliveryEstimate:"2 días"})).status,401);
  assert.equal((await request("/admin/shipping-quotes/"+quote.id,"PATCH",{shippingCents:"5000",deliveryEstimate:"2 días"},undefined,true)).status,422);
  await confirm(quote.id);
  assert.equal((await request("/orders","POST",{...input,shippingQuoteToken:quote.token},randomUUID())).status,422);
  assert.equal((await request("/admin/shipping-quotes/"+quote.id,"PATCH",{shippingCents:0,deliveryEstimate:"2 días"},undefined,true)).status,409);
  const key=randomUUID(),first=await pay(input,quote.token,key),retry=await pay(input,quote.token,key);
  assert.equal(first.response.status,201);assert.equal(first.data.totalCents,2900125);assert.equal(first.data.shippingCents,500025);assert.equal(retry.data.orderId,first.data.orderId);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,3);
  const record=await db.order.findUniqueOrThrow({where:{id:first.data.orderId},include:{payments:true}});assert.equal(record.policyVersion,POLICY_VERSION);assert.equal(record.payments[0].amountInCents,2900125);
  const retrieved=await (await request("/shipping/quotes/"+quote.id+"?token="+quote.token)).json();assert.ok(retrieved.orderUrl);assert.ok(retrieved.paymentUrl);
  assert.equal((await pay(input,quote.token)).response.status,409);
});
test("Impide alterar dirección, cantidades o cargos; precio nuevo revierte la reserva y el consumo",async()=>{
  const {product,input,quote}=await fixture();await confirm(quote.id);
  assert.equal((await pay({...input,customer:{...input.customer,address:"Otra dirección 789"}},quote.token)).response.status,409);
  assert.equal((await pay({...input,items:[{...input.items[0],quantity:1}]},quote.token)).response.status,409);
  assert.equal((await request("/orders","POST",{...input,shippingQuoteToken:quote.token,shippingCents:0},randomUUID())).status,422);
  await db.product.update({where:{id:product.id},data:{priceCents:1300000}});
  assert.equal((await pay(input,quote.token)).response.status,409);
  assert.equal((await db.shippingQuote.findUniqueOrThrow({where:{id:quote.id}})).status,"QUOTED");assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,5);
});
test("Vencimiento, rechazo y concurrencia: una sola cotización produce un solo pedido",async()=>{
  const expired=await fixture();await confirm(expired.quote.id);await db.shippingQuote.update({where:{id:expired.quote.id},data:{expiresAt:new Date(Date.now()-1000)}});
  assert.equal((await pay(expired.input,expired.quote.token)).response.status,409);
  const declined=await fixture();assert.equal((await request("/admin/shipping-quotes/"+declined.quote.id+"/decline","POST",undefined,undefined,true)).status,200);
  assert.equal((await pay(declined.input,declined.quote.token)).response.status,409);
  const race=await fixture();await confirm(race.quote.id);const results=await Promise.all([pay(race.input,race.quote.token),pay(race.input,race.quote.token)]);
  assert.deepEqual(results.map(result=>result.response.status).sort(),[201,409]);assert.equal((await db.product.findUniqueOrThrow({where:{id:race.product.id}})).stock,3);
  const list=await (await request("/admin/shipping-quotes?q="+race.quote.reference+"&pageSize=10&page=999",undefined,undefined,undefined,true)).json();assert.equal(list.total,1);assert.equal(list.page,1);assert.equal(list.quotes[0].id,race.quote.id);
});
