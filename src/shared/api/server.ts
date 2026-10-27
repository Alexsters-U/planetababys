import "server-only";
import type {PromotionSource,PromotionStatus} from "@/shared/promotions";
export type Product = PromotionSource & {
  id:string;slug:string;name:string;description:string;priceCents:number;stock:number;
  category:string;isActive:boolean;isFeatured:boolean;images:{url:string;alt:string}[];
  effectivePriceCents:number;originalPriceCents:number|null;discountPercent:number;promotionStatus:PromotionStatus;promotionActive:boolean;
};
const base=()=>process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
export async function serverApi<T>(url:string,cookie?:string):Promise<T> {
  const response=await fetch(`${base()}/api${url}`,{cache:"no-store",headers:cookie?{Cookie:cookie}:{},signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error(`API no disponible (${response.status})`);
  return response.json();
}
export function catalog(params:Record<string,string|number|undefined>={}) {
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params)) if(value!==undefined) query.set(key,String(value));
  return serverApi<{products:Product[];total:number;page:number;pages:number}>(`/products?${query}`);
}
export async function productBySlug(slug:string):Promise<Product|null> {
  const response=await fetch(`${base()}/api/products/${encodeURIComponent(slug)}`,{cache:"no-store"});
  if(response.status===404) return null;
  if(!response.ok) throw new Error("No se pudo consultar el producto");
  return ((await response.json()) as {product:Product}).product;
}
