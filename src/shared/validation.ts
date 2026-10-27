import { z } from "zod";
import "./validation-messages";
export const CATEGORIES = ["panales", "lactancia", "ropa", "higiene", "juguetes", "accesorios", "general"] as const;
export type Category = (typeof CATEGORIES)[number];
// Shared HTML patterns also compile in Unicode-aware JavaScript (u/v).
export const LETTERS_PATTERN = String.raw`(?=.*\p{L})[\p{L}\p{M}\p{Zs}.'’\-]+`;
export const LETTERS_MESSAGE = "Usa letras, espacios, puntos, guiones o apóstrofes.";
export const PHONE_PATTERN = String.raw`[ \(\)\-]*(?:\+?57[ \(\)\-]*)?3(?:[ \(\)\-]*[0-9]){9}[ \(\)\-]*`;
export const PHONE_MESSAGE = "Ingresa un celular colombiano de 10 dígitos, sin letras. Puedes incluir +57.";
export const PRICE_PATTERN = String.raw`[0-9]+(?:[.,][0-9]{1,2})?`;
export const PRICE_MESSAGE = "Ingresa un precio numérico, sin separadores de miles y con máximo dos decimales.";
export const INTEGER_PATTERN = "[0-9]+";
export const STOCK_MESSAGE = "Ingresa el inventario en números enteros, sin letras, signos ni decimales.";
const fullPattern = (pattern: string) => new RegExp(`^(?:${pattern})$`, "u");
export const priceInputSchema = z.string().trim().max(12).regex(fullPattern(PRICE_PATTERN), PRICE_MESSAGE)
  .transform(value => {
    const [pesos, fraction = ""] = value.split(/[.,]/);
    return Number(pesos) * 100 + Number(fraction.padEnd(2, "0"));
  }).pipe(z.number().int().min(100).max(2_000_000_000));
export const stockInputSchema = z.string().trim().max(6).regex(fullPattern(INTEGER_PATTERN), STOCK_MESSAGE)
  .transform(Number).pipe(z.number().int().min(0).max(100000));
export const quantityInputSchema = z.string().regex(fullPattern(INTEGER_PATTERN), "La cantidad debe ser un número entero.")
  .transform(Number).pipe(z.number().int().min(1).max(50));
const text = (min: number, max: number) => z.string().trim().min(min).max(max)
  .refine(v => !/[<>\u0000-\u001f]/.test(v), "No se permite HTML ni caracteres de control");
const description = z.string().trim().max(2000).refine(v => !/[<>\u0000]/.test(v), "Descripción inválida");
const productFieldsSchema = z.object({
  name: text(3, 120), description: description.default(""),
  priceCents: z.number().int().min(100).max(2_000_000_000),
  stock: z.number().int().min(0).max(100000).default(0),
  category: z.enum(CATEGORIES).default("general"),
  isActive: z.boolean().default(true), isFeatured: z.boolean().default(false),
  promotionEnabled: z.boolean().default(false),
  promotionPriceCents: z.number().int().min(100).max(2_000_000_000).nullable().default(null),
  promotionStartsAt: z.string().datetime({offset:true,message:"Ingresa una fecha de inicio válida."}).nullable().default(null),
  promotionEndsAt: z.string().datetime({offset:true,message:"Ingresa una fecha de finalización válida."}).nullable().default(null),
  imageUrl: z.string().max(300).regex(/^\/(?:images\/products\/(?:branding-2026-10-02\/)?[a-zA-Z0-9_-]+\.(?:webp|svg)|api\/media\/[a-f0-9-]+\.webp)$/, "Imagen local inválida").nullable().optional(),
}).strict();
export const productCreateSchema = productFieldsSchema.superRefine((product, ctx) => {
  if (product.promotionPriceCents !== null && product.promotionPriceCents >= product.priceCents)
    ctx.addIssue({code:"custom",path:["promotionPriceCents"],message:"El precio de oferta debe ser menor que el precio habitual."});
  if (product.promotionEnabled && product.promotionPriceCents === null)
    ctx.addIssue({code:"custom",path:["promotionPriceCents"],message:"Ingresa el precio de oferta."});
  if ((product.promotionEnabled || product.promotionStartsAt !== null) && product.promotionEndsAt === null)
    ctx.addIssue({code:"custom",path:["promotionEndsAt"],message:"Indica cuándo termina la promoción."});
  if (product.promotionStartsAt && product.promotionEndsAt && new Date(product.promotionStartsAt) >= new Date(product.promotionEndsAt))
    ctx.addIssue({code:"custom",path:["promotionEndsAt"],message:"La finalización debe ser posterior al inicio."});
});
// Partial updates are checked against the existing product inside a transaction.
export const productUpdateSchema = productFieldsSchema.partial();
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export const checkoutSchema = z.object({
  shippingQuoteToken: z.string().max(1500).optional(),
  shippingQuoteAccepted: z.literal(true, {errorMap:()=>({message:"Debes confirmar el costo del envío y el total."})}).optional(),
  items: z.array(z.object({ productId: text(1,64), quantity: z.number().int().min(1).max(50), expectedUnitCents: z.number().int().min(100).max(2_000_000_000).optional() }).strict()).min(1).max(30)
    .refine(items => new Set(items.map(i => i.productId)).size === items.length, "Productos duplicados en el carrito"),
  customer: z.object({
    name: text(3,80).refine(v => fullPattern(LETTERS_PATTERN).test(v), LETTERS_MESSAGE)
      .refine(v => v.split(/\s+/).filter(part => /\p{L}/u.test(part)).length >= 2, "Ingresa nombre y apellido"),
    phone: z.string().trim().max(25).regex(fullPattern(PHONE_PATTERN), PHONE_MESSAGE)
      .transform(v => v.replace(/[ ()-]/g, "").replace(/^\+?57/, ""))
      .refine(v => /^3\d{9}$/.test(v), "Ingresa un celular colombiano de 10 dígitos"),
    email: z.string().trim().toLowerCase().email("Correo inválido").max(120),
    address: text(8,250), city: text(2,60).refine(v => fullPattern(LETTERS_PATTERN).test(v), LETTERS_MESSAGE)
      .refine(v => v !== "Otra ciudad", "Escribe el nombre de la ciudad"),
    notes: text(0,300).optional(),
  }).strict(),
  dataConsent: z.literal(true, { errorMap: () => ({ message: "Debes aceptar la Política de Privacidad y Tratamiento de Datos Personales" }) }),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "Debes aceptar los términos y condiciones" }) }),
}).strict();
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const cartQuoteSchema = z.object({items: checkoutSchema.shape.items}).strict();
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(8).max(72) }).strict();
export const orderStatusUpdateSchema = z.object({ id: text(1,64), status: z.enum(["PACKED", "SHIPPED", "DELIVERED"]) }).strict();
