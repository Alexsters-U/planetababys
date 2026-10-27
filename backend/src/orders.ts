import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { CheckoutInput } from "../../src/shared/validation";
import { config } from "./config";
import { db, serializable } from "./db";
import { orderToken } from "./security";
import { checkoutUrl, type Transaction, readTransaction } from "./wompi";
import {getProductPricing} from "../../src/shared/promotions";
import {HttpError} from "./errors";
import {consumeShippingQuote} from "./shipping";
import {POLICY_VERSION} from "../../src/shared/store-profile";
export {HttpError} from "./errors";
export async function createOrder(input:CheckoutInput,key:string) {
  const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const order=await serializable(async tx => {
    const existing=await tx.order.findUnique({where:{checkoutKey:key}});
    if(existing) {
      if(existing.checkoutHash!==hash) throw new HttpError(409,"La clave de compra ya se usó con otros datos");
      if(existing.status!=="PENDING" || !existing.expiresAt || existing.expiresAt < new Date()) throw new HttpError(409,"Esta compra ya terminó o expiró");
      return existing;
    }
    if(config.SHIPPING_MODE!=="quote"&&(input.shippingQuoteToken||input.shippingQuoteAccepted))throw new HttpError(409,"La modalidad de entrega cambió. Consulta a la tienda antes de pagar.");
    const shippingQuote=config.SHIPPING_MODE==="quote"?await consumeShippingQuote(tx,input):null;
    const shippingCents=shippingQuote?.shippingCents??config.SHIPPING_CENTS;
    const lines=[];
    const pricingTime=new Date();
    let totalCents=shippingCents;
    // Orden estable para evitar deadlocks cuando carritos usan los mismos productos.
    for(const item of [...input.items].sort((a,b)=>a.productId.localeCompare(b.productId))) {
      const product=await tx.product.findUnique({where:{id:item.productId},include:{images:{orderBy:{sort:"asc"},take:1}}});
      if(!product || !product.isActive) throw new HttpError(409,"Producto no disponible");
      const {effectivePriceCents}=getProductPricing(product,pricingTime);
      if(item.expectedUnitCents!==undefined && item.expectedUnitCents!==effectivePriceCents)
        throw new HttpError(409,`El precio de ${product.name} cambió. Revisa el total antes de confirmar.`);
      const updated=await tx.product.updateMany({where:{id:product.id,isActive:true,stock:{gte:item.quantity},priceCents:product.priceCents},data:{stock:{decrement:item.quantity}}});
      if(updated.count!==1) throw new HttpError(409,`Stock insuficiente para ${product.name}`);
      totalCents+=effectivePriceCents*item.quantity;
      if(!Number.isSafeInteger(totalCents) || totalCents>2_000_000_000) throw new HttpError(422,"El total excede el límite permitido");
      lines.push({productId:product.id,name:product.name,unitCents:effectivePriceCents,quantity:item.quantity,imageUrl:product.images[0]?.url??null});
    }
    const reference=`PB-${randomUUID()}`;
    return tx.order.create({data:{
      reference,totalCents,checkoutKey:key,checkoutHash:hash,shippingCents,shippingQuoteId:shippingQuote?.id,
      customerName:input.customer.name,customerPhone:input.customer.phone,customerEmail:input.customer.email,
      shippingAddress:input.customer.address,shippingCity:input.customer.city,shippingNotes:input.customer.notes,
      dataConsent:true,termsAccepted:true,consentAt:new Date(),policyVersion:POLICY_VERSION,
      expiresAt:new Date(Date.now()+30*60*1000),items:{create:lines},
      payments:{create:{reference,amountInCents:totalCents,status:"PENDING"}},
    }});
  }).catch(async error=>{
    // Carrera con la misma clave: recuperar el resultado, nunca reservar dos veces.
    if(error?.code==="P2002") {
      const existing=await db.order.findUnique({where:{checkoutKey:key}});
      if(existing?.checkoutHash===hash && existing.status==="PENDING" && existing.expiresAt && existing.expiresAt>new Date()) return existing;
    }
    throw error;
  });
  const token=await orderToken(order.id);
  return {orderId:order.id,reference:order.reference,totalCents:order.totalCents,shippingCents:order.shippingCents,
    paymentUrl:checkoutUrl(order,token),orderToken:token,paymentMode:config.PAYMENT_MODE};
}
async function releaseStock(tx:Prisma.TransactionClient,order:{id:string;stockReleased:boolean;items:{productId:string;quantity:number}[]}) {
  if(order.stockReleased) return;
  await tx.order.update({where:{id:order.id},data:{stockReleased:true}});
  for(const item of order.items) await tx.product.updateMany({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
}
export async function applyTransaction(transaction:Transaction) {
  return serializable(async tx=>{
    const found=await tx.order.findUnique({where:{reference:transaction.reference},select:{id:true}});
    if(!found) return {applied:false};
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${found.id} FOR UPDATE`;
    const order=await tx.order.findUniqueOrThrow({where:{id:found.id},include:{items:true,payments:true}});
    const payment=order.payments[0];
    if(!payment || payment.amountInCents!==transaction.amount_in_cents || transaction.currency!=="COP") throw new HttpError(409,"Monto o moneda no coincide");
    if(payment.transactionId && payment.transactionId!==transaction.id) {
      await tx.order.update({where:{id:order.id},data:{reviewRequired:true}});
      return {applied:false,review:true};
    }
    if(payment.status!=="PENDING") {
      if(payment.status!==transaction.status && transaction.status!=="PENDING") await tx.order.update({where:{id:order.id},data:{reviewRequired:true}});
      return {applied:false};
    }
    await tx.payment.update({where:{id:payment.id},data:{
      transactionId:transaction.id,status:transaction.status,paymentMethod:transaction.payment_method_type??null,
      wompiData:{id:transaction.id,status:transaction.status,amount_in_cents:transaction.amount_in_cents,currency:"COP"},
    }});
    if(transaction.status==="APPROVED") await tx.order.update({where:{id:order.id},data:{status:"PAID",reviewRequired:order.stockReleased}});
    else if(transaction.status!=="PENDING") {
      await releaseStock(tx,order);
      await tx.order.update({where:{id:order.id},data:{status:transaction.status==="DECLINED"?"DECLINED":"VOIDED"}});
    }
    return {applied:true};
  });
}
export async function expireReservations() {
  const old=await db.order.findMany({where:{status:"PENDING",stockReleased:false,expiresAt:{lt:new Date(Date.now()-24*60*60*1000)}},include:{payments:true},take:100});
  for(const candidate of old) {
    const id=candidate.payments[0]?.transactionId;
    if(id && config.PAYMENT_MODE==="wompi") { await applyTransaction(await readTransaction(id)); continue; }
    await serializable(async tx=>{
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${candidate.id} FOR UPDATE`;
      const order=await tx.order.findUniqueOrThrow({where:{id:candidate.id},include:{items:true}});
      if(order.status!=="PENDING" || order.stockReleased) return;
      await releaseStock(tx,order);
      await tx.order.update({where:{id:order.id},data:{status:"CANCELLED"}});
    });
  }
}
