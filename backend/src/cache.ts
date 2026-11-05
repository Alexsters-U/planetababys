import {redis} from "./security";
import {config} from "./config";

// Caché corta en Redis. Cada ámbito tiene una versión que se incrementa con los cambios relevantes;
// así las entradas anteriores dejan de leerse sin borrar claves una a una.
export type CacheScope="catalog"|"dashboard";
const versionKey=(scope:CacheScope)=>`cache:${scope}:version`;

export async function cached<T>(scope:CacheScope,key:string,seconds:number,load:()=>Promise<T>):Promise<T> {
  if(seconds<=0) return load();
  let entry="";
  try {
    const version=(await redis.get(versionKey(scope)))??"0";
    entry=`cache:${scope}:${version}:${key}`;
    const hit=await redis.get(entry);
    if(hit) return JSON.parse(hit) as T;
  } catch {/* La caché es una optimización: si Redis falla se consulta PostgreSQL. */}
  const value=await load();
  if(entry) redis.set(entry,JSON.stringify(value),{EX:seconds}).catch(()=>{});
  return value;
}
export const cachedCatalog=<T>(key:string,load:()=>Promise<T>)=>cached("catalog",key,config.CATALOG_CACHE_SECONDS,load);

/** Productos o stock cambiaron: invalida catálogo y métricas. Se llama después de confirmar la transacción. */
export async function invalidateCatalog() {await invalidate("catalog","dashboard");}
/** Pagos, ventas o estados cambiaron sin tocar el catálogo. */
export async function invalidateSales() {await invalidate("dashboard");}
async function invalidate(...scopes:CacheScope[]) {
  await Promise.all(scopes.map(scope=>redis.incr(versionKey(scope)).catch(()=>{})));
}
