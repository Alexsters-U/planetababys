import {randomUUID} from "node:crypto";
import {readdir,stat,unlink} from "node:fs/promises";
import path from "node:path";
import {config} from "./config";
import {db} from "./db";
import {redis} from "./security";
import {expireReservations} from "./orders";

const instance=randomUUID();
const CLEANUP_EVERY_SECONDS=6*3600;
const MEDIA_PREFIX="/api/media/";

/** Ejecuta el trabajo solo en una réplica a la vez; si Redis no responde, no ejecuta para no duplicar llamadas a Wompi. */
async function withLock(name:string,ttlMs:number,work:()=>Promise<void>) {
  const key=`lock:${name}`;
  const acquired=await redis.set(key,instance,{NX:true,PX:ttlMs}).catch(()=>null);
  if(acquired!=="OK") return false;
  try {await work();}
  finally {
    // Libera solo si el bloqueo sigue siendo de esta instancia.
    await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",{keys:[key],arguments:[instance]}).catch(()=>{});
  }
  return true;
}

/**
 * Borra imágenes subidas que ninguna ficha, pedido ni venta del local referencia.
 * Respeta un margen de antigüedad para no tocar una foto recién subida cuyo producto aún no se guarda.
 */
export async function cleanupOrphanUploads(options:{now?:Date;olderThanHours?:number;directory?:string;limit?:number}={}) {
  const directory=path.resolve(options.directory??config.UPLOAD_DIR),now=(options.now??new Date()).getTime();
  const threshold=now-(options.olderThanHours??config.UPLOAD_CLEANUP_HOURS)*3600000,limit=options.limit??500;
  const names=(await readdir(directory).catch(()=>[] as string[])).filter(name=>/^[0-9a-f-]{36}\.webp$/.test(name)).slice(0,5000);
  if(!names.length) return {checked:0,removed:[] as string[]};
  const urls=names.map(name=>MEDIA_PREFIX+name);
  const [images,orderItems,storeItems]=await Promise.all([
    db.productImage.findMany({where:{url:{in:urls}},select:{url:true}}),
    db.orderItem.findMany({where:{imageUrl:{in:urls}},select:{imageUrl:true},distinct:["imageUrl"]}),
    db.storeSaleItem.findMany({where:{imageUrl:{in:urls}},select:{imageUrl:true},distinct:["imageUrl"]}),
  ]);
  const referenced=new Set<string>([...images.map(i=>i.url),...orderItems.map(i=>i.imageUrl!),...storeItems.map(i=>i.imageUrl!)]);
  const removed:string[]=[];
  for(const name of names) {
    if(removed.length>=limit) break;
    if(referenced.has(MEDIA_PREFIX+name)) continue;
    const file=path.join(directory,name);
    const info=await stat(file).catch(()=>null);
    if(!info?.isFile() || info.mtimeMs>threshold) continue;
    await unlink(file).then(()=>removed.push(name)).catch(()=>{});
  }
  if(removed.length) console.log(JSON.stringify({event:"ORPHAN_UPLOADS_REMOVED",count:removed.length}));
  return {checked:names.length,removed};
}

export async function runMaintenance(now=new Date()) {
  await withLock("reconcile",55000,()=>expireReservations({now}));
  // La clave con vencimiento marca la cadencia compartida: una limpieza cada seis horas entre todas las réplicas.
  const due=await redis.set("cadence:upload-cleanup",instance,{NX:true,EX:CLEANUP_EVERY_SECONDS}).catch(()=>null);
  if(due==="OK") await cleanupOrphanUploads({now}).catch(()=>console.error(JSON.stringify({error:"ORPHAN_UPLOADS_CLEANUP_FAILED"})));
}
