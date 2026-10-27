import express from "express";
import {createHash,randomUUID} from "node:crypto";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db,serializable} from "./db";
import {HttpError} from "./errors";
import {getProductPricing} from "../../src/shared/promotions";
import {storeSaleSchema,voidStoreSaleSchema,type StoreSaleInput} from "../../src/shared/store-sales";

const include={items:true,recordedBy:{select:{name:true}},voidedBy:{select:{name:true}}} satisfies Prisma.StoreSaleInclude;
function present(sale:Prisma.StoreSaleGetPayload<{include:typeof include}>){const {saleKey:_key,requestHash:_hash,recordedById:_actor,voidedById:_voider,...view}=sale;return view;}

export async function recordStoreSale(input:StoreSaleInput,key:string,adminId:string){
  const items=[...input.items].sort((a,b)=>a.productId.localeCompare(b.productId));
  const requestHash=createHash("sha256").update(JSON.stringify({...input,items})).digest("hex");
  const existing=async(sale:Awaited<ReturnType<typeof db.storeSale.findUnique>>)=>{
    if(!sale)return null;
    if(sale.requestHash!==requestHash)throw new HttpError(409,"Esta clave ya se usó para una venta diferente.");
    return {sale:present(await db.storeSale.findUniqueOrThrow({where:{id:sale.id},include})),replayed:true};
  };
  try{return await serializable(async tx=>{
    const previous=await tx.storeSale.findUnique({where:{saleKey:key},include});
    if(previous){if(previous.requestHash!==requestHash)throw new HttpError(409,"Esta clave ya se usó para una venta diferente.");return {sale:present(previous),replayed:true};}
    const now=new Date(),lines=[];let totalCents=0;
    for(const item of items){
      const product=await tx.product.findUnique({where:{id:item.productId},include:{images:{orderBy:{sort:"asc"},take:1}}});
      if(!product)throw new HttpError(409,"Uno de los productos ya no existe. Revisa la venta.");
      const {effectivePriceCents}=getProductPricing(product,now);
      if(effectivePriceCents!==item.expectedUnitCents)throw new HttpError(409,`El precio de ${product.name} cambió. Revisa y actualiza la venta.`);
      totalCents+=effectivePriceCents*item.quantity;
      if(!Number.isSafeInteger(totalCents)||totalCents>2_000_000_000)throw new HttpError(422,"El total excede el límite permitido.");
      const updated=await tx.product.updateMany({where:{id:product.id,stock:{gte:item.quantity}},data:{stock:{decrement:item.quantity}}});
      if(updated.count!==1)throw new HttpError(409,`Stock insuficiente para ${product.name}. Actualiza los productos.`);
      lines.push({productId:product.id,name:product.name,unitCents:effectivePriceCents,quantity:item.quantity,imageUrl:product.images[0]?.url??null});
    }
    const cashReceivedCents=input.paymentMethod==="CASH"?(input.cashReceivedCents??totalCents):null;
    if(cashReceivedCents!==null&&cashReceivedCents<totalCents)throw new HttpError(422,"El efectivo recibido no alcanza para cubrir el total.");
    const sale=await tx.storeSale.create({data:{reference:`VL-${randomUUID().toUpperCase()}`,saleKey:key,requestHash,
      paymentMethod:input.paymentMethod,totalCents,cashReceivedCents,cashChangeCents:cashReceivedCents===null?null:cashReceivedCents-totalCents,
      paymentReference:input.paymentMethod==="TRANSFER"?(input.paymentReference||null):null,notes:input.notes,recordedById:adminId,items:{create:lines}},include});
    await tx.auditLog.create({data:{adminId,action:"RECORD_STORE_SALE",entity:"StoreSale",entityId:sale.id,detail:{reference:sale.reference,totalCents,paymentMethod:sale.paymentMethod,items:lines.map(({productId,quantity,unitCents})=>({productId,quantity,unitCents}))}}});
    return {sale:present(sale),replayed:false};
  });}catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"){const replay=await existing(await db.storeSale.findUnique({where:{saleKey:key}}));if(replay)return replay;}
    throw error;
  }
}

export async function voidStoreSale(id:string,reason:string,adminId:string){
  return serializable(async tx=>{
    const sale=await tx.storeSale.findUnique({where:{id},include});
    if(!sale)throw new HttpError(404,"Venta no encontrada.");
    if(sale.status==="VOIDED")return {sale:present(sale),replayed:true};
    const claimed=await tx.storeSale.updateMany({where:{id,status:"COMPLETED"},data:{status:"VOIDED",voidedAt:new Date(),voidReason:reason,voidedById:adminId}});
    if(claimed.count!==1)throw new HttpError(409,"La venta cambió mientras se anulaba. Reintenta para consultar su estado.");
    for(const item of [...sale.items].sort((a,b)=>a.productId.localeCompare(b.productId)))await tx.product.update({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
    const updated=await tx.storeSale.findUniqueOrThrow({where:{id},include});
    await tx.auditLog.create({data:{adminId,action:"VOID_STORE_SALE",entity:"StoreSale",entityId:id,detail:{reason,totalCents:sale.totalCents}}});
    return {sale:present(updated),replayed:false};
  });
}

// Este router se monta después de requireAdmin y del limitador administrativo.
export const storeSales=express.Router();
storeSales.post("/quote",async(req,res)=>{
  const input=z.object({items:z.array(z.object({productId:z.string().min(1).max(64),quantity:z.number().int().min(1).max(50)}).strict()).min(1).max(30)}).strict().parse(req.body);
  const now=new Date(),products=await db.product.findMany({where:{id:{in:input.items.map(item=>item.productId)}},include:{images:{orderBy:{sort:"asc"},take:1}}});
  const items=input.items.map(item=>{const product=products.find(p=>p.id===item.productId);if(!product)throw new HttpError(409,"Un producto ya no existe. Retíralo de la venta para continuar.");return {productId:product.id,name:product.name,stock:product.stock,unitCents:getProductPricing(product,now).effectivePriceCents,imageUrl:product.images[0]?.url??null};});
  res.json({items});
});
storeSales.get("/",async(req,res)=>{
  const query=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.enum(["10","25","50","100"]).default("25").transform(Number),
    q:z.string().trim().max(100).default(""),status:z.enum(["COMPLETED","VOIDED"]).optional(),paymentMethod:z.enum(["CASH","TRANSFER"]).optional()}).parse(req.query);
  const where:Prisma.StoreSaleWhereInput={...(query.q?{reference:{contains:query.q,mode:"insensitive"}}:{}),...(query.status?{status:query.status}:{}),...(query.paymentMethod?{paymentMethod:query.paymentMethod}:{})};
  res.json(await db.$transaction(async tx=>{
    const total=await tx.storeSale.count({where}),pages=Math.max(1,Math.ceil(total/query.pageSize)),page=Math.min(query.page,pages);
    const sales=await tx.storeSale.findMany({where,include,orderBy:[{createdAt:"desc"},{id:"desc"}],take:query.pageSize,skip:(page-1)*query.pageSize});
    const totals=await tx.storeSale.groupBy({by:["status","paymentMethod"],where,_sum:{totalCents:true},_count:{_all:true}});
    const summary={salesCents:0,completedSales:0,cashCents:0,transferCents:0,voidedSales:0};
    for(const group of totals){if(group.status==="VOIDED"){summary.voidedSales+=group._count._all;continue;}const cents=group._sum.totalCents??0;summary.salesCents+=cents;summary.completedSales+=group._count._all;summary[group.paymentMethod==="CASH"?"cashCents":"transferCents"]+=cents;}
    return {sales:sales.map(present),total,page,pages,pageSize:query.pageSize,summary};
  },{isolationLevel:"RepeatableRead"}));
});
storeSales.post("/",async(req,res)=>{
  const input=storeSaleSchema.parse(req.body),key=z.string().uuid().parse(req.headers["idempotency-key"]);
  const result=await recordStoreSale(input,key,res.locals.admin.id);res.status(result.replayed?200:201).json(result);
});
storeSales.post("/:id/void",async(req,res)=>{
  const input=voidStoreSaleSchema.parse(req.body);res.json(await voidStoreSale(String(req.params.id),input.reason,res.locals.admin.id));
});
