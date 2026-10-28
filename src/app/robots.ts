import type {MetadataRoute} from "next";
import {indexingEnabled,publicSiteUrl} from "@/shared/seo";
export const dynamic="force-dynamic";
export default function robots():MetadataRoute.Robots {
  return {rules:{userAgent:"*",...(indexingEnabled()?{allow:"/",disallow:["/admin","/api/","/carrito","/checkout","/pedido/","/cotizacion/","/pago/"]}:{disallow:"/"})},sitemap:new URL("/sitemap.xml",publicSiteUrl()).href};
}
