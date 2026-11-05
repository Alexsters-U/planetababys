import {config} from "./config";
import {db} from "./db";
import {HttpError} from "./errors";
import {BRAND,PdfDocument,wrap,type RasterImage} from "./pdf";
import {brandLogo} from "./brand-logo";
import {collectSalesReport,type CollectedReport} from "./reports";
import {formatCOP} from "../../src/lib/money";
import {orderStatusLabel,paymentStatusLabel} from "../../src/lib/labels";
import {STORE_PAYMENT_LABELS} from "../../src/shared/store-sales";
import type {ReportWindow} from "../../src/shared/reports";

// Límite de filas del libro de ventas en PDF; el Excel conserva el detalle completo.
export const PDF_LEDGER_ROWS=2000;
const WEB_METHOD:Record<string,string>={CARD:"Tarjeta",NEQUI:"Nequi",PSE:"PSE",BANCOLOMBIA_TRANSFER:"Transf. Bancolombia",BANCOLOMBIA_QR:"QR Bancolombia",DAVIPLATA:"Daviplata"};
const pesosToCents=(value:unknown)=>Math.round(Number(value??0)*100);
const money=(cents:number)=>formatCOP(cents);
export function bogota(date:Date|null|undefined,withTime=true) {
  if(!date) return "";
  const iso=new Date(date.getTime()-5*3600000).toISOString();
  return withTime?`${iso.slice(0,10)} ${iso.slice(11,16)}`:iso.slice(0,10);
}
const storeFooter=()=>`${config.STORE_LEGAL_NAME||"Planeta Baby's"}${config.STORE_TAX_ID?" · NIT "+config.STORE_TAX_ID:""} · Documento interno, no es factura electrónica`;

function banner(pdf:PdfDocument,title:string,subtitle:string,test:boolean,logo:RasterImage|null) {
  const height=104,top=pdf.height;
  pdf.rect(0,top-height,pdf.width,height,BRAND.lilac);
  // Con logo, el texto se desplaza a la derecha; sin archivo de logo el documento conserva el diseño anterior.
  const size=86,x=logo?pdf.margin+size+12:pdf.margin;
  // Sin fondo propio: la máscara alfa del PNG deja ver el lila de la cabecera.
  if(logo) pdf.image("Logo",logo,pdf.margin,top-height+9,size,size);
  const textWidth=pdf.width-pdf.margin-x-(test?126:0);
  pdf.text(x,top-36,"PLANETA BABY'S",{size:9,bold:true,color:BRAND.primary,width:textWidth});
  pdf.text(x,top-60,title,{size:20,bold:true,color:BRAND.dark,width:pdf.width-pdf.margin-x});
  pdf.text(x,top-78,subtitle,{size:9,color:BRAND.muted,width:pdf.width-pdf.margin-x});
  pdf.text(x,top-91,"Todo para su mundo, todo para su bienestar",{size:7.5,color:BRAND.primary,width:pdf.width-pdf.margin-x});
  if(test) {
    const w=118,bx=pdf.width-pdf.margin-w;
    pdf.rect(bx,top-48,w,18,[0xF5,0xDB,0x9A]);
    pdf.text(bx,top-42,"PRUEBAS · PAGOS SIMULADOS",{size:7,bold:true,color:BRAND.ink,width:w,align:"center"});
  }
  pdf.y=top-height-18;
}
function keyValues(pdf:PdfDocument,rows:[string,string][],columns=2) {
  const width=pdf.contentWidth/columns,lineHeight=15;
  for(let i=0;i<rows.length;i+=columns) {
    pdf.ensure(lineHeight);
    rows.slice(i,i+columns).forEach(([label,value],c)=>{
      const x=pdf.margin+c*width;
      pdf.text(x,pdf.y-10,label,{size:8,color:BRAND.muted,width:width*0.45});
      pdf.text(x+width*0.45,pdf.y-10,value,{size:9,bold:true,width:width*0.53});
    });
    pdf.y-=lineHeight;
  }
}
function metricCards(pdf:PdfDocument,cards:{label:string;value:string;note?:string}[]) {
  const gap=8,perRow=4,w=(pdf.contentWidth-gap*(perRow-1))/perRow,h=50;
  for(let i=0;i<cards.length;i+=perRow) {
    pdf.ensure(h+gap);
    cards.slice(i,i+perRow).forEach((card,c)=>{
      const x=pdf.margin+c*(w+gap);
      pdf.rect(x,pdf.y-h,w,h,[0xFF,0xFF,0xFF],BRAND.line);
      pdf.text(x+8,pdf.y-14,card.label,{size:7.5,color:BRAND.muted,width:w-16});
      pdf.text(x+8,pdf.y-31,card.value,{size:12,bold:true,color:BRAND.dark,width:w-16});
      if(card.note) pdf.text(x+8,pdf.y-43,card.note,{size:6.5,color:BRAND.muted,width:w-16});
    });
    pdf.y-=h+gap;
  }
}

export function renderSalesReportPdf(report:CollectedReport,logo:RasterImage|null=null):Buffer {
  const {window,totals}=report,test=config.PAYMENT_MODE==="test";
  const pdf=new PdfDocument({title:`Reporte de ventas ${window.fromDay} a ${window.toDay}`,created:report.now,
    footer:`Reporte de ventas · ${window.fromDay} a ${window.toDay} · Generado ${bogota(report.now)} por ${report.generatedBy}`});
  banner(pdf,"Reporte de ventas",`${window.label} · ${bogota(window.start)} a ${bogota(window.end)}, hora de Colombia`,test,logo);
  keyValues(pdf,[["Generado",bogota(report.now)],["Generado por",report.generatedBy],["Ventas confirmadas",String(totals.completedSales)],["Control de líneas",totals.linesCents===totals.salesCents?"Correcto":"Revisar"]]);
  pdf.y-=6;
  metricCards(pdf,[
    {label:"Ventas de productos",value:money(totals.salesCents),note:"Web y local, sin envío"},
    {label:"Ventas completadas",value:String(totals.completedSales)},
    {label:"Ticket promedio",value:money(totals.completedSales?Math.round(totals.salesCents/totals.completedSales):0)},
    {label:"Envíos cobrados (web)",value:money(totals.webShippingCents)},
    {label:"Ventas web",value:money(totals.webSalesCents),note:`${totals.webCount} ventas`},
    {label:"Ventas del local",value:money(totals.localSalesCents),note:`${totals.localCount} ventas`},
    {label:"Local · efectivo",value:money(totals.cashCents)},
    {label:"Local · transferencia",value:money(totals.transferCents)},
  ]);

  pdf.heading("Ventas por día");
  const days=report.dayRows.filter(row=>Number(row[6])>0);
  if(days.length) pdf.table([{header:"Día",width:80},{header:"Web",width:90,align:"right"},{header:"Local",width:90,align:"right"},{header:"Total",width:90,align:"right"},{header:"Ventas",width:50,align:"right"}],
    days.map(row=>[bogota(row[0] as Date,false),money(pesosToCents(row[1])),money(pesosToCents(row[2])),money(pesosToCents(row[3])),String(row[6])]),
    {total:["Total",money(totals.webSalesCents),money(totals.localSalesCents),money(totals.salesCents),String(totals.completedSales)]});
  else pdf.paragraph("Sin ventas confirmadas en el período.",{color:BRAND.muted});

  pdf.heading("Productos vendidos");
  if(report.productRows.length) pdf.table([{header:"Producto",width:200},{header:"Unid. web",width:55,align:"right"},{header:"Unid. local",width:55,align:"right"},{header:"Unidades",width:55,align:"right"},{header:"Ventas",width:85,align:"right"}],
    report.productRows.map(row=>[String(row[1]),String(row[3]),String(row[4]),String(row[5]),money(pesosToCents(row[8]))]),
    {total:["Total",String(report.productRows.reduce((s,r)=>s+Number(r[3]),0)),String(report.productRows.reduce((s,r)=>s+Number(r[4]),0)),String(report.productRows.reduce((s,r)=>s+Number(r[5]),0)),money(totals.linesCents)]});
  else pdf.paragraph("Sin productos vendidos en el período.",{color:BRAND.muted});

  pdf.heading("Libro de ventas confirmadas");
  // El PDF se comparte e imprime: no lleva nombres ni datos de contacto de clientes.
  const ledger=report.salesRows.slice(0,PDF_LEDGER_ROWS);
  if(ledger.length) pdf.table([{header:"Confirmación",width:62},{header:"Canal",width:32},{header:"Referencia",width:128},{header:"Medio",width:58},{header:"Ciudad",width:50},{header:"Unid.",width:30,align:"right"},{header:"Productos",width:62,align:"right"},{header:"Cobrado",width:62,align:"right"}],
    ledger.map(row=>[bogota(row[0] as Date),String(row[2]),String(row[3]),String(row[6]),String(row[10]),String(row[11]),money(pesosToCents(row[12])),money(pesosToCents(row[14]))]),
    {size:7,total:["Total","","","","",String(report.salesRows.reduce((s,r)=>s+Number(r[11]),0)),money(totals.salesCents),money(totals.webSalesCents+totals.webShippingCents+totals.localSalesCents)]});
  else pdf.paragraph("Sin ventas confirmadas en el período.",{color:BRAND.muted});
  if(report.salesRows.length>PDF_LEDGER_ROWS) pdf.paragraph(`Se muestran las primeras ${PDF_LEDGER_ROWS} ventas de ${report.salesRows.length}. Los totales incluyen todas; el detalle completo está en el Excel.`,{color:BRAND.danger,size:8});

  pdf.heading("Actividad del período");
  keyValues(pdf,[["Pedidos web recibidos",String(report.webOrderCount)],["Requieren revisión",String(report.reviewCount)],
    ...[...report.statusCounts.entries()].sort().map(([status,count])=>[orderStatusLabel(status),String(count)] as [string,string]),
    ["Ventas del local anuladas",String(report.voidedCount)],["Monto anulado",money(report.voidedCents)]]);
  const voided=report.storeSales.filter(sale=>sale.status==="VOIDED");
  if(voided.length) {
    pdf.y-=4;
    pdf.table([{header:"Registrada",width:62},{header:"Referencia",width:140},{header:"Total",width:62,align:"right"},{header:"Anulada por",width:80},{header:"Motivo",width:150}],
      voided.map(sale=>[bogota(sale.createdAt),sale.reference,money(sale.totalCents),sale.voidedBy?.name??"",sale.voidReason??""]),{size:7});
  }

  pdf.heading("Criterios");
  for(const text of [
    "Venta web: cuenta en la fecha de su primera aprobación de pago, si el pedido está Recibido, Empacado, Enviado o Entregado y no requiere revisión.",
    "Venta del local: cuenta en la fecha de registro mientras no esté anulada. Una anulación posterior la retira del reporte.",
    "Montos en pesos colombianos con el precio guardado al vender, incluidas las promociones. Las ventas de productos excluyen el envío.",
    "Este PDF no incluye nombres ni datos de contacto de clientes. Herramienta de trazabilidad operativa: no es un informe contable ni reemplaza la factura electrónica.",
  ]) pdf.paragraph("• "+text,{size:8,color:BRAND.muted});
  return pdf.toBuffer();
}

export async function buildSalesReportPdf(window:ReportWindow,options:{generatedBy:string;now?:Date}) {
  const report=await collectSalesReport(window,{includeContact:false,generatedBy:options.generatedBy,now:options.now});
  return {buffer:renderSalesReportPdf(report,await brandLogo()),fileName:`planetababys-ventas-${window.fromDay}_a_${window.toDay}.pdf`,
    counts:{sales:report.salesRows.length,lines:report.lineRows.length,webOrders:report.webOrderCount,storeSales:report.storeRows.length,products:report.productRows.length},totals:report.totals};
}

function itemsTable(pdf:PdfDocument,items:{name:string;quantity:number;unitCents:number}[],totalRows:[string,number][]) {
  pdf.table([{header:"Producto",width:260},{header:"Cant.",width:45,align:"right"},{header:"Precio unitario",width:90,align:"right"},{header:"Subtotal",width:90,align:"right"}],
    items.map(item=>[item.name,String(item.quantity),money(item.unitCents),money(item.unitCents*item.quantity)]),{size:9});
  for(const [label,cents] of totalRows) {
    pdf.ensure(18);
    pdf.text(pdf.margin,pdf.y-12,label,{size:label==="Total"?11:9,bold:label==="Total",width:pdf.contentWidth-110,align:"right"});
    pdf.text(pdf.width-pdf.margin-105,pdf.y-12,money(cents),{size:label==="Total"?11:9,bold:label==="Total",width:105,align:"right",color:label==="Total"?BRAND.dark:BRAND.ink});
    pdf.y-=label==="Total"?20:15;
  }
}
function storeIdentity(pdf:PdfDocument) {
  const parts=[config.STORE_LEGAL_NAME,config.STORE_TAX_ID?`NIT ${config.STORE_TAX_ID}`:"",config.STORE_ADDRESS,config.STORE_CONTACT_PHONE,config.STORE_CONTACT_EMAIL].filter(Boolean);
  for(const line of wrap(parts.join(" · "),pdf.contentWidth,8)) {pdf.text(pdf.margin,pdf.y-8,line,{size:8,color:BRAND.muted});pdf.y-=11;}
  pdf.y-=6;
}
function voidStamp(pdf:PdfDocument,text:string) {
  const lines=wrap(text,pdf.contentWidth-20,9,true),height=12+lines.length*12;
  pdf.ensure(height+8);
  pdf.rect(pdf.margin,pdf.y-height,pdf.contentWidth,height,BRAND.rose,BRAND.danger);
  lines.forEach((line,i)=>pdf.text(pdf.margin+10,pdf.y-17-i*12,line,{size:9,bold:true,color:BRAND.danger}));
  pdf.y-=height+8;
}

/** Comprobante interno de una venta del local, para imprimir o enviar al cliente. */
export async function buildStoreSaleReceipt(id:string,now=new Date()) {
  const sale=await db.storeSale.findUnique({where:{id},include:{items:{orderBy:{name:"asc"}},recordedBy:{select:{name:true}},voidedBy:{select:{name:true}}}});
  if(!sale) throw new HttpError(404,"Venta no encontrada.");
  const pdf=new PdfDocument({title:`Comprobante ${sale.reference}`,created:now,footer:storeFooter()});
  banner(pdf,"Comprobante de venta",`Venta en el local · ${sale.reference}`,config.PAYMENT_MODE==="test",await brandLogo());
  storeIdentity(pdf);
  if(sale.status==="VOIDED") voidStamp(pdf,`VENTA ANULADA el ${bogota(sale.voidedAt)} por ${sale.voidedBy?.name??"administración"}. Motivo: ${sale.voidReason??""}`);
  keyValues(pdf,[["Fecha",bogota(sale.createdAt)],["Medio de pago",STORE_PAYMENT_LABELS[sale.paymentMethod]],
    ["Atendido por",sale.recordedBy.name],[sale.paymentMethod==="TRANSFER"?"Ref. transferencia":"Estado",sale.paymentMethod==="TRANSFER"?(sale.paymentReference||"Sin referencia"):(sale.status==="VOIDED"?"Anulada":"Completada")]]);
  pdf.y-=8;
  const totals:[string,number][]=[["Total",sale.totalCents]];
  if(sale.cashReceivedCents!==null) totals.push(["Efectivo recibido",sale.cashReceivedCents],["Cambio",sale.cashChangeCents??0]);
  itemsTable(pdf,sale.items,totals);
  if(sale.notes) {pdf.y-=4;pdf.paragraph("Notas: "+sale.notes,{size:8,color:BRAND.muted});}
  pdf.y-=8;pdf.paragraph("Gracias por tu compra. Este comprobante es un soporte interno de la venta y no reemplaza la factura electrónica.",{size:8,color:BRAND.muted});
  return {buffer:pdf.toBuffer(),fileName:`comprobante-${sale.reference}.pdf`};
}

/** Hoja de pedido web para preparación y despacho. Incluye datos de entrega: solo administración. */
export async function buildOrderSheet(id:string,now=new Date()) {
  const order=await db.order.findUnique({where:{id},include:{items:{orderBy:{name:"asc"}},payments:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:1},shippingQuote:{select:{deliveryEstimate:true,reference:true}}}});
  if(!order) throw new HttpError(404,"Pedido no encontrado.");
  const payment=order.payments[0];
  const pdf=new PdfDocument({title:`Pedido ${order.reference}`,created:now,footer:storeFooter()+" · Contiene datos personales (Ley 1581)"});
  banner(pdf,"Pedido web",order.reference,payment?.provider==="simulator",await brandLogo());
  storeIdentity(pdf);
  if(order.reviewRequired) voidStamp(pdf,"REQUIERE REVISIÓN: no despachar hasta confirmar el pago y el inventario.");
  else if(!["PAID","PACKED","SHIPPED","DELIVERED"].includes(order.status)) voidStamp(pdf,`Pedido ${orderStatusLabel(order.status).toLowerCase()}: no corresponde a una venta confirmada.`);
  keyValues(pdf,[["Creado",bogota(order.createdAt)],["Estado",orderStatusLabel(order.status)],
    ["Pago",payment?paymentStatusLabel(payment.status):"Sin pago"],["Medio",payment?.paymentMethod?(WEB_METHOD[payment.paymentMethod]??payment.paymentMethod):""],
    ["Aprobado",bogota(payment?.approvedAt??null)],["Transacción",payment?.transactionId??""]]);
  pdf.heading("Entrega");
  keyValues(pdf,[["Cliente",order.customerName],["Teléfono",order.customerPhone],["Ciudad",order.shippingCity],["Correo",order.customerEmail]]);
  pdf.paragraph("Dirección: "+order.shippingAddress,{size:9});
  if(order.shippingNotes) pdf.paragraph("Indicaciones: "+order.shippingNotes,{size:9,color:BRAND.muted});
  if(order.shippingQuote?.deliveryEstimate) pdf.paragraph(`Plazo acordado (${order.shippingQuote.reference}): ${order.shippingQuote.deliveryEstimate}`,{size:9,color:BRAND.muted});
  pdf.heading("Productos");
  itemsTable(pdf,order.items,[["Subtotal",order.totalCents-order.shippingCents],["Envío",order.shippingCents],["Total",order.totalCents]]);
  return {buffer:pdf.toBuffer(),fileName:`pedido-${order.reference}.pdf`};
}
