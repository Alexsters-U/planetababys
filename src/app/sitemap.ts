import type {MetadataRoute} from "next";
import {catalog} from "@/shared/api/server";
import {publicSiteUrl} from "@/shared/seo";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const base=publicSiteUrl();
  const entries:MetadataRoute.Sitemap=["/","/catalogo","/privacidad","/terminos","/devoluciones"].map(path=>({url:new URL(path,base).href}));
  let page=1,pages=1;
  do {
    const result=await catalog({page,limit:48});pages=result.pages;
    if(pages>1000)throw new Error("El catálogo requiere dividir el sitemap antes de superar 48000 productos");
    for(const product of result.products)entries.push({url:new URL(`/producto/${encodeURIComponent(product.slug)}`,base).href});
    page++;
  }while(page<=pages);
  return entries;
}
