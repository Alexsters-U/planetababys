import {admin} from "./admin";
import express, {type ErrorRequestHandler} from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import path from "node:path";
import {ZodError,z} from "zod";
import {config} from "./config";
import {db,serializable} from "./db";
import {ADMIN_COOKIE,cookieOptions,redis,signSession,readSession,requireAdmin,sameOrigin,isAllowedOrigin,limit,canReadOrder,orderToken} from "./security";
import {checkoutUrl} from "./wompi";
import {checkoutSchema,cartQuoteSchema,loginSchema,CATEGORIES} from "../../src/shared/validation";
import {promotionWhere,pricedProduct} from "./promotions";
import {createOrder,applyTransaction,expireReservations,HttpError} from "./orders";
import {verifiedTransaction} from "./wompi";
import {createShippingQuote,readShippingToken,quotePublic} from "./shipping";

const app=express();
app.disable("x-powered-by");
app.set("trust proxy",config.TRUST_PROXY==="loopback"?"loopback":false);
app.use(helmet({hsts:config.COOKIE_SECURE?undefined:false}));
app.use(cors({origin(origin,callback){callback(null,!origin || isAllowedOrigin(origin));},credentials:true,methods:["GET","POST","PATCH","DELETE","OPTIONS"]}));
app.use(cookieParser());
app.use(sameOrigin);
app.use(express.json({limit:"64kb",strict:true}));
app.use((req,res,next)=>{
  res.setHeader("Cache-Control","no-store");
  const requestId=randomUUID(); res.setHeader("X-Request-Id",requestId);
  const start=Date.now();
  res.on("finish",()=>console.log(JSON.stringify({requestId,method:req.method,path:req.path,status:res.statusCode,durationMs:Date.now()-start})));
  next();
});
app.get("/api/health",async(_req,res)=>{
  await db.$queryRaw`SELECT 1`; await redis.ping(); res.json({status:"ok"});
});
app.get("/api/store/config",(_req,res)=>res.json({
  shippingCents:config.SHIPPING_MODE==="quote"?null:config.SHIPPING_CENTS,shippingMode:config.SHIPPING_MODE,shippingConfigured:config.SHIPPING_CONFIGURED,
  coverage:config.SHIPPING_ALLOWED_CITIES,paymentMode:config.PAYMENT_MODE,
  legal:{name:config.STORE_LEGAL_NAME,taxId:config.STORE_TAX_ID,address:config.STORE_ADDRESS,email:config.STORE_CONTACT_EMAIL,phone:config.STORE_CONTACT_PHONE},
}));
app.post("/api/shipping/quotes",limit("shipping-quote",10,60),async(req,res)=>{
  if(!config.SHIPPING_CONFIGURED || config.SHIPPING_MODE!=="quote") throw new HttpError(503,"La cotización de envíos no está disponible.");
  const key=z.string().uuid().parse(req.headers["idempotency-key"]);
  res.status(201).json(await createShippingQuote(checkoutSchema.parse(req.body),key));
});
app.get("/api/shipping/quotes/:id",limit("shipping-read",60,60),async(req,res)=>{
  const id=String(req.params.id);
  if(await readShippingToken(typeof req.query.token==="string"?req.query.token:undefined)!==id) throw new HttpError(404,"Cotización no encontrada.");
  const quote=await db.shippingQuote.findUnique({where:{id}});
  if(!quote) throw new HttpError(404,"Cotización no encontrada.");
  const order=await db.order.findUnique({where:{shippingQuoteId:id}});
  const token=order?await orderToken(order.id):null;
  res.json({quote:quotePublic(quote),paymentMode:config.PAYMENT_MODE,
    orderUrl:order?`${config.SITE_URL}/pedido/${order.id}?token=${token}`:null,
    paymentUrl:order&&order.status==="PENDING"&&order.expiresAt&&order.expiresAt>new Date()?checkoutUrl(order,token!):null});
});
app.get("/api/products",limit("catalog",120,60),async(req,res)=>{
  const query=z.object({q:z.string().max(100).optional(),category:z.enum(CATEGORIES).optional(),
    featured:z.enum(["true","false"]).optional(),promotions:z.enum(["true","false"]).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(48).default(24)}).parse(req.query);
  const now=new Date();
  const where={isActive:true,...(query.category?{category:query.category}:{}),...(query.featured==="true"?{isFeatured:true}:{}),
    ...(query.q?{OR:[{name:{contains:query.q,mode:"insensitive" as const}},{description:{contains:query.q,mode:"insensitive" as const}}]}:{}),
    ...(query.promotions==="true"?{AND:[promotionWhere("active",now)]}:{})};
  const [products,total]=await Promise.all([db.product.findMany({where,include:{images:{orderBy:{sort:"asc"}}},orderBy:{createdAt:"desc"},take:query.limit,skip:(query.page-1)*query.limit}),db.product.count({where})]);
  res.json({products:products.map(p=>pricedProduct(p,now)),total,page:query.page,pages:Math.ceil(total/query.limit)});
});
app.get("/api/products/:slug",async(req,res)=>{
  const product=await db.product.findUnique({where:{slug:String(req.params.slug)},include:{images:{orderBy:{sort:"asc"}}}});
  if(!product?.isActive) throw new HttpError(404,"Producto no encontrado");
  res.json({product:pricedProduct(product,new Date())});
});
app.post("/api/cart/quote",limit("quote",60,60),async(req,res)=>{
  const input=cartQuoteSchema.parse(req.body);
  const now=new Date();
  const products=await db.product.findMany({where:{id:{in:input.items.map(item=>item.productId)}},include:{images:{orderBy:{sort:"asc"},take:1}}});
  const items=input.items.map(item=>{
    const product=products.find(p=>p.id===item.productId);
    if(!product?.isActive) throw new HttpError(409,"Un producto del carrito ya no está disponible. Retíralo para continuar.");
    if(product.stock<item.quantity) throw new HttpError(409,`Solo quedan ${product.stock} unidades de ${product.name}. Ajusta tu carrito.`);
    const priced=pricedProduct(product,now);
    return {productId:product.id,slug:product.slug,name:product.name,priceCents:priced.effectivePriceCents,originalPriceCents:priced.originalPriceCents,
      discountPercent:priced.discountPercent,promotionEndsAt:priced.promotionActive?product.promotionEndsAt:null,
      stock:product.stock,imageUrl:product.images[0]?.url??null};
  });
  res.json({items,subtotalCents:items.reduce((sum,item,index)=>sum+item.priceCents*input.items[index].quantity,0),pricingAsOf:now.toISOString()});
});
app.post("/api/auth/login",limit("login",5,60),async(req,res)=>{
  const input=loginSchema.parse(req.body);
  const user=await db.adminUser.findUnique({where:{email:input.email}});
  // Comparación incluso sin usuario: reduce diferencia temporal de enumeración.
  const valid=await bcrypt.compare(input.password,user?.passwordHash??"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
  if(!user || !valid) throw new HttpError(401,"Credenciales inválidas");
  await db.auditLog.create({data:{adminId:user.id,action:"LOGIN",entity:"AdminUser",entityId:user.id}});
  res.cookie(ADMIN_COOKIE,await signSession(user),cookieOptions).json({user:{id:user.id,email:user.email}});
});
app.get("/api/auth/me",requireAdmin,(_req,res)=>res.json({user:{id:res.locals.admin.id,email:res.locals.admin.email}}));
app.post("/api/auth/logout",async(req,res)=>{
  const session=await readSession(req);
  if(session) await redis.set(`revoked:${session.jti}`,"1",{EX:8*60*60});
  res.clearCookie(ADMIN_COOKIE,cookieOptions).json({ok:true});
});
app.post("/api/orders",limit("checkout",10,60),async(req,res)=>{
  if(!config.SHIPPING_CONFIGURED) throw new HttpError(503,"Estamos definiendo la tarifa y cobertura de entrega");
  const key=z.string().uuid().parse(req.headers["idempotency-key"]);
  const input=checkoutSchema.parse(req.body);
  const normalized=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  if(config.SHIPPING_ALLOWED_CITIES!=="*" && !config.SHIPPING_ALLOWED_CITIES.split(",").map(normalized).includes(normalized(input.customer.city))) throw new HttpError(422,"Tu ciudad está fuera de la cobertura de entrega");
  res.status(201).json(await createOrder(input,key));
});
app.get("/api/orders/:id",limit("order-read",60,60),async(req,res)=>{
  const id=String(req.params.id);
  if(!await canReadOrder(req,id)) throw new HttpError(404,"Pedido no encontrado");
  const order=await db.order.findUnique({where:{id},include:{items:true,payments:{take:1,orderBy:{createdAt:"desc"}}}});
  if(!order) throw new HttpError(404,"Pedido no encontrado");
  res.json({order:{id:order.id,reference:order.reference,status:order.status,totalCents:order.totalCents,shippingCents:order.shippingCents,
    createdAt:order.createdAt,customerName:order.customerName,shippingCity:order.shippingCity,reviewRequired:order.reviewRequired,
    items:order.items.map(({name,quantity,unitCents,imageUrl})=>({name,quantity,unitCents,imageUrl})),
    payment:order.payments[0]?{status:order.payments[0].status,method:order.payments[0].paymentMethod,reference:order.reference}:null}});
});
app.post("/api/webhooks/wompi",async(req,res)=>{
  let transaction;
  try {transaction=await verifiedTransaction(req.body);} catch(error) {
    if(error instanceof ZodError || (error instanceof Error && /Checksum|firma|Propiedad|firmado|Ambiente/.test(error.message))) throw new HttpError(403,"Evento inválido");
    throw error; // Error de proveedor: 500 para que Wompi reintente.
  }
  await applyTransaction(transaction);
  res.json({received:true});
});
app.use("/api/admin",admin);
app.use("/api/media",express.static(path.resolve(config.UPLOAD_DIR),{dotfiles:"deny",immutable:true,maxAge:"1y",fallthrough:false,setHeaders(res){res.setHeader("Content-Security-Policy","default-src 'none'");res.setHeader("X-Content-Type-Options","nosniff");}}));
app.use((_req,res)=>res.status(404).json({error:"Ruta no encontrada"}));
const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
  if(error instanceof ZodError) {res.status(422).json({error:error.issues[0]?.message??"Datos inválidos",issues:error.issues.map(i=>({path:i.path,message:i.message}))});return;}
  const status=error instanceof HttpError?error.status:error.code==="P2025"?404:error.code==="P2002"?409:error.type==="entity.parse.failed"?400:error.code==="LIMIT_FILE_SIZE"?413:error.status===413?413:500;
  if(status===500) console.error(JSON.stringify({error:"API_ERROR",code:error.code??"internal"}));
  res.status(status).json({error:status===500?"Error interno; inténtalo de nuevo":error instanceof HttpError?error.message:status===404?"Recurso no encontrado":status===413?"Archivo o solicitud demasiado grande":"Solicitud inválida"});
};
app.use(errors);
async function main() {
  await db.$connect(); await redis.connect(); await mkdir(config.UPLOAD_DIR,{recursive:true});
  const server=app.listen(config.API_PORT,"0.0.0.0",()=>console.log(`API disponible en puerto ${config.API_PORT}`));
  let workerBusy=false;
  const timer=setInterval(async()=>{if(workerBusy)return;workerBusy=true;try{await expireReservations();}catch{console.error("No se pudo reconciliar reservas");}finally{workerBusy=false;}},60000);
  timer.unref();
  for(const signal of ["SIGTERM","SIGINT"]) process.on(signal,()=>{
    clearInterval(timer);server.close(async()=>{await db.$disconnect();await redis.quit();process.exit(0);});
    setTimeout(()=>process.exit(1),10000).unref();
  });
}
main().catch(()=>{console.error("No se pudo iniciar API: verifica configuración y dependencias");process.exit(1);});
