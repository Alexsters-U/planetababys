import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawn,type ChildProcess} from "node:child_process";
import {mkdtemp,writeFile,utimes,readdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import {db} from "../backend/src/db";
import {redis} from "../backend/src/security";
import {expireReservations} from "../backend/src/orders";
import {cleanupOrphanUploads,runMaintenance} from "../backend/src/maintenance";
import {proxyHeaders} from "../src/shared/proxy-context";
if(process.env.APP_ENV!=="test" || !process.env.DATABASE_URL?.includes("/planetababys_test?"))throw new Error("Solo base aislada planetababys_test");
const api=(process.env.TEST_API_URL??"http://localhost:4400")+"/api",origin=process.env.SITE_URL??"http://localhost:3100",secret=process.env.PROXY_SHARED_SECRET??"";
const prefix="Blindaje "+randomUUID().slice(0,8),products:string[]=[],orders:string[]=[],admins:string[]=[];
const ip=()=>`10.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}.${1+Math.floor(Math.random()*250)}`;
const login=(email:string,password:string,from=ip())=>fetch(api+"/auth/login",{method:"POST",
  headers:{Origin:origin,"Content-Type":"application/json",...proxyHeaders(secret,"POST","/api/auth/login",from)},body:JSON.stringify({email,password})});
before(async()=>{await redis.connect();});
after(async()=>{
  await db.order.deleteMany({where:{id:{in:orders}}});await db.product.deleteMany({where:{id:{in:products}}});
  await db.auditLog.deleteMany({where:{adminId:{in:admins}}});await db.adminUser.deleteMany({where:{id:{in:admins}}});
  await db.$disconnect();await redis.quit();
});

test("Bloqueo por cuenta ante intentos desde IP distintas, con auditoría sin correo en claro",async()=>{
  const email=`bloqueo-${randomUUID().slice(0,8)}@example.com`,started=new Date();
  for(let i=0;i<10;i++) assert.equal((await login(email,"incorrecta-"+i)).status,401);
  const blocked=await login(email,"otra-clave");
  assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get("retry-after"))>0);
  const failures=await db.auditLog.findMany({where:{action:"LOGIN_FAILED",createdAt:{gte:started}}});
  assert.ok(failures.length>=10);
  assert.ok(failures.every(entry=>!JSON.stringify(entry.detail).includes(email)),"El registro no guarda el correo");
  await db.auditLog.deleteMany({where:{action:"LOGIN_FAILED",createdAt:{gte:started}}});
});
test("Un acceso correcto limpia los fallos y migra el hash a bcrypt 12",async()=>{
  const email=`hash-${randomUUID().slice(0,8)}@example.com`,password="clave-de-prueba-segura";
  const admin=await db.adminUser.create({data:{email,passwordHash:await bcrypt.hash(password,10)}});admins.push(admin.id);
  for(let i=0;i<3;i++) await login(email,"clave-incorrecta");
  const ok=await login(email,password);assert.equal(ok.status,200);
  assert.equal(bcrypt.getRounds((await db.adminUser.findUniqueOrThrow({where:{id:admin.id}})).passwordHash),12);
  for(let i=0;i<9;i++) assert.equal((await login(email,"clave-incorrecta")).status,401,"El contador volvió a cero");
});
test("Conciliación: pedidos que fallan siempre no impiden liberar una reserva posterior",async()=>{
  const product=await db.product.create({data:{name:prefix+" stock",slug:"hard-"+randomUUID(),priceCents:10000,stock:0}});products.push(product.id);
  const now=new Date(),ids:string[]=[];
  for(let i=0;i<30;i++){
    const reference=prefix+" atascado "+randomUUID();
    const order=await db.order.create({data:{reference,status:"PENDING",totalCents:10000,customerName:"Cliente",customerPhone:"3001234567",customerEmail:"c@example.com",
      shippingAddress:"Calle 1",shippingCity:"Mocoa",expiresAt:new Date(now.getTime()-3600000-i),payments:{create:{reference,amountInCents:10000,provider:"wompi",transactionId:"tx-"+randomUUID()}}}});
    orders.push(order.id);ids.push(order.id);
  }
  const reference=prefix+" simulado "+randomUUID();
  const last=await db.order.create({data:{reference,status:"PENDING",totalCents:10000,customerName:"Cliente",customerPhone:"3001234567",customerEmail:"c@example.com",
    shippingAddress:"Calle 1",shippingCity:"Mocoa",expiresAt:new Date(now.getTime()-60000),items:{create:{productId:product.id,name:product.name,unitCents:10000,quantity:2}},
    payments:{create:{reference,amountInCents:10000,provider:"simulator"}}}});
  orders.push(last.id);ids.push(last.id);
  await expireReservations({now,orderIds:ids});
  await expireReservations({now,orderIds:ids});
  const released=await db.order.findUniqueOrThrow({where:{id:last.id}});
  assert.equal(released.status,"CANCELLED");assert.equal(released.stockReleased,true);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,2,"Stock devuelto una sola vez");
  const stuck=await db.order.findMany({where:{id:{in:ids.slice(0,30)}}});
  assert.ok(stuck.every(order=>order.reviewRequired && order.reconcileAttempts>=1 && order.nextReconcileAt!>now));
});
test("La fecha de aprobación es inmutable aunque el pago se actualice después",async()=>{
  const product=await db.product.create({data:{name:prefix+" aprobado",slug:"hard-"+randomUUID(),priceCents:10000,stock:5}});products.push(product.id);
  const {simulatePayment}=await import("../backend/src/payment-simulation");
  const {orderToken}=await import("../backend/src/security");
  const reference=prefix+" pago "+randomUUID();
  const order=await db.order.create({data:{reference,status:"PENDING",totalCents:10000,customerName:"Cliente",customerPhone:"3001234567",customerEmail:"c@example.com",
    shippingAddress:"Calle 1",shippingCity:"Mocoa",expiresAt:new Date(Date.now()+600000),payments:{create:{reference,amountInCents:10000,provider:"simulator"}}}});
  orders.push(order.id);
  await simulatePayment({orderId:order.id,token:await orderToken(order.id),status:"APPROVED"});
  const approved=await db.payment.findFirstOrThrow({where:{orderId:order.id}});
  assert.ok(approved.approvedAt);
  await new Promise(resolve=>setTimeout(resolve,20));
  await db.payment.update({where:{id:approved.id},data:{paymentMethod:"CARD"}});
  const later=await db.payment.findUniqueOrThrow({where:{id:approved.id}});
  assert.ok(later.updatedAt>approved.updatedAt);assert.equal(later.approvedAt!.getTime(),approved.approvedAt!.getTime());
});
test("Limpieza de imágenes: borra solo huérfanas antiguas y conserva referencias de pedidos",async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),"pbb-uploads-")),now=new Date(),old=new Date(now.getTime()-48*3600000);
  const [orphanOld,orphanNew,referenced,snapshot]=[randomUUID(),randomUUID(),randomUUID(),randomUUID()].map(id=>id+".webp");
  for(const name of [orphanOld,orphanNew,referenced,snapshot,"notas.txt"]) await writeFile(path.join(directory,name),"x");
  for(const name of [orphanOld,referenced,snapshot,"notas.txt"]) await utimes(path.join(directory,name),old,old);
  const product=await db.product.create({data:{name:prefix+" foto",slug:"hard-"+randomUUID(),priceCents:10000,stock:1,images:{create:{url:"/api/media/"+referenced}}}});products.push(product.id);
  const reference=prefix+" foto "+randomUUID();
  const order=await db.order.create({data:{reference,status:"DELIVERED",totalCents:10000,customerName:"Cliente",customerPhone:"3001234567",customerEmail:"c@example.com",
    shippingAddress:"Calle 1",shippingCity:"Mocoa",items:{create:{productId:"eliminado",name:"Producto eliminado",unitCents:10000,quantity:1,imageUrl:"/api/media/"+snapshot}}}});
  orders.push(order.id);
  const result=await cleanupOrphanUploads({directory,now,olderThanHours:24});
  assert.deepEqual(result.removed,[orphanOld]);
  assert.deepEqual((await readdir(directory)).sort(),[orphanNew,referenced,snapshot,"notas.txt"].sort());
  await rm(directory,{recursive:true,force:true});
});
test("El bloqueo distribuido impide que dos réplicas concilien a la vez",async()=>{
  const product=await db.product.create({data:{name:prefix+" lock",slug:"hard-"+randomUUID(),priceCents:10000,stock:0}});products.push(product.id);
  const reference=prefix+" lock "+randomUUID(),now=new Date();
  const order=await db.order.create({data:{reference,status:"PENDING",totalCents:10000,customerName:"Cliente",customerPhone:"3001234567",customerEmail:"c@example.com",
    shippingAddress:"Calle 1",shippingCity:"Mocoa",expiresAt:new Date(now.getTime()-60000),items:{create:{productId:product.id,name:product.name,unitCents:10000,quantity:1}},
    payments:{create:{reference,amountInCents:10000,provider:"simulator"}}}});
  orders.push(order.id);
  await redis.set("lock:reconcile","otra-replica",{PX:5000});
  await runMaintenance(now);
  assert.equal((await db.order.findUniqueOrThrow({where:{id:order.id}})).status,"PENDING","Otra réplica tiene el turno");
  await redis.del("lock:reconcile");
});
test("Caché del catálogo: una edición administrativa se ve de inmediato",async()=>{
  const response=await fetch(api+"/auth/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({email:"test@admin.com",password:"password"})});
  const cookie=response.headers.get("set-cookie")!.split(";")[0];
  const created=await fetch(api+"/admin/products",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",Cookie:cookie},
    body:JSON.stringify({name:prefix+" Caché",description:"Producto de caché",priceCents:2500000,stock:3,category:"general",isActive:true,isFeatured:false})});
  assert.equal(created.status,201);const {product}=await created.json();products.push(product.id);
  const first=await (await fetch(api+"/products/"+product.slug)).json();assert.equal(first.product.priceCents,2500000);
  assert.equal((await fetch(api+"/admin/products/"+product.id,{method:"PATCH",headers:{Origin:origin,"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({priceCents:2600000})})).status,200);
  const second=await (await fetch(api+"/products/"+product.slug)).json();assert.equal(second.product.priceCents,2600000);
  assert.equal((await fetch(api+"/products/"+"x".repeat(121))).status,422);
});
test("Con PROXY_IP_REQUIRED la API rechaza límites sin IP firmada y lo informa en /api/health/proxy",async()=>{
  const port=4400+Math.floor(Math.random()*400)+100;
  const child:ChildProcess=spawn(process.execPath,[...process.execArgv.filter(arg=>!arg.startsWith("--test")),path.resolve("backend/src/server.ts")],
    {env:{...process.env,API_PORT:String(port),PROXY_IP_REQUIRED:"true"},stdio:"ignore"});
  try {
    const base=`http://127.0.0.1:${port}/api`;
    for(let i=0;i<60;i++){try{if((await fetch(base+"/health")).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
    assert.equal((await fetch(base+"/products?limit=1")).status,503);
    assert.deepEqual(await (await fetch(base+"/health/proxy")).json(),{clientIpVerified:false});
    const target="/api/products?limit=1";
    assert.equal((await fetch(base.replace("/api","")+target,{headers:proxyHeaders(secret,"GET",target,ip())})).status,200);
    assert.deepEqual(await (await fetch(base+"/health/proxy",{headers:proxyHeaders(secret,"GET","/api/health/proxy",ip())})).json(),{clientIpVerified:true});
  } finally {child.kill();}
});
