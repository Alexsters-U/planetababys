import express from "express";
import type {Prisma} from "@prisma/client";
import {z} from "zod";
import multer from "multer";
import sharp from "sharp";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import path from "node:path";
import {config} from "./config";
import {db,serializable} from "./db";
import {requireAdmin,limit} from "./security";
import {HttpError} from "./orders";
import {productCreateSchema,productUpdateSchema,orderStatusUpdateSchema,CATEGORIES} from "../../src/shared/validation";
import {promotionWhere,pricedProduct} from "./promotions";
import {dashboardSummary} from "./analytics";
import {offerSchema,quotePublic,shippingToken} from "./shipping";
import {storeSales} from "./store-sales";
export const admin=express.Router();
const pageSchema=z.coerce.number().int().min(1).max(100000).default(1);
const pageSizeSchema=z.enum(["10","25","50","100"]).default("25").transform(Number);
const productsQuery=z.object({page:pageSchema,pageSize:pageSizeSchema,q:z.string().trim().max(100).default(""),
  category:z.enum(CATEGORIES).optional(),visibility:z.enum(["all","visible","hidden"]).default("all"),
  stock:z.enum(["all","available","empty","low"]).default("all"),promotion:z.enum(["all","active","scheduled","expired","none"]).default("all"),sort:z.enum(["newest","name","priceAsc","priceDesc"]).default("newest")});
const ordersQuery=z.object({page:pageSchema,pageSize:pageSizeSchema,q:z.string().trim().max(100).default(""),
  status:z.enum(["PENDING","PAID","PACKED","SHIPPED","DELIVERED","DECLINED","VOIDED","CANCELLED"]).optional(),review:z.enum(["all","required","clear"]).default("all")});
admin.use(requireAdmin,limit("admin",120,60));
admin.use("/store-sales",storeSales);
admin.get("/shipping-quotes",async(req,res)=>{
  const query=z.object({page:pageSchema,pageSize:pageSizeSchema,q:z.string().trim().max(100).default(""),
    status:z.enum(["REQUESTED","QUOTED","CONSUMED","DECLINED"]).optional()}).parse(req.query);
  // Search by reference; personal details remain inside the protected quotation.
  const where:Prisma.ShippingQuoteWhereInput={...(query.status?{status:query.status}:{}),...(query.q?{reference:{contains:query.q,mode:"insensitive"}}:{})};
  const result=await db.$transaction(async tx=>{
    const total=await tx.shippingQuote.count({where}),pages=Math.max(1,Math.ceil(total/query.pageSize)),page=Math.min(query.page,pages);
    const quotes=await tx.shippingQuote.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],take:query.pageSize,skip:(page-1)*query.pageSize});
    return {quotes:await Promise.all(quotes.map(async quote=>({...quotePublic(quote),
      reviewUrl:`${config.SITE_URL}/cotizacion/${quote.id}?token=${await shippingToken(quote.id)}`}))),total,page,pages};
  },{isolationLevel:"RepeatableRead"});
  res.json(result);
});
admin.patch("/shipping-quotes/:id",async(req,res)=>{
  const id=String(req.params.id),offer=offerSchema.parse(req.body);
  const quote=await serializable(async tx=>{
    const updated=await tx.shippingQuote.updateMany({where:{id,status:"REQUESTED",expiresAt:{gt:new Date()}},
      data:{...offer,status:"QUOTED",expiresAt:new Date(Date.now()+24*60*60*1000)}});
    if(updated.count!==1) throw new HttpError(409,"Solo puedes confirmar solicitudes pendientes y vigentes.");
    await tx.auditLog.create({data:{adminId:res.locals.admin.id,action:"CONFIRM_SHIPPING_QUOTE",entity:"ShippingQuote",entityId:id,detail:offer}});
    return tx.shippingQuote.findUniqueOrThrow({where:{id}});
  });
  res.json({quote:quotePublic(quote)});
});
admin.post("/shipping-quotes/:id/decline",async(req,res)=>{
  const id=String(req.params.id);
  await serializable(async tx=>{
    const updated=await tx.shippingQuote.updateMany({where:{id,status:"REQUESTED"},data:{status:"DECLINED"}});
    if(updated.count!==1) throw new HttpError(409,"La solicitud ya fue gestionada.");
    await tx.auditLog.create({data:{adminId:res.locals.admin.id,action:"DECLINE_SHIPPING_QUOTE",entity:"ShippingQuote",entityId:id}});
  });
  res.json({ok:true});
});
admin.get("/summary",async(req,res)=>{
  const {days}=z.object({days:z.enum(["7","30","90"]).default("30")}).parse(req.query);
  res.json(await dashboardSummary(Number(days) as 7|30|90));
});
admin.get("/products",async(req,res)=>{
  const query=productsQuery.parse(req.query);
  const now=new Date();
  const where:Prisma.ProductWhereInput={
    ...(query.q?{OR:[{name:{contains:query.q,mode:"insensitive"}},{slug:{contains:query.q,mode:"insensitive"}}]}:{}),
    ...(query.category?{category:query.category}:{}),
    ...(query.visibility!=="all"?{isActive:query.visibility==="visible"}:{}),
    ...(query.stock==="available"?{stock:{gt:0}}:query.stock==="empty"?{stock:0}:query.stock==="low"?{stock:{gt:0,lte:5}}:{}),
    AND:[promotionWhere(query.promotion,now)],
  };
  const primary:Prisma.ProductOrderByWithRelationInput=query.sort==="name"?{name:"asc"}:query.sort==="priceAsc"?{priceCents:"asc"}:query.sort==="priceDesc"?{priceCents:"desc"}:{createdAt:"desc"};
  const result=await db.$transaction(async tx=>{
    const total=await tx.product.count({where});
    const pages=Math.max(1,Math.ceil(total/query.pageSize)),page=Math.min(query.page,pages);
    const products=await tx.product.findMany({where,orderBy:[primary,{id:"desc"}],include:{images:{orderBy:{sort:"asc"},take:1}},take:query.pageSize,skip:(page-1)*query.pageSize});
    return {products:products.map(p=>({...pricedProduct(p,now),imageUrl:p.images[0]?.url??null})),total,page,pages,pageSize:query.pageSize};
  },{isolationLevel:"RepeatableRead"});
  res.json(result);
});
admin.post("/products",async(req,res)=>{
  const {imageUrl,...data}=productCreateSchema.parse(req.body);
  const slug=`${data.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${randomUUID().slice(0,8)}`;
  const product=await db.$transaction(async tx=>{
    const p=await tx.product.create({data:{...data,slug,images:imageUrl?{create:{url:imageUrl,alt:data.name}}:undefined},include:{images:true}});
    await tx.auditLog.create({data:{adminId:res.locals.admin.id,action:"CREATE_PRODUCT",entity:"Product",entityId:p.id,detail:{name:p.name,priceCents:p.priceCents,stock:p.stock,promotionEnabled:p.promotionEnabled,promotionPriceCents:p.promotionPriceCents,promotionStartsAt:p.promotionStartsAt?.toISOString()??null,promotionEndsAt:p.promotionEndsAt?.toISOString()??null}}});
    return p;
  });
  res.status(201).json({product:pricedProduct(product,new Date())});
});
admin.patch("/products/:id",async(req,res)=>{
  const id=String(req.params.id); const {imageUrl,...data}=productUpdateSchema.parse(req.body);
  const product=await serializable(async tx=>{
    const previous=await tx.product.findUniqueOrThrow({where:{id}});
    const checked=productCreateSchema.parse({name:previous.name,description:previous.description,priceCents:previous.priceCents,stock:previous.stock,
      category:previous.category,isActive:previous.isActive,isFeatured:previous.isFeatured,promotionEnabled:previous.promotionEnabled,
      promotionPriceCents:previous.promotionPriceCents,promotionStartsAt:previous.promotionStartsAt?.toISOString()??null,
      promotionEndsAt:previous.promotionEndsAt?.toISOString()??null,...data});
    const p=await tx.product.update({where:{id},data:checked});
    if(imageUrl!==undefined) {
      await tx.productImage.deleteMany({where:{productId:id}});
      if(imageUrl) await tx.productImage.create({data:{productId:id,url:imageUrl,alt:p.name}});
    }
    await tx.auditLog.create({data:{adminId:res.locals.admin.id,action:"UPDATE_PRODUCT",entity:"Product",entityId:id,detail:data}});
    return tx.product.findUniqueOrThrow({where:{id},include:{images:true}});
  });
  res.json({product:pricedProduct(product,new Date())});
});
admin.delete("/products/:id",async(req,res)=>{
  const id=String(req.params.id);
  await serializable(async tx=>{
    if(await tx.storeSaleItem.findFirst({where:{productId:id}})) throw new HttpError(409,"El producto tiene ventas del local registradas. Ocúltalo para conservar su historial.");
    if(await tx.orderItem.findFirst({where:{productId:id,order:{status:"PENDING",stockReleased:false}}})) throw new HttpError(409,"Hay una reserva pendiente. Desactiva el producto hasta resolverla.");
    const p=await tx.product.delete({where:{id}});
    await tx.auditLog.create({data:{adminId:res.locals.admin.id,action:"DELETE_PRODUCT",entity:"Product",entityId:id,detail:{name:p.name}}});
  });
  res.json({ok:true});
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter(_req,file,cb){cb(null,["image/jpeg","image/png","image/webp","image/avif"].includes(file.mimetype));}});
admin.post("/products/image",upload.single("file"),async(req,res)=>{
  if(!req.file) throw new HttpError(422,"Selecciona una imagen JPG, PNG, WebP o AVIF");
  let buffer:Buffer;
  try {
    const image=sharp(req.file.buffer,{limitInputPixels:25_000_000,failOn:"error"});
    const metadata=await image.metadata();
    if(!["jpeg","png","webp","avif","heif"].includes(metadata.format??"") || (metadata.pages??1)>1) throw new Error("Formato no permitido");
    buffer=await image.rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
  }catch{throw new HttpError(422,"Contenido de imagen inválido");}
  const name=`${randomUUID()}.webp`;
  await mkdir(config.UPLOAD_DIR,{recursive:true});
  const {writeFile}=await import("node:fs/promises");
  await writeFile(path.join(config.UPLOAD_DIR,name),buffer,{flag:"wx"});
  res.status(201).json({url:`/api/media/${name}`});
});
admin.get("/orders",async(req,res)=>{
  const query=ordersQuery.parse(req.query);
  const where:Prisma.OrderWhereInput={...(query.status?{status:query.status}:{}),...(query.review!=="all"?{reviewRequired:query.review==="required"}:{}),
    ...(query.q?{OR:[{reference:{contains:query.q,mode:"insensitive"}},{customerName:{contains:query.q,mode:"insensitive"}},{customerEmail:{contains:query.q,mode:"insensitive"}}]}:{})};
  const result=await db.$transaction(async tx=>{
    const total=await tx.order.count({where}),pages=Math.max(1,Math.ceil(total/query.pageSize)),page=Math.min(query.page,pages);
    const orders=await tx.order.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],take:query.pageSize,skip:(page-1)*query.pageSize,include:{items:true,payments:{orderBy:{createdAt:"desc"},take:1}}});
    return {orders:orders.map(o=>({...o,payments:o.payments.map(p=>({status:p.status,method:p.paymentMethod,transactionId:p.transactionId}))})),total,page,pages,pageSize:query.pageSize};
  },{isolationLevel:"RepeatableRead"});
  res.json(result);
});
admin.patch("/orders",async(req,res)=>{
  const input=orderStatusUpdateSchema.parse(req.body);
  const allowed:Record<string,string>={PAID:"PACKED",PACKED:"SHIPPED",SHIPPED:"DELIVERED"};
  const order=await serializable(async tx=>{
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.id} FOR UPDATE`;
    const order=await tx.order.findUniqueOrThrow({where:{id:input.id}});
    if(order.reviewRequired || allowed[order.status]!==input.status) throw new HttpError(409,"Transición no permitida o pago pendiente de revisión");
    const updated=await tx.order.update({where:{id:input.id},data:{status:input.status}});
    await tx.auditLog.create({data:{adminId:res.locals.admin.id,action:"UPDATE_ORDER_STATUS",entity:"Order",entityId:input.id,detail:{from:order.status,to:input.status}}});
    return updated;
  });
  res.json({order});
});
