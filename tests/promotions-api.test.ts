import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {PrismaClient} from "@prisma/client";
const db=new PrismaClient();
if(process.env.APP_ENV!=="test" || !process.env.DATABASE_URL?.includes("/planetababys_test?"))throw new Error("Solo base aislada planetababys_test");
const api=(process.env.TEST_API_URL??"http://localhost:4400")+"/api",origin=process.env.SITE_URL??"http://localhost:3100",prefix="Promoción API "+randomUUID().slice(0,8);
let cookie="";const products:string[]=[],orders:string[]=[];
async function request(route:string,method="GET",body?:unknown,headers:Record<string,string>={}){
  return fetch(api+route,{method,headers:{Origin:origin,"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
}
const sale=()=>({promotionEnabled:true,promotionPriceCents:2000050,promotionStartsAt:null,promotionEndsAt:new Date(Date.now()+3600000).toISOString()});
async function product(patch:Record<string,unknown>={}){
  const res=await request("/admin/products","POST",{name:prefix+" "+products.length,priceCents:2500050,stock:10,category:"lactancia",...sale(),...patch});
  assert.equal(res.status,201,JSON.stringify(await res.clone().json()));const {product}=await res.json();products.push(product.id);return product;
}
const customer={name:"María José Gómez",phone:"3001234567",email:"promo@example.com",address:"Calle 12 # 5-34",city:"Mocoa"};
const payload=(items:unknown[])=>({items,customer,dataConsent:true,termsAccepted:true});
async function checkout(body:unknown,key=randomUUID()){
  const res=await request("/orders","POST",body,{"Idempotency-Key":key});const data=await res.json();
  if(res.status===201 && !orders.includes(data.orderId))orders.push(data.orderId);return{res,data};
}
before(async()=>{
  const res=await request("/auth/login","POST",{email:"test@admin.com",password:"password"});assert.equal(res.status,200);
  cookie=res.headers.get("set-cookie")!.split(";")[0];
});
after(async()=>{await db.order.deleteMany({where:{id:{in:orders}}});await db.product.deleteMany({where:{id:{in:products}}});await db.$disconnect();});

test("Promociones inválidas y actualización parcial no dejan inconsistencias ni cambian precios",async()=>{
  for(const patch of [{promotionPriceCents:2500050},{promotionPriceCents:2500051},{promotionPriceCents:null},{promotionEndsAt:null},{promotionStartsAt:new Date(Date.now()+7200000).toISOString()}]){
    const res=await request("/admin/products","POST",{name:prefix+" Inválida",priceCents:2500050,...sale(),...patch});assert.equal(res.status,422);
  }
  assert.equal(await db.product.count({where:{name:prefix+" Inválida"}}),0);
  const p=await product();
  const before=await db.auditLog.count({where:{entityId:p.id}});
  assert.equal((await request("/admin/products/"+p.id,"PATCH",{priceCents:1900000})).status,422);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).priceCents,2500050);
  assert.equal(await db.auditLog.count({where:{entityId:p.id}}),before);
  assert.equal((await request("/admin/products/"+p.id,"PATCH",{stock:11})).status,200);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).promotionPriceCents,2000050);
  const log=await db.auditLog.findFirstOrThrow({where:{entityId:p.id,action:"CREATE_PRODUCT"}});
  assert.equal((log.detail as any).promotionPriceCents,2000050);
});
test("Categoría, búsqueda, estado y paginación se combinan; las ocultas no llegan al cliente",async()=>{
  const active=await product(),future=await product({promotionStartsAt:new Date(Date.now()+1800000).toISOString()}),expired=await product({promotionEndsAt:new Date(Date.now()-1000).toISOString()}),hidden=await product({isActive:false}),plain=await product({promotionEnabled:false,promotionPriceCents:null,promotionEndsAt:null}),other=await product({category:"panales"});
  const query="q="+encodeURIComponent(prefix);
  const publicData=await (await request("/products?"+query+"&category=lactancia&promotions=true&limit=1&page=1")).json();
  // First fixture from the prior test is also active.
  assert.equal(publicData.total,2);assert.equal(publicData.pages,2);assert.equal(publicData.products.length,1);
  const second=await (await request("/products?"+query+"&category=lactancia&promotions=true&limit=1&page=2")).json();
  assert.notEqual(second.products[0].id,publicData.products[0].id);
  for(const data of [publicData,second]){assert.equal(data.products[0].effectivePriceCents,2000050);assert.equal(data.products[0].promotionStatus,"active");}
  for(const [status,id] of [["scheduled",future.id],["expired",expired.id],["none",plain.id]] as const){
    const data=await (await request("/admin/products?"+query+"&promotion="+status+"&pageSize=10")).json();assert.equal(data.total,1);assert.equal(data.products[0].id,id);
  }
  const filtered=await (await request("/admin/products?"+query+"&promotion=active&category=panales&pageSize=10")).json();assert.equal(filtered.total,1);assert.equal(filtered.products[0].id,other.id);
  const quote=await request("/cart/quote","POST",{items:[{productId:hidden.id,quantity:1}]});assert.equal(quote.status,409);
  const detail=await (await request("/products/"+future.slug)).json();assert.equal(detail.product.effectivePriceCents,2500050);
  assert.equal((await request("/cart/quote","POST",{items:[{productId:active.id,quantity:51}]})).status,422);
  assert.equal((await request("/cart/quote","POST",{items:[{productId:active.id,quantity:11}]})).status,409);
});
test("Cotización, reserva, snapshot del pedido y pago usan el precio de oferta exacto",async()=>{
  const p=await product();const items=[{productId:p.id,quantity:2,expectedUnitCents:2000050}];
  const quote=await (await request("/cart/quote","POST",{items})).json();assert.equal(quote.subtotalCents,4000100);assert.equal(quote.items[0].originalPriceCents,2500050);
  const key=randomUUID(),first=await checkout(payload(items),key);assert.equal(first.res.status,201);
  let record=await db.order.findUniqueOrThrow({where:{id:first.data.orderId},include:{items:true,payments:true}});
  assert.equal(record.totalCents,4000100+Number(process.env.SHIPPING_CENTS));assert.equal(record.items[0].unitCents,2000050);assert.equal(record.payments[0].amountInCents,record.totalCents);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,8);
  await db.product.update({where:{id:p.id},data:{promotionEndsAt:new Date(Date.now()-1000)}});
  const retry=await checkout(payload(items),key);assert.equal(retry.res.status,201);assert.equal(retry.data.orderId,first.data.orderId);assert.equal(retry.data.totalCents,record.totalCents);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,8);
  const transaction={id:randomUUID(),status:"APPROVED",amount_in_cents:record.totalCents,currency:"COP",reference:record.reference,payment_method_type:"NEQUI"};
  const timestamp=Math.floor(Date.now()/1000),properties=["transaction.id","transaction.status","transaction.amount_in_cents","transaction.reference","transaction.currency"];
  const checksum=createHash("sha256").update(transaction.id+transaction.status+transaction.amount_in_cents+transaction.reference+"COP"+timestamp+process.env.WOMPI_EVENTS_KEY).digest("hex");
  assert.equal((await request("/webhooks/wompi","POST",{event:"transaction.updated",environment:"test",timestamp,data:{transaction},signature:{checksum,properties}})).status,200);
  record=await db.order.findUniqueOrThrow({where:{id:record.id},include:{items:true,payments:true}});assert.equal(record.status,"PAID");assert.equal(record.items[0].unitCents,2000050);
});
test("Oferta vencida: cotización vuelve al habitual, precio anterior da 409 y no reserva stock",async()=>{
  const p=await product(),key=randomUUID();
  assert.equal((await request("/admin/products/"+p.id,"PATCH",{promotionEndsAt:new Date(Date.now()-1000).toISOString()})).status,200);
  const quote=await (await request("/cart/quote","POST",{items:[{productId:p.id,quantity:1}]})).json();assert.equal(quote.items[0].priceCents,2500050);assert.equal(quote.items[0].originalPriceCents,null);
  const stale=await checkout(payload([{productId:p.id,quantity:1,expectedUnitCents:2000050}]),key);assert.equal(stale.res.status,409);assert.match(stale.data.error,/precio.*cambió/);
  assert.equal(await db.order.count({where:{checkoutKey:key}}),0);assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,10);
  const valid=await checkout(payload([{productId:p.id,quantity:1,expectedUnitCents:2500050}]));assert.equal(valid.res.status,201);assert.equal(valid.data.totalCents,2500050+Number(process.env.SHIPPING_CENTS));
});
test("Activación programada y retirada se reflejan sin tarea periódica",async()=>{
  const p=await product({promotionStartsAt:new Date(Date.now()+1800000).toISOString()});
  let quote=await (await request("/cart/quote","POST",{items:[{productId:p.id,quantity:1}]})).json();assert.equal(quote.items[0].priceCents,2500050);
  await db.product.update({where:{id:p.id},data:{promotionStartsAt:new Date(Date.now()-1000)}});
  quote=await (await request("/cart/quote","POST",{items:[{productId:p.id,quantity:1}]})).json();assert.equal(quote.items[0].priceCents,2000050);
  assert.equal((await request("/admin/products/"+p.id,"PATCH",{promotionEnabled:false,promotionPriceCents:null,promotionStartsAt:null,promotionEndsAt:null})).status,200);
  quote=await (await request("/cart/quote","POST",{items:[{productId:p.id,quantity:1}]})).json();assert.equal(quote.items[0].priceCents,2500050);
});
test("Carrito mixto inválido revierte todas las reservas y CHECK protege escrituras directas",async()=>{
  const a=await product(),b=await product();const sorted=[a,b].sort((x,y)=>x.id.localeCompare(y.id));
  const result=await checkout(payload([{productId:sorted[0].id,quantity:1,expectedUnitCents:2000050},{productId:sorted[1].id,quantity:1,expectedUnitCents:100}]));assert.equal(result.res.status,409);
  for(const p of sorted)assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,10);
  await assert.rejects(db.product.update({where:{id:a.id},data:{promotionPriceCents:2500050}}));
  await assert.rejects(db.product.update({where:{id:a.id},data:{promotionEndsAt:null}}));
  assert.equal((await db.product.findUniqueOrThrow({where:{id:a.id}})).promotionPriceCents,2000050);
});
