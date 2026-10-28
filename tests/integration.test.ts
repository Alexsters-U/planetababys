import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {readFile} from "node:fs/promises";
const db=new PrismaClient();
const api=process.env.TEST_API_URL??"http://localhost:4400";
const origin=process.env.SITE_URL??"http://localhost:3100";
if(process.env.APP_ENV!=="test" || !process.env.DATABASE_URL?.includes("/planetababys_test?")) throw new Error("Solo se permiten pruebas sobre planetababys_test");
let cookie="";
const products:string[]=[];const orders:string[]=[];
async function request(route:string,method="GET",body?:unknown,headers:Record<string,string>={}) {
  return fetch(api+"/api"+route,{method,headers:{Origin:origin,"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
}
async function product(stock:number) {
  const response=await request("/admin/products","POST",{name:"Integración "+randomUUID(),priceCents:1250000,stock,category:"panales"});
  assert.equal(response.status,201);
  const {product}=await response.json() as {product:{id:string;slug:string}};
  products.push(product.id);return product;
}
const customer={name:"Cliente de Prueba",phone:"3001234567",email:"cliente@example.com",address:"Calle 12 # 5-34, barrio Centro",city:"Mocoa"};
const input=(id:string)=>({items:[{productId:id,quantity:1}],customer,dataConsent:true,termsAccepted:true});
async function checkout(id:string,key=randomUUID()) {
  const response=await request("/orders","POST",input(id),{"Idempotency-Key":key});
  const data=await response.json() as {orderId:string;reference:string;totalCents:number;orderToken:string};
  if(response.status===201 && !orders.includes(data.orderId)) orders.push(data.orderId);
  return {response,data};
}
async function event(order:{reference:string;totalCents:number},status:string,tx=randomUUID(),alter=false) {
  const transaction={id:tx,status,amount_in_cents:order.totalCents,currency:"COP",reference:order.reference,payment_method_type:"NEQUI"};
  const properties=["transaction.id","transaction.status","transaction.amount_in_cents","transaction.reference","transaction.currency"];
  const timestamp=Math.floor(Date.now()/1000);
  const concatenated=transaction.id+status+transaction.amount_in_cents+transaction.reference+"COP";
  const checksum=createHash("sha256").update(concatenated+timestamp+process.env.WOMPI_EVENTS_KEY).digest("hex");
  return request("/webhooks/wompi","POST",{event:"transaction.updated",environment:"test",timestamp,data:{transaction},signature:{properties,checksum:alter?"0".repeat(64):checksum}});
}
before(async()=>{
  const response=await request("/auth/login","POST",{email:"test@admin.com",password:"password"});
  assert.equal(response.status,200);
  const header=response.headers.get("set-cookie")!;
  assert.match(header,/HttpOnly/i);assert.match(header,/SameSite=Lax/i);
  cookie=header.split(";")[0];
});
after(async()=>{
  await db.order.deleteMany({where:{id:{in:orders}}});
  await db.product.deleteMany({where:{id:{in:products}}});
  await db.$disconnect();
});
test("Validación estricta, consentimiento y autorización",async()=>{
  const p=await product(4);
  let res=await request("/orders","POST",{...input(p.id),dataConsent:false},{"Idempotency-Key":randomUUID()});assert.equal(res.status,422);
  res=await request("/orders","POST",{...input(p.id),totalCents:100},{"Idempotency-Key":randomUUID()});assert.equal(res.status,422);
  res=await request("/orders","POST",{...input(p.id),customer:{...customer,name:"Cliente 123 Prueba",phone:"300abc1234567",city:"Mocoa123"},items:[{productId:p.id,quantity:1},{productId:p.id,quantity:1}]},{"Idempotency-Key":randomUUID()});assert.equal(res.status,422);
  const invalidFields=(await res.json()).issues.map((issue:{path:string[]})=>issue.path.join("."));
  for(const path of ["items","customer.name","customer.phone","customer.city"]) assert.ok(invalidFields.includes(path),path);
  res=await request("/orders","POST",{...input(p.id),customer:{...customer,city:"Bogotá"}},{"Idempotency-Key":randomUUID()});assert.equal(res.status,422);
  res=await request("/admin/products","POST",{name:"<script>mal</script>",priceCents:100,stock:1});assert.equal(res.status,422);
  res=await request("/admin/products","POST",{name:"Producto válido",priceCents:100,stock:1},{Origin:"https://evil.example"});assert.equal(res.status,403);
  res=await fetch(api+"/api/admin/products");assert.equal(res.status,401);
  res=await request("/admin/products","POST",{priceCents:100,stock:1});assert.equal(res.status,422);
  assert.equal((await res.json()).error,"Este campo es obligatorio.");
  for(const invalid of [{priceCents:"100",stock:1},{priceCents:100,stock:"7"},{priceCents:100,stock:1.5}]) {
    res=await request("/admin/products","POST",{name:"Producto numérico inválido",...invalid});assert.equal(res.status,422);
  }
  res=await request("/auth/login","POST",{email:"correo-invalido",password:"password"});assert.equal(res.status,422);
  assert.equal((await res.json()).error,"Ingresa un correo electrónico válido.");
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,4);
});
test("Concurrencia: una sola venta con stock uno",async()=>{
  const p=await product(1);
  const results=await Promise.all([checkout(p.id),checkout(p.id)]);
  assert.deepEqual(results.map(r=>r.response.status).sort(),[201,409]);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,0);
});
test("Checkout idempotente y pedido protegido por token",async()=>{
  const p=await product(5);const key=randomUUID();
  const first=await checkout(p.id,key);const retry=await checkout(p.id,key);
  assert.equal(first.response.status,201);assert.equal(retry.data.orderId,first.data.orderId);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,4);
  assert.equal((await request("/orders/"+first.data.orderId)).status,404);
  assert.equal((await request("/orders/"+first.data.orderId+"?token=forged")).status,404);
  assert.equal((await request("/orders/"+first.data.orderId+"?token="+first.data.orderToken)).status,200);
  const record=await db.order.findUniqueOrThrow({where:{id:first.data.orderId}});
  assert.equal(record.dataConsent,true);assert.ok(record.consentAt);assert.equal(record.policyVersion,"2026-10-08");
});
test("Wompi: PENDING → APPROVED, replay y logística monotónica",async()=>{
  const p=await product(3);const {data,response}=await checkout(p.id);assert.equal(response.status,201);
  const tx=randomUUID();
  assert.equal((await event(data,"PENDING",tx)).status,200);
  assert.equal((await event(data,"APPROVED",tx,true)).status,403);
  assert.equal((await db.order.findUniqueOrThrow({where:{id:data.orderId}})).status,"PENDING");
  assert.equal((await event(data,"APPROVED",tx)).status,200);
  assert.equal((await event(data,"APPROVED",tx)).status,200);
  assert.equal((await db.order.findUniqueOrThrow({where:{id:data.orderId}})).status,"PAID");
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,2);
  assert.equal((await request("/admin/orders","PATCH",{id:data.orderId,status:"PAID"})).status,422);
  assert.equal((await request("/admin/orders","PATCH",{id:data.orderId,status:"SHIPPED"})).status,409);
  assert.equal((await request("/admin/orders","PATCH",{id:data.orderId,status:"PACKED"})).status,200);
  assert.equal((await request("/admin/orders","PATCH",{id:data.orderId,status:"SHIPPED"})).status,200);
  assert.equal((await request("/admin/orders","PATCH",{id:data.orderId,status:"PACKED"})).status,409);
  assert.equal((await db.order.findUniqueOrThrow({where:{id:data.orderId}})).status,"SHIPPED");
  const payment=await db.payment.findFirstOrThrow({where:{orderId:data.orderId}});
  assert.deepEqual(Object.keys(payment.wompiData as object).sort(),["amount_in_cents","currency","id","status"]);
});
test("Rechazo libera stock una vez; monto alterado no aprueba",async()=>{
  const p=await product(2);const {data}=await checkout(p.id);const tx=randomUUID();
  assert.equal((await request("/admin/products/"+p.id,"DELETE")).status,409);
  assert.equal((await event({...data,totalCents:data.totalCents+100},"APPROVED",tx)).status,409);
  assert.equal((await event(data,"DECLINED",tx)).status,200);
  assert.equal((await event(data,"DECLINED",tx)).status,200);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,2);
  assert.equal((await db.order.findUniqueOrThrow({where:{id:data.orderId}})).stockReleased,true);
});
test("CRUD persiste precio, stock e imagen removida; logout revoca JWT",async()=>{
  const p=await product(6);
  const invalidImage=new FormData();invalidImage.set("file",new Blob(["contenido falso"],{type:"image/webp"}),"falsa.webp");
  assert.equal((await fetch(api+"/api/admin/products/image",{method:"POST",headers:{Origin:origin,Cookie:cookie},body:invalidImage})).status,422);
  const image=new FormData();image.set("file",new Blob([await readFile("public/images/products/panales-ai.webp")],{type:"image/webp"}),"panales.webp");
  const uploaded=await fetch(api+"/api/admin/products/image",{method:"POST",headers:{Origin:origin,Cookie:cookie},body:image});
  assert.equal(uploaded.status,201);const {url}=await uploaded.json();
  assert.match(url,/^\/api\/media\/[a-f0-9-]+\.webp$/);
  assert.match((await fetch(api+url)).headers.get("content-type")??"",/image\/webp/);
  assert.equal((await request("/admin/products/"+p.id,"PATCH",{imageUrl:url})).status,200);
  assert.equal(await db.productImage.count({where:{productId:p.id}}),1);
  assert.equal((await request("/admin/products/"+p.id,"PATCH",{name:"Producto editado",priceCents:2300000,stock:8,imageUrl:null})).status,200);
  const stored=await db.product.findUniqueOrThrow({where:{id:p.id},include:{images:true}});
  assert.equal(stored.priceCents,2300000);assert.equal(stored.stock,8);assert.equal(stored.images.length,0);
  assert.equal((await request("/admin/products/"+p.id,"DELETE")).status,200);
  assert.equal(await db.product.findUnique({where:{id:p.id}}),null);
  assert.ok(await db.auditLog.findFirst({where:{action:"UPDATE_PRODUCT",entityId:p.id}}));
  assert.equal((await request("/auth/logout","POST")).status,200);
  assert.equal((await request("/auth/me")).status,401);
});
