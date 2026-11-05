import {inflateSync} from "node:zlib";

/** Valida la tabla xref y devuelve el contenido descomprimido de las páginas como texto latin1. */
export function readPdf(buffer:Buffer) {
  const text=buffer.toString("latin1");
  if(!text.startsWith("%PDF-1.4")||!text.trimEnd().endsWith("%%EOF")) throw new Error("Cabecera o cierre PDF inválido");
  const startxref=Number(/startxref\n(\d+)\n%%EOF\s*$/.exec(text)?.[1]);
  if(!text.startsWith("xref",startxref)) throw new Error("startxref no apunta a la tabla xref");
  const [,count]=/xref\n0 (\d+)\n/.exec(text.slice(startxref))!.map(Number);
  const entries=[...text.slice(startxref).matchAll(/(\d{10}) 00000 n \n/g)].map(m=>Number(m[1]));
  if(entries.length!==count-1) throw new Error("Número de objetos xref incorrecto");
  entries.forEach((offset,i)=>{if(!text.startsWith(`${i+1} 0 obj\n`,offset)) throw new Error(`Desplazamiento incorrecto del objeto ${i+1}`);});
  const pages=Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(text)?.[1]);
  const streams:string[]=[];
  for(const match of text.matchAll(/<< \/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)) {
    const start=match.index!+match[0].length,length=Number(match[1]);
    streams.push(inflateSync(buffer.subarray(start,start+length)).toString("latin1"));
  }
  return {pages,content:streams.join("\n")};
}
