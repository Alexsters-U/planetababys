import { z } from "zod";
import {storeProfile} from "../../src/shared/store-profile";
const boolean = z.enum(["true","false"]).transform(v => v === "true");
export const config = z.object({
  NODE_ENV: z.enum(["development","test","production"]).default("development"),
  APP_ENV: z.enum(["development","test","production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1), REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32), SESSION_SECRET: z.string().min(32),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  COOKIE_SECURE: boolean.default("false"),
  PAYMENT_MODE: z.enum(["wompi","test"]).default("wompi"),
  WOMPI_ENV: z.enum(["test","prod"]).default("test"),
  WOMPI_PUBLIC_KEY: z.string().default(""), WOMPI_PRIVATE_KEY: z.string().default(""),
  WOMPI_INTEGRITY_KEY: z.string().default(""), WOMPI_EVENTS_KEY: z.string().default(""),
  UPLOAD_DIR: z.string().default("./uploads"),
  SHIPPING_CENTS: z.coerce.number().int().min(0).max(100_000_000).default(0),
  SHIPPING_MODE: z.enum(["fixed", "quote"]).default("quote"),
  SHIPPING_CONFIGURED: boolean.default("false"),
  SHIPPING_ALLOWED_CITIES: z.string().default(""),
  STORE_LEGAL_NAME: z.string().default(""),
  STORE_TAX_ID: z.string().default(""),
  STORE_ADDRESS: z.string().default(""),
  STORE_CONTACT_EMAIL: z.string().email().or(z.literal("")).default(""),
  STORE_CONTACT_PHONE: z.string().default(""),
  TRUST_PROXY: z.enum(["false","loopback"]).default("false"),
}).parse(process.env);
// An unavailable API or an empty local env must not erase confirmed public details.
config.STORE_LEGAL_NAME ||= storeProfile.name;
config.STORE_TAX_ID ||= storeProfile.taxId;
config.STORE_ADDRESS ||= storeProfile.address;
config.STORE_CONTACT_EMAIL ||= storeProfile.email;
config.STORE_CONTACT_PHONE ||= storeProfile.phone;
if (config.APP_ENV === "production") {
  if (!config.COOKIE_SECURE || !config.SITE_URL.startsWith("https://") || config.PAYMENT_MODE !== "wompi" || config.WOMPI_ENV !== "prod") throw new Error("Producción requiere HTTPS, cookies Secure y Wompi prod");
  for (const secret of [config.JWT_SECRET,config.SESSION_SECRET]) if (/cambia|example|cadena|test/i.test(secret)) throw new Error("Reemplaza secretos de ejemplo en producción");
  if(!config.STORE_LEGAL_NAME || !config.STORE_ADDRESS || !config.STORE_CONTACT_EMAIL || !config.STORE_CONTACT_PHONE) throw new Error("Completa responsable, domicilio y canales legales antes de producción");
  if(!config.SHIPPING_CONFIGURED || !config.SHIPPING_ALLOWED_CITIES.trim()) throw new Error("Define tarifa y cobertura antes de producción");
  if(config.JWT_SECRET===config.SESSION_SECRET) throw new Error("Los secretos de administración y pedidos deben ser distintos");
}
if (config.PAYMENT_MODE === "test" && config.APP_ENV !== "test") throw new Error("El simulador de pago solo puede ejecutarse con APP_ENV=test");
if (config.PAYMENT_MODE === "wompi") {
  if (!config.WOMPI_PUBLIC_KEY.startsWith(`pub_${config.WOMPI_ENV}_`) || !config.WOMPI_PRIVATE_KEY.startsWith(`prv_${config.WOMPI_ENV}_`) || !config.WOMPI_INTEGRITY_KEY || !config.WOMPI_EVENTS_KEY) throw new Error("Configura las cuatro llaves Wompi del mismo ambiente; no se aceptan pagos sin configurar");
}
