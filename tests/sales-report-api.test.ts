import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../backend/src/db";
import {dashboardSummary} from "../backend/src/analytics";
import {buildSalesReport} from "../backend/src/reports";
import {reportWindow} from "../src/shared/reports";
import {readSheets,rowCount,rowTexts} from "./helpers/xlsx-reader";
import {readPdf} from "./helpers/pdf-reader";
import {buildSalesReportPdf,buildStoreSaleReceipt,buildOrderSheet} from "../backend/src/report-pdf";
if(process.env.APP_ENV!=="test" || !process.env.DATABASE_URL?.includes("/planetababys_test?"))throw new Error("Solo base aislada planetababys_test");
const api=(process.env.TEST_API_URL??"http://localhost:4400")+"/api",origin=process.env.SITE_URL??"http://localhost:3100",prefix="Reporte "+randomUUID().slice(0,8);
const orders:string[]=[],products:string[]=[],sales:string[]=[],startedAt=new Date();let cookie="",adminId="";
const now=new Date("2030-03-15T21:00:00Z");
const customer={customerName:"Cliente Reporte",customerPhone:"3001234567",customerEmail:"reporte@example.com",shippingAddress:"Calle 12 # 5-34",shippingCity:"Mocoa",dataConsent:true,termsAccepted:true};
async function request(path:string,authenticated=true){return fetch(api+path,{headers:{Origin:origin,...(authenticated?{Cookie:cookie}:{})}});}
// El límite de exportación es estricto; las pruebas esperan Retry-After en lugar de desactivarlo.
async function exportRequest(query:string,format:"xlsx"|"pdf"|boolean="xlsx",authenticated=true){
  if(typeof format==="boolean"){authenticated=format;format="xlsx";}
  const path=`/admin/reports/sales.${format}`+query;
  const response=await request(path,authenticated);
  if(response.status!==429)return response;
  await new Promise(resolve=>setTimeout(resolve,(Number(response.headers.get("retry-after"))||60)*1000+250));
  return request(path,authenticated);
}
before(async()=>{
  const response=await fetch(api+"/auth/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({email:"test@admin.com",password:"password"})});
  assert.equal(response.status,200);cookie=response.headers.get("set-cookie")!.split(";")[0];adminId=(await response.json()).user.id;
});
after(async()=>{
  await db.storeSale.deleteMany({where:{id:{in:sales}}});await db.order.deleteMany({where:{id:{in:orders}}});await db.product.deleteMany({where:{id:{in:products}}});
  await db.auditLog.deleteMany({where:{action:{in:["EXPORT_SALES_REPORT","EXPORT_SALES_REPORT_PDF","EXPORT_ORDER_SHEET"]},createdAt:{gte:startedAt}}});await db.$disconnect();
});
async function product(){const p=await db.product.create({data:{name:prefix+" Producto "+products.length,slug:"report-"+randomUUID(),priceCents:2500000,stock:50}});products.push(p.id);return p;}
async function webSale(p:{id:string;name:string},date:string,patch:Record<string,unknown>={}){
  const paid=new Date(date),reference=prefix+" "+randomUUID();
  const order=await db.order.create({data:{...customer,reference,status:"PAID",totalCents:4500000,shippingCents:500000,createdAt:paid,
    items:{create:{productId:p.id,name:p.name,unitCents:2000000,quantity:2}},payments:{create:{reference,status:"APPROVED",amountInCents:4500000,updatedAt:paid,paymentMethod:"NEQUI",transactionId:"tx-"+randomUUID()}},...patch}});
  orders.push(order.id);return order;
}
async function localSale(p:{id:string;name:string},date:string,status:"COMPLETED"|"VOIDED"="COMPLETED",paymentMethod:"CASH"|"TRANSFER"="CASH"){
  const sale=await db.storeSale.create({data:{reference:"VL-"+prefix+"-"+randomUUID(),saleKey:randomUUID(),requestHash:"x",paymentMethod,totalCents:3000000,
    cashReceivedCents:paymentMethod==="CASH"?3000000:null,cashChangeCents:paymentMethod==="CASH"?0:null,status,createdAt:new Date(date),recordedById:adminId,
    ...(status==="VOIDED"?{voidedAt:new Date(date),voidReason:"Prueba de anulación",voidedById:adminId}:{}),
    items:{create:{productId:p.id,name:p.name,unitCents:1500000,quantity:2}}}});
  sales.push(sale.id);return sale;
}

test("Endpoint protegido, consulta validada y archivo descargable con auditoría",async()=>{
  assert.equal((await exportRequest("",false)).status,401);
  for(const invalid of ["days=8","from=2026-01-01","from=2026-02-30&to=2026-03-01","days=7&from=2026-01-01&to=2026-01-02","contact=si","x=1"])
    assert.equal((await exportRequest("?"+invalid)).status,422,invalid);
  const response=await exportRequest("?from=2026-01-01&to=2026-01-31");
  assert.equal(response.status,200);
  assert.equal(response.headers.get("content-type"),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(response.headers.get("content-disposition"),'attachment; filename="planetababys-ventas-2026-01-01_a_2026-01-31.xlsx"');
  assert.equal(response.headers.get("cache-control"),"no-store");
  const {sheets}=readSheets(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual([...sheets.keys()],["Resumen","Ventas","Detalle productos","Por producto","Por día","Pedidos web","Ventas del local"]);
  const audit=await db.auditLog.findFirst({where:{action:"EXPORT_SALES_REPORT",adminId,createdAt:{gte:startedAt}},orderBy:{createdAt:"desc"}});
  assert.equal((audit?.detail as {includeContact:boolean}).includeContact,false);
});
test("Totales del Excel coinciden con el panel para el mismo período móvil",async()=>{
  const p=await product();
  await webSale(p,"2030-03-09T21:00:00Z");
  const double=await webSale(p,"2030-03-13T04:59:59Z");
  await db.payment.create({data:{orderId:double.id,reference:double.reference,status:"APPROVED",amountInCents:double.totalCents,updatedAt:new Date("2030-03-13T05:01:00Z")}});
  await webSale(p,"2030-03-11T21:00:00Z",{reviewRequired:true});
  await webSale(p,"2030-03-11T21:00:00Z",{status:"CANCELLED"});
  await webSale(p,"2030-03-08T20:59:59Z"); // Período anterior.
  await localSale(p,"2030-03-12T15:00:00Z");
  await localSale(p,"2030-03-12T16:00:00Z","COMPLETED","TRANSFER");
  await localSale(p,"2030-03-12T17:00:00Z","VOIDED");
  const panel=await dashboardSummary(7,now);
  const report=await buildSalesReport(reportWindow({days:"7",contact:"false"},now),{includeContact:false,generatedBy:"test@admin.com",now});
  assert.equal(report.totals.salesCents,panel.metrics.salesCents);
  assert.equal(report.totals.completedSales,panel.metrics.paidOrders);
  assert.equal(report.totals.webSalesCents,panel.channels.web.salesCents);
  assert.equal(report.totals.localSalesCents,panel.channels.local.salesCents);
  assert.equal(report.totals.linesCents,report.totals.salesCents,"El detalle por producto concilia con las ventas");
  assert.equal(report.counts.sales,4);assert.equal(report.counts.storeSales,3,"La hoja del local conserva la venta anulada");
  assert.equal(report.counts.webOrders,panel.metrics.placedOrders);
  const {sheets}=readSheets(report.buffer);
  assert.equal(rowCount(sheets.get("Ventas")!),1+4+1,"Cabecera, cuatro ventas y total");
  assert.ok(sheets.get("Ventas del local")!.includes("Prueba de anulación"));
  assert.ok(!rowTexts(sheets.get("Pedidos web")!,1).includes("Correo"),"Sin datos de contacto por defecto");
  assert.ok(!sheets.get("Pedidos web")!.includes("reporte@example.com"));
  const withContact=await buildSalesReport(reportWindow({days:"7",contact:"true"},now),{includeContact:true,generatedBy:"test@admin.com",now});
  const contactSheet=readSheets(withContact.buffer).sheets.get("Pedidos web")!;
  assert.ok(rowTexts(contactSheet,1).includes("Correo"));assert.ok(contactSheet.includes("reporte@example.com"));
});
test("PDF del reporte: mismos totales, sin datos personales; comprobante y hoja de pedido",async()=>{
  const p=await product();
  const order=await webSale(p,"2030-05-10T15:00:00Z");
  const sale=await localSale(p,"2030-05-10T16:00:00Z");
  const voided=await localSale(p,"2030-05-10T17:00:00Z","VOIDED");
  const window=reportWindow({from:"2030-05-10",to:"2030-05-10",contact:"false"});
  const xlsx=await buildSalesReport(window,{includeContact:true,generatedBy:"test@admin.com",now});
  const pdf=await buildSalesReportPdf(window,{generatedBy:"test@admin.com",now});
  assert.deepEqual(pdf.totals,{...xlsx.totals,webShippingCents:500000,cashCents:3000000,transferCents:0,webCount:1,localCount:1});
  const {content}=readPdf(pdf.buffer);
  assert.ok(content.includes("($ 70.000) Tj"),"Ventas de productos: 40.000 web + 30.000 local");
  assert.ok(content.includes("Prueba de anulaci"),"Lista la venta anulada con su motivo");
  for(const personal of ["Cliente Reporte","reporte@example.com","3001234567","Calle 12"]) assert.ok(!content.includes(personal),personal);
  const receipt=readPdf((await buildStoreSaleReceipt(sale.id)).buffer).content;
  assert.ok(receipt.includes(sale.reference));assert.ok(receipt.includes("($ 30.000) Tj"));assert.ok(!receipt.includes("VENTA ANULADA"));
  assert.ok(readPdf((await buildStoreSaleReceipt(voided.id)).buffer).content.includes("VENTA ANULADA"));
  const sheet=readPdf((await buildOrderSheet(order.id)).buffer).content;
  assert.ok(sheet.includes("Cliente Reporte"));assert.ok(sheet.includes("($ 45.000) Tj"),"Total con envío");
  await assert.rejects(()=>buildStoreSaleReceipt("no-existe"),{status:404});
});
test("Endpoints PDF: autenticación, tipo de contenido y auditoría de la hoja con datos personales",async()=>{
  const p=await product();const order=await webSale(p,"2030-05-11T15:00:00Z");const sale=await localSale(p,"2030-05-11T16:00:00Z");
  assert.equal((await request("/admin/store-sales/"+sale.id+"/receipt.pdf",false)).status,401);
  assert.equal((await request("/admin/orders/"+order.id+"/sheet.pdf",false)).status,401);
  const receipt=await request("/admin/store-sales/"+sale.id+"/receipt.pdf");
  assert.equal(receipt.status,200);assert.equal(receipt.headers.get("content-type"),"application/pdf");
  assert.match(receipt.headers.get("content-disposition")!,/^inline; filename="comprobante-VL-/);
  assert.equal((await request("/admin/store-sales/no-existe/receipt.pdf")).status,404);
  const sheet=await request("/admin/orders/"+order.id+"/sheet.pdf");assert.equal(sheet.status,200);readPdf(Buffer.from(await sheet.arrayBuffer()));
  assert.ok(await db.auditLog.findFirst({where:{action:"EXPORT_ORDER_SHEET",entityId:order.id,adminId}}));
  const report=await exportRequest("?from=2030-05-11&to=2030-05-11","pdf");
  assert.equal(report.status,200);assert.equal(report.headers.get("content-disposition"),'attachment; filename="planetababys-ventas-2030-05-11_a_2030-05-11.pdf"');
  assert.ok(await db.auditLog.findFirst({where:{action:"EXPORT_SALES_REPORT_PDF",adminId,createdAt:{gte:startedAt}}}));
});
test("Rango calendario usa la medianoche de Colombia en ambos extremos",async()=>{
  const p=await product();
  await localSale(p,"2030-04-10T04:59:59Z"); // 9 de abril, 23:59:59 en Bogotá.
  await localSale(p,"2030-04-10T05:00:00Z"); // 10 de abril, 00:00 en Bogotá.
  await localSale(p,"2030-04-11T04:59:59Z"); // 10 de abril, 23:59:59.
  await localSale(p,"2030-04-11T05:00:00Z"); // 11 de abril.
  const report=await buildSalesReport(reportWindow({from:"2030-04-10",to:"2030-04-10",contact:"false"}),{includeContact:false,generatedBy:"test@admin.com",now});
  assert.equal(report.counts.sales,2);assert.equal(report.totals.localSalesCents,6000000);
  assert.equal(rowCount(readSheets(report.buffer).sheets.get("Por día")!),1+1+1);
});
test("Límite de exportaciones por minuto con Retry-After",async()=>{
  const statuses:number[]=[];let retry:string|null=null;
  for(let i=0;i<7;i++){const response=await request("/admin/reports/sales.xlsx?days=7&contact=si");statuses.push(response.status);if(response.status===429)retry=response.headers.get("retry-after");}
  assert.ok(statuses.includes(429),statuses.join(","));assert.ok(Number(retry)>0);
});
