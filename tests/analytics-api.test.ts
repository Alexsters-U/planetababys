import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {db} from "../backend/src/db";
import {dashboardSummary} from "../backend/src/analytics";
import type {DashboardSummary} from "../src/shared/analytics";
if(process.env.APP_ENV!=="test" || !process.env.DATABASE_URL?.includes("/planetababys_test?"))throw new Error("Solo base aislada planetababys_test");
const api=(process.env.TEST_API_URL??"http://localhost:4400")+"/api",origin=process.env.SITE_URL??"http://localhost:3100",prefix="Métricas "+randomUUID().slice(0,8);
const orders:string[]=[],products:string[]=[],quotes:string[]=[];let cookie="";
const now=new Date("2030-03-15T21:00:00Z");
const customer={customerName:"Cliente Prueba",customerPhone:"3001234567",customerEmail:"metrics@example.com",shippingAddress:"Calle 12 # 5-34",shippingCity:"Mocoa",dataConsent:true,termsAccepted:true};
async function request(path:string,method="GET",body?:unknown,authenticated=true){return fetch(api+path,{method,headers:{Origin:origin,"Content-Type":"application/json",...(authenticated?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
before(async()=>{const response=await request("/auth/login","POST",{email:"test@admin.com",password:"password"},false);assert.equal(response.status,200);cookie=response.headers.get("set-cookie")!.split(";")[0];});
after(async()=>{await db.order.deleteMany({where:{id:{in:orders}}});await db.shippingQuote.deleteMany({where:{id:{in:quotes}}});await db.product.deleteMany({where:{id:{in:products}}});await db.$disconnect();});
async function product(stock=10,isActive=true){const p=await db.product.create({data:{name:prefix+" Producto "+products.length,slug:"metric-"+randomUUID(),priceCents:2500050,stock,isActive}});products.push(p.id);return p;}
async function fixture(p:{id:string;name:string},date:string,patch:Record<string,unknown>={}){
  const paid=new Date(date),reference=prefix+" "+randomUUID();
  const record=await db.order.create({data:{...customer,reference,status:"PAID",totalCents:4500100,shippingCents:500000,createdAt:paid,items:{create:{productId:p.id,name:p.name,unitCents:2000050,quantity:2}},payments:{create:{reference,status:"APPROVED",amountInCents:4500100,updatedAt:paid}},...patch}});orders.push(record.id);return record;
}
test("Endpoint protegido, períodos limitados y respuesta sin datos personales",async()=>{
  assert.equal((await request("/admin/summary","GET",undefined,false)).status,401);
  for(const invalid of ["0","8","365","30&days=7","texto"]){assert.equal((await request("/admin/summary?days="+invalid)).status,422);}
  for(const days of [7,30,90]){const response=await request("/admin/summary?days="+days);assert.equal(response.status,200);const data:DashboardSummary=await response.json();assert.equal(data.period.days,days);assert.equal(data.dailySales.reduce((sum,row)=>sum+row.salesCents,0),data.metrics.salesCents);assert.ok(data.dailySales.length<=days+1);for(const order of data.recentOrders){assert.equal("customerName" in order,false);assert.equal("customerEmail" in order,false);}}
});
test("Agregados verifican snapshots, envío, pagos duplicados, revisión y límites temporales",async()=>{
  const p=await product();
  await fixture(p,"2030-03-09T21:00:00Z"); // Current window, snapshot discount.
  const double=await fixture(p,"2030-03-13T04:59:59Z");
  await db.payment.create({data:{orderId:double.id,reference:double.reference,status:"APPROVED",amountInCents:double.totalCents,updatedAt:new Date("2030-03-13T05:01:00Z")}});
  await fixture(p,"2030-03-08T21:00:00Z"); // Inclusive start.
  await fixture(p,"2030-03-08T20:59:59Z"); // Previous period.
  await fixture(p,"2030-03-15T21:00:00Z"); // Exclusive end.
  await fixture(p,"2030-03-11T21:00:00Z",{reviewRequired:true});
  await fixture(p,"2030-03-11T21:00:00Z",{status:"CANCELLED"});
  await fixture(p,"2030-03-11T21:00:00Z",{status:"PENDING"});
  await fixture(p,"2030-03-11T21:00:00Z",{payments:{create:{reference:prefix+" declined",status:"DECLINED",amountInCents:4500100,updatedAt:new Date("2030-03-11T21:00:00Z")}}});
  const summary=await dashboardSummary(7,now);
  assert.equal(summary.metrics.salesCents,12000300);assert.equal(summary.metrics.paidOrders,3);assert.equal(summary.metrics.averageTicketCents,4000100);
  assert.equal(summary.metrics.previousSalesCents,4000100);assert.equal(summary.metrics.previousPaidOrders,1);
  assert.equal(summary.metrics.placedOrders,7);assert.equal(summary.metrics.confirmationRate,42.9);
  assert.equal(summary.topProducts[0].quantity,6);assert.equal(summary.topProducts[0].salesCents,12000300);
  assert.equal(summary.dailySales.find(r=>r.date==="2030-03-12")!.salesCents,4000100);assert.equal(summary.dailySales.find(r=>r.date==="2030-03-13")!.salesCents,0);
  await db.product.delete({where:{id:p.id}}); // Order snapshots must survive removal.
  assert.equal((await dashboardSummary(7,now)).topProducts[0].name,p.name);
  // Keep subsequent endpoint tests free from future-dated fixtures.
  await db.order.deleteMany({where:{id:{in:orders}}});
});
test("Filtros operativos coinciden con conteos globales y excluyen productos ocultos",async()=>{
  await product(3);await product(0);await product(2,false);await product(0,false);
  const summary:DashboardSummary=await (await request("/admin/summary")).json();
  for(const [query,count] of [["stock=low&visibility=visible",summary.inventory.lowStock],["stock=empty&visibility=visible",summary.inventory.outOfStock],["promotion=active&visibility=visible",summary.inventory.activePromotions]] as const){const data=await (await request("/admin/products?"+query)).json();assert.equal(data.total,count);}
  const reviewed=await (await request("/admin/orders?review=required")).json();assert.equal(reviewed.total,summary.operations.reviewRequired);assert.ok(reviewed.orders.every((o:any)=>o.reviewRequired));
  const cleared=await (await request("/admin/orders?review=clear")).json();assert.ok(cleared.orders.every((o:any)=>!o.reviewRequired));
});
test("Una venta confirmada por webhook aumenta ventas una sola vez, no el pedido pendiente",async()=>{
  const p=await product();const before:DashboardSummary=await (await request("/admin/summary?days=7")).json();
  const input={items:[{productId:p.id,quantity:1,expectedUnitCents:p.priceCents}],customer:{name:"Cliente Prueba",phone:"3001234567",email:"metrics@example.com",address:"Calle 12 # 5-34",city:"Mocoa"},dataConsent:true,termsAccepted:true};
  const quoteResponse=await fetch(api+"/shipping/quotes",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","Idempotency-Key":randomUUID()},body:JSON.stringify(input)});assert.equal(quoteResponse.status,201);const quote=await quoteResponse.json();quotes.push(quote.id);
  assert.equal((await request("/admin/shipping-quotes/"+quote.id,"PATCH",{shippingCents:0,deliveryEstimate:"Entrega de prueba"})).status,200);
  const response=await fetch(api+"/orders",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","Idempotency-Key":randomUUID()},body:JSON.stringify({...input,shippingQuoteToken:quote.token,shippingQuoteAccepted:true})});assert.equal(response.status,201);
  const order=await response.json();orders.push(order.orderId);
  let summary:DashboardSummary=await (await request("/admin/summary?days=7")).json();assert.equal(summary.metrics.salesCents,before.metrics.salesCents);
  const transaction={id:randomUUID(),reference:order.reference,status:"APPROVED",amount_in_cents:order.totalCents,currency:"COP",payment_method_type:"NEQUI"},timestamp=Math.floor(Date.now()/1000);
  const properties=["transaction.id","transaction.status","transaction.amount_in_cents","transaction.reference","transaction.currency"];
  const checksum=createHash("sha256").update(transaction.id+transaction.status+transaction.amount_in_cents+transaction.reference+"COP"+timestamp+process.env.WOMPI_EVENTS_KEY).digest("hex");
  const event={event:"transaction.updated",environment:"test",timestamp,data:{transaction},signature:{checksum,properties}};
  for(let attempt=0;attempt<2;attempt++)assert.equal((await request("/webhooks/wompi","POST",event,false)).status,200);
  summary=await (await request("/admin/summary?days=7")).json();assert.equal(summary.metrics.salesCents-before.metrics.salesCents,p.priceCents);assert.equal(summary.metrics.paidOrders-before.metrics.paidOrders,1);
});
