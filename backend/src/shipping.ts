import {createHash, randomUUID} from "node:crypto";
import {SignJWT, jwtVerify} from "jose";
import {z} from "zod";
import type {Prisma, ShippingQuote} from "@prisma/client";
import {checkoutSchema, type CheckoutInput} from "../../src/shared/validation";
import {POLICY_VERSION} from "../../src/shared/store-profile";
import {config} from "./config";
import {db, serializable} from "./db";
import {HttpError} from "./errors";
import {getProductPricing} from "../../src/shared/promotions";

export function quoteFingerprint(input: CheckoutInput) {
  const {shippingQuoteToken: _token, shippingQuoteAccepted: _accepted, ...request} = input;
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}
export function shippingToken(id: string) {
  return new SignJWT({quoteId: id}).setProtectedHeader({alg:"HS256"})
    .setIssuer("planetababys-shipping").setAudience("guest-shipping")
    .setIssuedAt().setExpirationTime("7d").sign(new TextEncoder().encode(config.SESSION_SECRET));
}
export async function readShippingToken(token?: string) {
  try {
    const {payload}=await jwtVerify(token ?? "",new TextEncoder().encode(config.SESSION_SECRET),{
      issuer:"planetababys-shipping",audience:"guest-shipping",algorithms:["HS256"],
    });
    if(typeof payload.quoteId!=="string") throw new Error();
    return payload.quoteId;
  } catch { throw new HttpError(403,"El enlace de cotización no es válido. Solicita uno nuevo a la tienda."); }
}
export function quotePublic(quote: ShippingQuote) {
  return {id:quote.id,reference:quote.reference,status:quote.status,request:checkoutSchema.parse(quote.request),
    lines:quote.lines,subtotalCents:quote.subtotalCents,shippingCents:quote.shippingCents,
    deliveryEstimate:quote.deliveryEstimate,expiresAt:quote.expiresAt,createdAt:quote.createdAt,
    expired:quote.expiresAt < new Date(),policyVersion:quote.policyVersion};
}
export async function createShippingQuote(input: CheckoutInput, key: string) {
  if(input.shippingQuoteToken||input.shippingQuoteAccepted) throw new HttpError(422,"No incluyas una cotización previa al solicitar otra.");
  const requestHash=quoteFingerprint(input);
  const quote=await serializable(async tx=>{
    const existing=await tx.shippingQuote.findUnique({where:{requestKey:key}});
    if(existing) {
      if(existing.requestHash!==requestHash) throw new HttpError(409,"Esta solicitud ya se usó con otros datos.");
      return existing;
    }
    const request=checkoutSchema.parse(input);
    const lines=[];
    let subtotalCents=0;
    for(const item of request.items) {
      const product=await tx.product.findUnique({where:{id:item.productId}});
      if(!product?.isActive || product.stock<item.quantity) throw new HttpError(409,"Revisa la disponibilidad de tu carrito antes de cotizar.");
      const {effectivePriceCents}=getProductPricing(product,new Date());
      if(item.expectedUnitCents!==undefined && item.expectedUnitCents!==effectivePriceCents)
        throw new HttpError(409,"Los precios cambiaron. Revisa el carrito y vuelve a cotizar.");
      item.expectedUnitCents=effectivePriceCents;
      subtotalCents+=effectivePriceCents*item.quantity;
      if(subtotalCents>1_900_000_000) throw new HttpError(422,"El total excede el límite permitido.");
      lines.push({name:product.name,quantity:item.quantity,unitCents:effectivePriceCents});
    }
    return tx.shippingQuote.create({data:{reference:`ENV-${randomUUID().slice(0,8).toUpperCase()}`,
      requestKey:key,requestHash,request:request as Prisma.InputJsonValue,lines,subtotalCents,
      policyVersion:POLICY_VERSION,consentAt:new Date(),expiresAt:new Date(Date.now()+48*60*60*1000)}});
  }).catch(async error=>{
    if(error?.code==="P2002") {
      const existing=await db.shippingQuote.findUnique({where:{requestKey:key}});
      if(existing?.requestHash===requestHash) return existing;
    }
    throw error;
  });
  return {...quotePublic(quote),token:await shippingToken(quote.id)};
}
export async function consumeShippingQuote(tx: Prisma.TransactionClient,input: CheckoutInput) {
  if(input.shippingQuoteAccepted!==true)throw new HttpError(422,"Debes confirmar el costo del envío y el total antes de pagar.");
  const id=await readShippingToken(input.shippingQuoteToken);
  const quote=await tx.shippingQuote.findUnique({where:{id}});
  if(!quote || quote.status!=="QUOTED" || quote.shippingCents===null || quote.expiresAt < new Date())
    throw new HttpError(409,"El envío aún no está confirmado, la cotización venció o ya fue utilizada.");
  if(quote.policyVersion!==POLICY_VERSION) throw new HttpError(409,"Las políticas cambiaron. Solicita una nueva cotización.");
  if(quoteFingerprint(checkoutSchema.parse(quote.request))!==quoteFingerprint(input))
    throw new HttpError(409,"El carrito o los datos de entrega cambiaron. Solicita una nueva cotización.");
  const updated=await tx.shippingQuote.updateMany({where:{id,status:"QUOTED",expiresAt:{gt:new Date()}},data:{status:"CONSUMED"}});
  if(updated.count!==1) throw new HttpError(409,"Esta cotización ya fue utilizada.");
  return quote;
}
export const offerSchema=z.object({shippingCents:z.number().int().min(0).max(100_000_000),
  deliveryEstimate:z.string().trim().min(3).max(120).refine(v=>!/[<>\u0000-\u001f]/.test(v),"Indica un plazo de entrega válido.")}).strict();
