import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "./config";
const transactionSchema = z.object({
  id:z.string().min(1).max(100), reference:z.string().min(1).max(100),
  status:z.enum(["PENDING","APPROVED","DECLINED","VOIDED","ERROR"]),
  amount_in_cents:z.number().int().positive(), currency:z.literal("COP"),
  payment_method_type:z.string().max(40).optional().nullable(),
});
export type Transaction = z.infer<typeof transactionSchema>;
const eventSchema=z.object({
  event:z.literal("transaction.updated"), environment:z.enum(["test","prod"]),
  timestamp:z.number().int().positive(), data:z.object({transaction:z.record(z.unknown())}),
  signature:z.object({checksum:z.string().regex(/^[a-fA-F0-9]{64}$/),properties:z.array(z.string().max(100)).min(3).max(20)}),
});
export function checksum(data:Record<string,unknown>,properties:string[],timestamp:number,key:string) {
  const values=properties.map(property => {
    let value:unknown=data;
    for(const part of property.split(".")) {
      if(["__proto__","constructor","prototype"].includes(part) || !value || typeof value!=="object" || !Object.hasOwn(value,part)) throw new Error("Propiedad de firma inválida");
      value=(value as Record<string,unknown>)[part];
    }
    if(!["string","number","boolean"].includes(typeof value)) throw new Error("Valor firmado inválido");
    return String(value);
  }).join("");
  return createHash("sha256").update(`${values}${timestamp}${key}`).digest("hex");
}
export function verifyEvent(body:unknown) {
  const event=eventSchema.parse(body);
  if(event.environment!==config.WOMPI_ENV) throw new Error("Ambiente incorrecto");
  if(!["transaction.id","transaction.status","transaction.amount_in_cents"].every(p=>event.signature.properties.includes(p))) throw new Error("Faltan propiedades críticas en la firma");
  const expected=checksum(event.data,event.signature.properties,event.timestamp,config.WOMPI_EVENTS_KEY);
  if(!timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(event.signature.checksum,"hex"))) throw new Error("Checksum inválido");
  return event;
}
export async function readTransaction(id:string):Promise<Transaction> {
  const base=config.WOMPI_ENV==="prod"?"https://production.wompi.co/v1":"https://sandbox.wompi.co/v1";
  const response=await fetch(`${base}/transactions/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${config.WOMPI_PRIVATE_KEY}`},signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error("No se pudo verificar la transacción con Wompi");
  const json=await response.json() as {data:unknown};
  return transactionSchema.parse(json.data);
}
export async function verifiedTransaction(body:unknown) {
  const event=verifyEvent(body);
  const signed=transactionSchema.parse(event.data.transaction);
  // La referencia y moneda no siempre están firmadas: consultar API evita confiar en campos mutables.
  const canonical=config.PAYMENT_MODE==="test"?signed:await readTransaction(signed.id);
  if(canonical.id!==signed.id || canonical.amount_in_cents!==signed.amount_in_cents) throw new Error("Evento y transacción no coinciden");
  return canonical;
}
export function checkoutUrl(order:{id:string;reference:string;totalCents:number;expiresAt:Date|null},token:string) {
  if(config.PAYMENT_MODE==="test") return `${config.SITE_URL}/pedido/${order.id}?token=${encodeURIComponent(token)}`;
  const expiration=order.expiresAt!.toISOString();
  const signature=createHash("sha256").update(`${order.reference}${order.totalCents}COP${expiration}${config.WOMPI_INTEGRITY_KEY}`).digest("hex");
  const params=new URLSearchParams({
    "public-key":config.WOMPI_PUBLIC_KEY,currency:"COP","amount-in-cents":String(order.totalCents),
    reference:order.reference,"expiration-time":expiration,"signature:integrity":signature,
    "redirect-url":`${config.SITE_URL}/pedido/${order.id}?token=${encodeURIComponent(token)}`,
  });
  return `https://checkout.wompi.co/p/?${params}`;
}
