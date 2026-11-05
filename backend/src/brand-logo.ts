import {access} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type {RasterImage} from "./pdf";

// Logo para documentos PDF. En la imagen Docker se copia a assets/brand-logo.png; en desarrollo se lee de public.
const CANDIDATES=[process.env.BRAND_LOGO_PATH,"assets/brand-logo.png","public/images/brand/icon-512.png","../public/images/brand/icon-512.png"]
  .filter((value):value is string=>Boolean(value)).map(value=>path.resolve(value));
const SIZE=320; // Suficiente para imprimir a ~75 pt con buena nitidez.
let cached:Promise<RasterImage|null>|null=null;

async function load():Promise<RasterImage|null> {
  for(const file of CANDIDATES) {
    if(!await access(file).then(()=>true,()=>false)) continue;
    const {data,info}=await sharp(file).resize(SIZE,SIZE,{fit:"inside"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const pixels=info.width*info.height,rgb=Buffer.alloc(pixels*3),alpha=Buffer.alloc(pixels);
    for(let i=0;i<pixels;i++){rgb[i*3]=data[i*4];rgb[i*3+1]=data[i*4+1];rgb[i*3+2]=data[i*4+2];alpha[i]=data[i*4+3];}
    return {width:info.width,height:info.height,rgb,alpha};
  }
  console.error(JSON.stringify({error:"BRAND_LOGO_NOT_FOUND"}));
  return null;
}
/** Carga una sola vez; si el archivo falta, los PDF se generan sin logo en lugar de fallar. */
export function brandLogo() {
  cached??=load().catch(()=>null);
  return cached;
}
