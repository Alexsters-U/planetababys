import {z} from "zod";

export const STORE_PAYMENT_LABELS={CASH:"Efectivo",TRANSFER:"Transferencia"} as const;
const safeText=(max:number)=>z.string().trim().max(max).refine(value=>!/[<>\u0000-\u001f]/.test(value),"No se permite HTML ni caracteres de control.");
export const storeSaleSchema=z.object({
  items:z.array(z.object({productId:z.string().min(1).max(64),quantity:z.number().int().min(1).max(50),expectedUnitCents:z.number().int().min(100).max(2_000_000_000)}).strict()).min(1,"Añade al menos un producto.").max(30)
    .refine(items=>new Set(items.map(item=>item.productId)).size===items.length,"No repitas productos en la venta."),
  paymentMethod:z.enum(["CASH","TRANSFER"]),
  cashReceivedCents:z.number().int().min(100).max(2_000_000_000).optional(),
  paymentReference:safeText(100).optional(),
  notes:safeText(300).default(""),
  paymentConfirmed:z.literal(true,{errorMap:()=>({message:"Confirma que recibiste el pago y entregaste los productos."})}),
}).strict().superRefine((sale,ctx)=>{
  if(sale.paymentMethod==="TRANSFER"&&sale.cashReceivedCents!==undefined)ctx.addIssue({code:"custom",path:["cashReceivedCents"],message:"El efectivo recibido solo aplica a pagos en efectivo."});
  if(sale.paymentMethod==="CASH"&&sale.paymentReference)ctx.addIssue({code:"custom",path:["paymentReference"],message:"La referencia solo aplica a transferencias."});
});
export const voidStoreSaleSchema=z.object({reason:safeText(300).refine(value=>value.length>=5,"Explica el motivo de la anulación (mínimo 5 caracteres)."),returnToStock:z.literal(true,{errorMap:()=>({message:"Confirma que los productos vuelven al inventario."})})}).strict();
export type StoreSaleInput=z.infer<typeof storeSaleSchema>;
export type StoreSaleView={
  id:string;reference:string;status:"COMPLETED"|"VOIDED";paymentMethod:"CASH"|"TRANSFER";totalCents:number;
  cashReceivedCents:number|null;cashChangeCents:number|null;paymentReference:string|null;notes:string;createdAt:string;
  recordedBy:{name:string};voidedBy:{name:string}|null;voidedAt:string|null;voidReason:string|null;
  items:{id:string;productId:string;name:string;unitCents:number;quantity:number;imageUrl:string|null}[];
};
export type StoreSaleList={sales:StoreSaleView[];total:number;page:number;pages:number;pageSize:number;
  summary:{salesCents:number;completedSales:number;cashCents:number;transferCents:number;voidedSales:number}};
