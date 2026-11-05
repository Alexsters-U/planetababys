import {Prisma} from "@prisma/client";
import {db} from "./db";
import {config} from "./config";
import {eligible} from "./analytics";
import {HttpError} from "./errors";
import {buildWorkbook,type CellValue,type Column,type Sheet,type SummaryRow} from "./xlsx";
import {colombiaDay} from "../../src/shared/analytics";
import {reportDays,reportFileName,type ReportWindow} from "../../src/shared/reports";
import {STORE_PAYMENT_LABELS} from "../../src/shared/store-sales";
import {categoryLabel,orderStatusLabel,paymentStatusLabel} from "../../src/lib/labels";

// Límite por hoja para mantener la generación en memoria acotada; un rango mayor se divide en varios archivos.
export const REPORT_MAX_ROWS=50_000;
const CHUNK=5_000;
const WEB_METHOD_LABELS:Record<string,string>={CARD:"Tarjeta",NEQUI:"Nequi",PSE:"PSE",BANCOLOMBIA_TRANSFER:"Transferencia Bancolombia",BANCOLOMBIA_QR:"QR Bancolombia",DAVIPLATA:"Daviplata"};
const pesos=(cents:number)=>cents/100;
const webMethod=(method:string|null|undefined)=>method?(WEB_METHOD_LABELS[method]??method):"";
const storeMethod=(method:"CASH"|"TRANSFER")=>STORE_PAYMENT_LABELS[method];

type LedgerRow={id:string;channel:"WEB"|"LOCAL";paid_at:Date;sales_cents:number|bigint};
export type SalesReportCounts={sales:number;lines:number;webOrders:number;storeSales:number;products:number};
export type SalesReport={buffer:Buffer;fileName:string;counts:SalesReportCounts;totals:{salesCents:number;completedSales:number;webSalesCents:number;localSalesCents:number;linesCents:number}};

function chunks<T>(values:T[]) {const result:T[][]=[];for(let i=0;i<values.length;i+=CHUNK)result.push(values.slice(i,i+CHUNK));return result;}
function tooMany(count:number,what:string) {
  if(count>REPORT_MAX_ROWS) throw new HttpError(422,`El período tiene más de ${REPORT_MAX_ROWS.toLocaleString("es-CO")} ${what}. Descarga rangos más cortos.`);
}

type ReportOptions={includeContact:boolean;generatedBy:string;now?:Date};
export type CollectedReport=Awaited<ReturnType<typeof collectSalesReport>>;

/** Lee una instantánea coherente y calcula filas y totales; Excel y PDF parten de este mismo resultado. */
export async function collectSalesReport(window:ReportWindow,options:ReportOptions) {
  const now=options.now??new Date();
  const {start,end}=window;
  const createdInWindow={createdAt:{gte:start,lt:end}};
  const data=await db.$transaction(async tx=>{
    // Una sola instantánea: todas las hojas describen el mismo estado de la base.
    const [webCount,storeCount]=[await tx.order.count({where:createdInWindow}),await tx.storeSale.count({where:createdInWindow})];
    tooMany(webCount,"pedidos web");tooMany(storeCount,"ventas del local");
    const ledger=await tx.$queryRaw<LedgerRow[]>(Prisma.sql`${eligible}
      SELECT id, channel, paid_at, sales_cents FROM eligible WHERE paid_at >= ${start} AND paid_at < ${end} ORDER BY paid_at, id`);
    tooMany(ledger.length,"ventas confirmadas");
    const webIds=ledger.filter(row=>row.channel==="WEB").map(row=>row.id),localIds=ledger.filter(row=>row.channel==="LOCAL").map(row=>row.id);
    // Consultas secuenciales: una transacción interactiva usa una sola conexión.
    const webSales=[],localSales=[];
    for(const ids of chunks(webIds)) webSales.push(...await tx.order.findMany({where:{id:{in:ids}},
      include:{items:true,payments:{where:{status:"APPROVED"},orderBy:[{approvedAt:{sort:"asc",nulls:"last"}},{updatedAt:"asc"},{id:"asc"}],take:1}}}));
    for(const ids of chunks(localIds)) localSales.push(...await tx.storeSale.findMany({where:{id:{in:ids}},
      include:{items:true,recordedBy:{select:{name:true}}}}));
    const webOrders=await tx.order.findMany({where:createdInWindow,orderBy:[{createdAt:"asc"},{id:"asc"}],
      include:{items:{select:{quantity:true,unitCents:true}},payments:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:1}}});
    const storeSales=await tx.storeSale.findMany({where:createdInWindow,orderBy:[{createdAt:"asc"},{id:"asc"}],
      include:{items:{select:{quantity:true}},recordedBy:{select:{name:true}},voidedBy:{select:{name:true}}}});
    const productIds=[...new Set([...webSales.flatMap(order=>order.items.map(item=>item.productId)),...localSales.flatMap(sale=>sale.items.map(item=>item.productId))])];
    const products=[];
    for(const ids of chunks(productIds)) products.push(...await tx.product.findMany({where:{id:{in:ids}},select:{id:true,name:true,category:true,stock:true,isActive:true}}));
    return {ledger,webSales,localSales,webOrders,storeSales,products};
  },{isolationLevel:"RepeatableRead",timeout:30000});

  const webById=new Map(data.webSales.map(order=>[order.id,order])),localById=new Map(data.localSales.map(sale=>[sale.id,sale]));
  const productById=new Map(data.products.map(product=>[product.id,product]));

  // Libro de ventas confirmadas y detalle por línea, en el mismo orden temporal.
  const salesRows:CellValue[][]=[],lineRows:CellValue[][]=[];
  const byProduct=new Map<string,{name:string;webUnits:number;localUnits:number;webCents:number;localCents:number}>();
  const byDay=new Map<string,{webCents:number;localCents:number;webCount:number;localCount:number}>();
  let salesCents=0,webSalesCents=0,localSalesCents=0,webShippingCents=0,cashCents=0,transferCents=0,linesCents=0,webCount=0,localCount=0;
  for(const entry of data.ledger) {
    const paidAt=new Date(entry.paid_at),day=colombiaDay(paidAt),amount=Number(entry.sales_cents);
    const dayTotals=byDay.get(day)??{webCents:0,localCents:0,webCount:0,localCount:0};
    const lines:{productId:string;name:string;quantity:number;unitCents:number}[]=[];
    if(entry.channel==="WEB") {
      const order=webById.get(entry.id);
      if(!order) continue;
      salesCents+=amount;
      const payment=order.payments[0];
      webSalesCents+=amount;webShippingCents+=order.shippingCents;webCount++;dayTotals.webCents+=amount;dayTotals.webCount++;
      lines.push(...order.items);
      salesRows.push([paidAt,day,"Web",order.reference,order.id,orderStatusLabel(order.status),webMethod(payment?.paymentMethod),payment?.transactionId??"",
        payment?.provider==="simulator"?"Sí":"No",order.customerName,order.shippingCity,order.items.reduce((sum,item)=>sum+item.quantity,0),
        pesos(amount),pesos(order.shippingCents),pesos(order.totalCents),""]);
    } else {
      const sale=localById.get(entry.id);
      if(!sale) continue;
      salesCents+=amount;localSalesCents+=amount;localCount++;dayTotals.localCents+=amount;dayTotals.localCount++;
      if(sale.paymentMethod==="CASH") cashCents+=amount; else transferCents+=amount;
      lines.push(...sale.items);
      salesRows.push([paidAt,day,"Local",sale.reference,sale.id,"Completada",storeMethod(sale.paymentMethod),sale.paymentReference??"",
        "No","","Local",sale.items.reduce((sum,item)=>sum+item.quantity,0),pesos(amount),0,pesos(sale.totalCents),sale.recordedBy.name]);
    }
    byDay.set(day,dayTotals);
    const reference=String(salesRows[salesRows.length-1][3]);
    for(const line of lines) {
      const lineCents=line.unitCents*line.quantity;linesCents+=lineCents;
      lineRows.push([paidAt,entry.channel==="WEB"?"Web":"Local",reference,line.productId,line.name,line.quantity,pesos(line.unitCents),pesos(lineCents)]);
      const product=byProduct.get(line.productId)??{name:line.name,webUnits:0,localUnits:0,webCents:0,localCents:0};
      if(entry.channel==="WEB"){product.webUnits+=line.quantity;product.webCents+=lineCents;}else{product.localUnits+=line.quantity;product.localCents+=lineCents;}
      byProduct.set(line.productId,product);
    }
  }
  const completedSales=webCount+localCount;

  const productRows:CellValue[][]=[...byProduct.entries()]
    .map(([id,p])=>({id,...p,units:p.webUnits+p.localUnits,cents:p.webCents+p.localCents}))
    .sort((a,b)=>b.units-a.units || b.cents-a.cents || a.id.localeCompare(b.id))
    .map(p=>{const current=productById.get(p.id);return [p.id,current?.name??p.name,current?categoryLabel(current.category):"Producto eliminado",
      p.webUnits,p.localUnits,p.units,pesos(p.webCents),pesos(p.localCents),pesos(p.cents),current?current.stock:null,current?(current.isActive?"Sí":"No"):""];});
  const dayRows:CellValue[][]=reportDays(window).map(day=>{const totals=byDay.get(day)??{webCents:0,localCents:0,webCount:0,localCount:0};
    return [new Date(day+"T05:00:00Z"),pesos(totals.webCents),pesos(totals.localCents),pesos(totals.webCents+totals.localCents),totals.webCount,totals.localCount,totals.webCount+totals.localCount];});

  const contactColumns:Column[]=options.includeContact?[{header:"Correo",width:28},{header:"Teléfono",width:15},{header:"Dirección de entrega",width:34,type:"wrap"}]:[];
  const statusCounts=new Map<string,number>();let reviewCount=0;
  const orderRows:CellValue[][]=data.webOrders.map(order=>{
    statusCounts.set(order.status,(statusCounts.get(order.status)??0)+1);if(order.reviewRequired)reviewCount++;
    const payment=order.payments[0],subtotal=order.items.reduce((sum,item)=>sum+item.unitCents*item.quantity,0);
    return [order.createdAt,order.reference,order.id,orderStatusLabel(order.status),order.reviewRequired?"Sí":"No",payment?paymentStatusLabel(payment.status):"",
      webMethod(payment?.paymentMethod),payment?.transactionId??"",payment?.provider==="simulator"?"Sí":"No",order.customerName,order.shippingCity,
      ...(options.includeContact?[order.customerEmail,order.customerPhone,order.shippingAddress]:[]),
      order.items.reduce((sum,item)=>sum+item.quantity,0),pesos(subtotal),pesos(order.shippingCents),pesos(order.totalCents),order.stockReleased?"Sí":"No"];
  });
  let voidedCount=0,voidedCents=0;
  const storeRows:CellValue[][]=data.storeSales.map(sale=>{
    if(sale.status==="VOIDED"){voidedCount++;voidedCents+=sale.totalCents;}
    return [sale.createdAt,sale.reference,sale.id,sale.status==="VOIDED"?"Anulada":"Completada",storeMethod(sale.paymentMethod),sale.paymentReference??"",
      sale.items.reduce((sum,item)=>sum+item.quantity,0),pesos(sale.totalCents),sale.cashReceivedCents===null?null:pesos(sale.cashReceivedCents),
      sale.cashChangeCents===null?null:pesos(sale.cashChangeCents),sale.recordedBy.name,sale.notes,sale.voidedAt,sale.voidedBy?.name??"",sale.voidReason??""];
  });

  return {window,now,includeContact:options.includeContact,generatedBy:options.generatedBy,salesRows,lineRows,productRows,dayRows,orderRows,storeRows,contactColumns,
    statusCounts,reviewCount,voidedCount,voidedCents,storeSales:data.storeSales,webOrderCount:data.webOrders.length,
    totals:{salesCents,completedSales,webSalesCents,localSalesCents,webShippingCents,cashCents,transferCents,linesCents,webCount,localCount}};
}

export async function buildSalesReport(window:ReportWindow,options:ReportOptions):Promise<SalesReport> {
  const report=await collectSalesReport(window,options);
  const {now,salesRows,lineRows,productRows,dayRows,orderRows,storeRows,contactColumns,statusCounts,reviewCount,voidedCount,voidedCents,webOrderCount}=report;
  const {salesCents,completedSales,webSalesCents,localSalesCents,webShippingCents,cashCents,transferCents,linesCents,webCount,localCount}=report.totals;
  const {start,end}=window;
  const reconciled=linesCents===salesCents;
  const money=(label:string,cents:number,note?:string):SummaryRow=>({label,value:pesos(cents),type:"money",note});
  const integer=(label:string,value:number,note?:string):SummaryRow=>({label,value,type:"integer",note});
  const summary:SummaryRow[]=[
    {label:"Reporte de ventas · Planeta Baby's",style:"title"},
    {label:"Período",value:window.label},
    {label:"Desde",value:start,type:"datetime",note:"Hora de Colombia (UTC−5)"},
    {label:"Hasta (sin incluir)",value:end,type:"datetime",note:"Hora de Colombia (UTC−5)"},
    {label:"Generado",value:now,type:"datetime"},
    {label:"Generado por",value:options.generatedBy},
    {label:"Ambiente",value:config.PAYMENT_MODE==="test"?"Pruebas · pagos simulados":"Comercial",note:config.PAYMENT_MODE==="test"?"Las cifras provienen de datos de demostración.":undefined},
    {label:"Datos de contacto incluidos",value:options.includeContact?"Sí":"No",note:options.includeContact?"Contiene correo, teléfono y dirección. Guárdalo y compártelo solo según la política de tratamiento de datos (Ley 1581).":"Contiene nombre y ciudad del cliente."},
    {label:""},
    {label:"Ventas confirmadas (criterio del panel)",style:"section"},
    money("Ventas de productos, web y local",salesCents,"Sin envío. Coincide con «Ventas confirmadas» del panel para el mismo período."),
    integer("Ventas completadas",completedSales),
    money("Ticket promedio",completedSales?Math.round(salesCents/completedSales):0),
    money("Ventas web (productos)",webSalesCents),
    integer("Ventas web completadas",webCount),
    money("Envíos cobrados en ventas web",webShippingCents),
    money("Total cobrado en web (productos + envío)",webSalesCents+webShippingCents),
    money("Ventas del local",localSalesCents),
    integer("Ventas del local completadas",localCount),
    money("Local · efectivo",cashCents),
    money("Local · transferencia",transferCents),
    {label:""},
    {label:"Actividad registrada en el período (por fecha de creación)",style:"section"},
    integer("Pedidos web recibidos, todos los estados",webOrderCount,"Detalle en la hoja «Pedidos web»."),
    ...[...statusCounts.entries()].sort().map(([status,count])=>integer(`  ${orderStatusLabel(status)}`,count)),
    integer("Pedidos web que requieren revisión",reviewCount,"No se cuentan como venta hasta resolver la revisión."),
    integer("Ventas del local anuladas",voidedCount),
    money("Monto de ventas del local anuladas",voidedCents),
    {label:""},
    {label:"Controles",style:"section"},
    {label:"Detalle de productos = ventas de productos",value:reconciled?"Correcto":"Revisar",note:`Suma de líneas: ${pesos(linesCents).toLocaleString("es-CO")} COP.`},
    {label:""},
    {label:"Criterios",style:"section"},
    {label:"Venta web",note:"Cuenta en la fecha de su primera aprobación de pago, si el pedido está Recibido, Empacado, Enviado o Entregado y no requiere revisión.",style:"muted"},
    {label:"Venta del local",note:"Cuenta en la fecha de registro mientras no esté anulada. Una anulación posterior la retira del reporte.",style:"muted"},
    {label:"Montos",note:"Pesos colombianos (COP) con el precio guardado al vender, incluidas las promociones.",style:"muted"},
    {label:"Alcance",note:"Herramienta de trazabilidad operativa. No es un informe contable ni reemplaza la factura electrónica.",style:"muted"},
  ];

  const sheets:Sheet[]=[
    {kind:"summary",name:"Resumen",rows:summary},
    {kind:"table",name:"Ventas",rows:salesRows,columns:[
      {header:"Fecha confirmación",width:18,type:"datetime"},{header:"Día (Colombia)",width:13},{header:"Canal",width:8},{header:"Referencia",width:44},
      {header:"ID interno",width:28},{header:"Estado actual",width:14},{header:"Medio de pago",width:16},{header:"Transacción / ref. de pago",width:30},
      {header:"Simulado",width:10},{header:"Cliente",width:24},{header:"Ciudad",width:14},{header:"Unidades",width:10,type:"integer",total:true},
      {header:"Venta productos (COP)",width:18,type:"money",total:true},{header:"Envío (COP)",width:14,type:"money",total:true},
      {header:"Total cobrado (COP)",width:18,type:"money",total:true},{header:"Registrado por",width:22}]},
    {kind:"table",name:"Detalle productos",rows:lineRows,columns:[
      {header:"Fecha confirmación",width:18,type:"datetime"},{header:"Canal",width:8},{header:"Referencia venta",width:44},{header:"ID producto",width:28},
      {header:"Producto (nombre al vender)",width:36},{header:"Cantidad",width:10,type:"integer",total:true},{header:"Precio unitario (COP)",width:18,type:"money"},
      {header:"Subtotal (COP)",width:16,type:"money",total:true}]},
    {kind:"table",name:"Por producto",rows:productRows,columns:[
      {header:"ID producto",width:28},{header:"Producto",width:36},{header:"Categoría actual",width:18},{header:"Unidades web",width:12,type:"integer",total:true},
      {header:"Unidades local",width:13,type:"integer",total:true},{header:"Unidades total",width:13,type:"integer",total:true},{header:"Ventas web (COP)",width:16,type:"money",total:true},
      {header:"Ventas local (COP)",width:16,type:"money",total:true},{header:"Ventas total (COP)",width:17,type:"money",total:true},{header:"Stock actual",width:11,type:"integer"},{header:"Visible",width:9}]},
    {kind:"table",name:"Por día",rows:dayRows,columns:[
      {header:"Día (Colombia)",width:14,type:"date"},{header:"Ventas web (COP)",width:16,type:"money",total:true},{header:"Ventas local (COP)",width:17,type:"money",total:true},
      {header:"Total (COP)",width:16,type:"money",total:true},{header:"Ventas web",width:11,type:"integer",total:true},{header:"Ventas local",width:12,type:"integer",total:true},
      {header:"Ventas total",width:12,type:"integer",total:true}]},
    {kind:"table",name:"Pedidos web",rows:orderRows,columns:[
      {header:"Creado",width:18,type:"datetime"},{header:"Referencia",width:44},{header:"ID interno",width:28},{header:"Estado",width:16},{header:"Requiere revisión",width:10},
      {header:"Estado del pago",width:14},{header:"Medio de pago",width:16},{header:"Transacción",width:30},{header:"Simulado",width:10},{header:"Cliente",width:24},{header:"Ciudad",width:14},
      ...contactColumns,{header:"Unidades",width:10,type:"integer",total:true},{header:"Subtotal productos (COP)",width:18,type:"money",total:true},
      {header:"Envío (COP)",width:14,type:"money",total:true},{header:"Total (COP)",width:16,type:"money",total:true},{header:"Stock liberado",width:10}]},
    {kind:"table",name:"Ventas del local",rows:storeRows,columns:[
      {header:"Fecha registro",width:18,type:"datetime"},{header:"Referencia",width:44},{header:"ID interno",width:28},{header:"Estado",width:12},{header:"Medio de pago",width:14},
      {header:"Ref. transferencia",width:22},{header:"Unidades",width:10,type:"integer",total:true},{header:"Total (COP)",width:16,type:"money",total:true},
      {header:"Efectivo recibido (COP)",width:18,type:"money"},{header:"Cambio (COP)",width:14,type:"money"},{header:"Registrado por",width:22},{header:"Notas",width:30,type:"wrap"},
      {header:"Anulada el",width:18,type:"datetime"},{header:"Anulada por",width:22},{header:"Motivo de anulación",width:34,type:"wrap"}]},
  ];
  const buffer=buildWorkbook(sheets,{title:`Reporte de ventas ${window.fromDay} a ${window.toDay}`,creator:"Planeta Baby's",created:now});
  return {buffer,fileName:reportFileName(window),
    counts:{sales:salesRows.length,lines:lineRows.length,webOrders:orderRows.length,storeSales:storeRows.length,products:productRows.length},
    totals:{salesCents,completedSales,webSalesCents,localSalesCents,linesCents}};
}
