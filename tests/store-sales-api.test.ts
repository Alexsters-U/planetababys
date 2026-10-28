import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import type {StoreSaleInput,StoreSaleList,StoreSaleView} from "../src/shared/store-sales";
import type {DashboardSummary} from "../src/shared/analytics";
if(process.env.APP_ENV!=="test"||!process.env.DATABASE_URL?.includes("/planetababys_test?"))throw Error("Solo se permiten pruebas en planetababys_test");
const db=new PrismaClient(),api=process.env.TEST_API_URL??"http://localhost:4400",origin=process.env.SITE_URL??"http://localhost:3100",prefix="Local fixture "+randomUUID();
const products:string[]=[],sales:string[]=[],orders:string[]=[],quotes:string[]=[];let cookie="";
async function request(route:string,method="GET",body?:unknown,key?:string,auth=true,otherHeaders:Record<string,string>={}){
  const init={method,headers:{Origin:origin,"Content-Type":"application/json",...(auth?{Cookie:cookie}:{}),...(key?{"Idempotency-Key":key}:{}),...otherHeaders},body:body===undefined?undefined:JSON.stringify(body)};
  let response=await fetch(api+"/api"+route,init);
  for(let attempt=0;response.status===429&&attempt<3;attempt++){await new Promise(resolve=>setTimeout(resolve,(Number(response.headers.get("retry-after"))||60)*1000+1100));response=await fetch(api+"/api"+route,init);}
  return response;
}
async function product(stock=10,patch:Record<string,unknown>={}){const p=await db.product.create({data:{name:prefix,slug:randomUUID(),priceCents:1250050,stock,...patch}});products.push(p.id);return p;}
function payload(p:{id:string;priceCents:number},patch:Partial<StoreSaleInput>={}):StoreSaleInput{return {items:[{productId:p.id,quantity:1,expectedUnitCents:p.priceCents}],paymentMethod:"CASH",notes:"",paymentConfirmed:true,...patch};}
async function record(input:StoreSaleInput,key=randomUUID()){
  const response=await request("/admin/store-sales","POST",input,key);const data=await response.json();if(response.ok&&!sales.includes(data.sale.id))sales.push(data.sale.id);return {response,data:data as {sale:StoreSaleView;replayed:boolean;error?:string},key};
}
const summary=async()=>{const res=await request("/admin/summary?days=7");assert.equal(res.status,200);return await res.json() as DashboardSummary;};
before(async()=>{const response=await request("/auth/login","POST",{email:"test@admin.com",password:"password"},undefined,false);assert.equal(response.status,200);cookie=response.headers.get("set-cookie")!.split(";")[0];});
after(async()=>{
  await db.order.deleteMany({where:{id:{in:orders}}});await db.shippingQuote.deleteMany({where:{id:{in:quotes}}});
  await db.auditLog.deleteMany({where:{entity:"StoreSale",entityId:{in:sales}}});await db.storeSale.deleteMany({where:{id:{in:sales}}});await db.product.deleteMany({where:{id:{in:products}}});await db.$disconnect();
});

test("Solo administradores, origen propio y datos estrictos; no acepta tarjeta ni totales impuestos",async()=>{
  const p=await product(),body=payload(p);
  assert.equal((await request("/admin/store-sales","GET",undefined,undefined,false)).status,401);
  assert.equal((await request("/admin/store-sales","POST",body,randomUUID(),false)).status,401);
  assert.equal((await request("/admin/store-sales/ajena/void","POST",{reason:"Prueba",returnToStock:true},undefined,false)).status,401);
  assert.equal((await request("/admin/store-sales","POST",body,randomUUID(),true,{Origin:"https://otro.example"})).status,403);
  for(const patch of [{paymentMethod:"CARD"},{totalCents:1},{paymentConfirmed:false},{items:[]},{items:[body.items[0],body.items[0]]},{cashReceivedCents:1.5},{paymentMethod:"TRANSFER",cashReceivedCents:2000000},{paymentReference:"no aplica"}])assert.equal((await request("/admin/store-sales","POST",{...body,...patch},randomUUID())).status,422);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,10);
});

test("Efectivo: calcula promoción, cambio, snapshots y auditoría sin fabricar pedidos ni pagos Wompi",async()=>{
  const p=await product(5,{promotionEnabled:true,promotionPriceCents:1000050,promotionEndsAt:new Date(Date.now()+3600000)});
  const input=payload(p,{items:[{productId:p.id,quantity:2,expectedUnitCents:1000050}],cashReceivedCents:2500000,notes:"Venta presencial de prueba"});
  const {response,data,key}=await record(input);assert.equal(response.status,201);assert.equal(data.sale.totalCents,2000100);assert.equal(data.sale.cashChangeCents,499900);assert.equal(data.sale.status,"COMPLETED");
  assert.equal(data.sale.items[0].unitCents,1000050);assert.ok(data.sale.recordedBy.name);assert.equal("saleKey" in data.sale,false);assert.equal("requestHash" in data.sale,false);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,3);
  assert.equal(await db.order.count({where:{reference:data.sale.reference}}),0);assert.equal(await db.payment.count({where:{reference:data.sale.reference}}),0);
  assert.equal(await db.auditLog.count({where:{entity:"StoreSale",entityId:data.sale.id,action:"RECORD_STORE_SALE"}}),1);
  const replay=await record(input,key);assert.equal(replay.response.status,200);assert.equal(replay.data.sale.id,data.sale.id);assert.equal(replay.data.replayed,true);
  assert.equal((await record({...input,notes:"Otra venta"},key)).response.status,409);assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,3);
  await db.product.update({where:{id:p.id},data:{name:"Nombre actualizado",priceCents:1900000,promotionEnabled:false}});
  const listed=await (await request("/admin/store-sales?q="+data.sale.reference)).json() as StoreSaleList;assert.equal(listed.sales[0].items[0].name,p.name);assert.equal(listed.sales[0].items[0].unitCents,1000050);
  assert.equal((await request("/admin/products/"+p.id,"DELETE")).status,409);
});

test("Transferencia y productos ocultos en la web; referencia opcional y efectivo exacto",async()=>{
  const p=await product(3,{isActive:false});
  const transfer=await record(payload(p,{paymentMethod:"TRANSFER",paymentReference:"TRANSFERENCIA PRUEBA"}));assert.equal(transfer.response.status,201);assert.equal(transfer.data.sale.paymentReference,"TRANSFERENCIA PRUEBA");assert.equal(transfer.data.sale.cashReceivedCents,null);assert.equal(transfer.data.sale.cashChangeCents,null);
  const cash=await record(payload(p));assert.equal(cash.response.status,201);assert.equal(cash.data.sale.cashReceivedCents,p.priceCents);assert.equal(cash.data.sale.cashChangeCents,0);
  const quote=await request("/admin/store-sales/quote","POST",{items:[{productId:p.id,quantity:1}]});assert.equal(quote.status,200);assert.equal((await quote.json()).items[0].stock,1);
});

test("Stock insuficiente, precio cambiado y efectivo insuficiente revierten toda la operación",async()=>{
  const a=await product(3),b=await product(0);
  assert.equal((await record(payload(a,{cashReceivedCents:100}))).response.status,422);
  assert.equal((await record(payload(a,{items:[{productId:a.id,quantity:1,expectedUnitCents:a.priceCents+1}]}))).response.status,409);
  assert.equal((await record(payload(a,{items:[{productId:a.id,quantity:2,expectedUnitCents:a.priceCents},{productId:b.id,quantity:1,expectedUnitCents:b.priceCents}]}))).response.status,409);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:a.id}})).stock,3);assert.equal(await db.storeSaleItem.count({where:{productId:a.id}}),0);
});

test("Concurrencia local: una última unidad y reintentos simultáneos con la misma clave",async()=>{
  const p=await product(1),input=payload(p);const result=await Promise.all([record(input),record(input)]);assert.deepEqual(result.map(r=>r.response.status).sort(),[201,409]);assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,0);
  const q=await product(2),key=randomUUID();const replays=await Promise.all([record(payload(q),key),record(payload(q),key)]);assert.deepEqual(replays.map(r=>r.response.status).sort(),[200,201]);assert.equal(replays[0].data.sale.id,replays[1].data.sale.id);assert.equal((await db.product.findUniqueOrThrow({where:{id:q.id}})).stock,1);
});

test("Web y local compiten por el mismo inventario sin vender dos veces la última unidad",async()=>{
  const p=await product(1),input={items:[{productId:p.id,quantity:1,expectedUnitCents:p.priceCents}],customer:{name:"Cliente Prueba",phone:"3001234567",email:"local-test@example.com",address:"Calle de prueba número 20",city:"Mocoa"},dataConsent:true,termsAccepted:true};
  const quoteResponse=await request("/shipping/quotes","POST",input,randomUUID());assert.equal(quoteResponse.status,201);const quote=await quoteResponse.json();quotes.push(quote.id);
  assert.equal((await request("/admin/shipping-quotes/"+quote.id,"PATCH",{shippingCents:0,deliveryEstimate:"Recogida de prueba"})).status,200);
  const [local,web]=await Promise.all([record(payload(p)),request("/orders","POST",{...input,shippingQuoteToken:quote.token,shippingQuoteAccepted:true},randomUUID())]);
  const webData=await web.json();if(web.status===201)orders.push(webData.orderId);assert.deepEqual([local.response.status,web.status].sort(),[201,409]);assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,0);
});

test("Anulación con motivo y confirmación: devuelve stock una sola vez y conserva historial",async()=>{
  const p=await product(6),input=payload(p,{items:[{productId:p.id,quantity:2,expectedUnitCents:p.priceCents}]}),sale=await record(input);
  assert.equal((await request("/admin/store-sales/"+sale.data.sale.id+"/void","POST",{reason:"Error",returnToStock:false})).status,422);
  const result=await Promise.all([request("/admin/store-sales/"+sale.data.sale.id+"/void","POST",{reason:"Venta duplicada por error",returnToStock:true}),request("/admin/store-sales/"+sale.data.sale.id+"/void","POST",{reason:"Venta duplicada por error",returnToStock:true})]);assert.ok(result.every(r=>r.status===200));
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,6);assert.equal(await db.auditLog.count({where:{entityId:sale.data.sale.id,action:"VOID_STORE_SALE"}}),1);
  const replay=await record(input,sale.key);assert.equal(replay.response.status,200);assert.equal(replay.data.sale.status,"VOIDED");assert.equal(replay.data.sale.voidReason,"Venta duplicada por error");assert.ok(replay.data.sale.voidedBy);assert.ok(replay.data.sale.voidedAt);
  assert.equal((await request("/admin/store-sales/inexistente/void","POST",{reason:"Venta ajena",returnToStock:true})).status,404);
});

test("Historial paginado, filtros y sumas de todo el resultado; no solo la página visible",async()=>{
  const p=await product(15);for(let i=0;i<11;i++)assert.equal((await record(payload(p,{paymentMethod:i%2?"TRANSFER":"CASH"}))).response.status,201);
  const response=await request("/admin/store-sales?pageSize=10&page=999");assert.equal(response.status,200);const result=await response.json() as StoreSaleList;assert.equal(result.page,result.pages);assert.ok(result.sales.length<=10);assert.equal(result.summary.salesCents,result.summary.cashCents+result.summary.transferCents);
  const cash=await (await request("/admin/store-sales?paymentMethod=CASH&status=COMPLETED")).json() as StoreSaleList;assert.ok(cash.sales.every(s=>s.paymentMethod==="CASH"&&s.status==="COMPLETED"));assert.equal(cash.summary.transferCents,0);
  const reference=cash.sales[0].reference;const exact=await (await request("/admin/store-sales?q="+reference)).json() as StoreSaleList;assert.equal(exact.total,1);assert.equal(exact.summary.salesCents,exact.sales[0].totalCents);
});

test("Resumen combina canales, serie y productos favoritos; excluye anulaciones y nunca suma Wompi dos veces",async()=>{
  const p=await product(10),before=await summary(),input=payload(p,{items:[{productId:p.id,quantity:4,expectedUnitCents:p.priceCents}],paymentMethod:"TRANSFER"}),sale=await record(input);assert.equal(sale.response.status,201);
  const after=await summary();assert.equal(after.metrics.salesCents-before.metrics.salesCents,4*p.priceCents);assert.equal(after.channels.local.salesCents-before.channels.local.salesCents,4*p.priceCents);assert.equal(after.channels.web.salesCents,before.channels.web.salesCents);assert.equal(after.metrics.paidOrders-before.metrics.paidOrders,1);assert.equal(after.metrics.placedOrders,before.metrics.placedOrders);
  assert.equal(after.channels.web.salesCents+after.channels.local.salesCents,after.metrics.salesCents);assert.equal(after.dailySales.reduce((sum,day)=>sum+day.salesCents,0),after.metrics.salesCents);assert.ok(after.topProducts.some(row=>row.productId===p.id&&row.quantity===4));
  assert.equal((await request("/admin/store-sales/"+sale.data.sale.id+"/void","POST",{reason:"Corrección de registro",returnToStock:true})).status,200);const final=await summary();assert.equal(final.metrics.salesCents,before.metrics.salesCents);assert.equal(final.channels.local.salesCents,before.channels.local.salesCents);
});
