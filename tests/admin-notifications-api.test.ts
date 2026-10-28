import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
if(process.env.APP_ENV!=="test"||!process.env.DATABASE_URL?.includes("/planetababys_test?"))throw new Error("Solo se permiten fixtures en la base de pruebas");
const db=new PrismaClient(),api=process.env.TEST_API_URL??"http://localhost:4403",origin=process.env.SITE_URL??"http://localhost:3101";
const ids:string[]=[];let productId="",cookie="";
async function request(auth=true){return fetch(api+"/api/admin/notifications",{headers:{Origin:origin,...(auth?{Cookie:cookie}:{})}});}
async function quote(status:string,expired=false){
  const q=await db.shippingQuote.create({data:{reference:"ENV-NOTICE-"+randomUUID(),requestKey:randomUUID(),requestHash:randomUUID(),status,
    request:{items:[{productId,quantity:1,expectedUnitCents:10000}],customer:{name:"Cliente Sintético",phone:"3001234567",email:"notices@example.com",address:"Calle de prueba 123",city:"Mocoa"},dataConsent:true,termsAccepted:true},
    lines:[{name:"Prueba de avisos",quantity:1,unitCents:10000}],subtotalCents:10000,policyVersion:"2026-10-08",consentAt:new Date(),expiresAt:new Date(Date.now()+(expired?-60000:3600000))}});
  ids.push(q.id);return q;
}
before(async()=>{
  const login=await fetch(api+"/api/auth/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({email:process.env.SEED_ADMIN_EMAIL,password:process.env.SEED_ADMIN_PASSWORD})});
  assert.equal(login.status,200);cookie=login.headers.get("set-cookie")!.split(";")[0];
  const p=await db.product.create({data:{name:"Prueba de avisos "+randomUUID(),slug:randomUUID(),priceCents:10000,stock:5}});productId=p.id;
});
after(async()=>{await db.shippingQuote.deleteMany({where:{id:{in:ids}}});if(productId)await db.product.delete({where:{id:productId}});await db.$disconnect();});
test("los avisos son privados y no incluyen datos personales ni tokens de clientes",async()=>{
  assert.equal((await request(false)).status,401);
  const visible=await quote("REQUESTED");
  const response=await request();assert.equal(response.status,200);const data=await response.json();
  assert.ok(data.pendingCount>=1);assert.ok(data.viewerId);assert.ok(data.recent.some((item:{id:string})=>item.id===visible.id));
  assert.ok(data.recent.length<=20);
  for(const item of data.recent)assert.deepEqual(Object.keys(item).sort(),["createdAt","id","reference"]);
});
test("solo cuenta solicitudes vigentes pendientes y al gestionarlas deja de avisar",async()=>{
  const active=await quote("REQUESTED"),inactive=await Promise.all([quote("REQUESTED",true),quote("QUOTED"),quote("DECLINED"),quote("CONSUMED")]);
  const data=await (await request()).json();assert.ok(data.recent.some((item:{id:string})=>item.id===active.id));
  assert.ok(inactive.every(q=>!data.recent.some((item:{id:string})=>item.id===q.id)));
  await db.shippingQuote.update({where:{id:active.id},data:{status:"QUOTED"}});
  const updated=await (await request()).json();assert.ok(!updated.recent.some((item:{id:string})=>item.id===active.id));
  const repeat=await (await request()).json();assert.equal(repeat.pendingCount,updated.pendingCount);
});
