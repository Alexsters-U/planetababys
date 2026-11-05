import {inflateRawSync} from "node:zlib";
import {crc32} from "../../backend/src/xlsx";

/** Lector mínimo para pruebas: valida el directorio central y el CRC de cada entrada del ZIP. */
export function readZip(buffer:Buffer) {
  const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(end<0) throw new Error("Sin registro final de ZIP");
  const count=buffer.readUInt16LE(end+10),size=buffer.readUInt32LE(end+12),offset=buffer.readUInt32LE(end+16);
  if(offset+size!==end) throw new Error("Directorio central desalineado");
  const files=new Map<string,string>();
  let cursor=offset;
  for(let i=0;i<count;i++) {
    if(buffer.readUInt32LE(cursor)!==0x02014b50) throw new Error("Entrada central inválida");
    const crc=buffer.readUInt32LE(cursor+16),packed=buffer.readUInt32LE(cursor+20),raw=buffer.readUInt32LE(cursor+24);
    const nameLength=buffer.readUInt16LE(cursor+28),extra=buffer.readUInt16LE(cursor+30),comment=buffer.readUInt16LE(cursor+32),local=buffer.readUInt32LE(cursor+42);
    const name=buffer.subarray(cursor+46,cursor+46+nameLength).toString("utf8");
    if(buffer.readUInt32LE(local)!==0x04034b50) throw new Error("Cabecera local inválida: "+name);
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
    const content=inflateRawSync(buffer.subarray(start,start+packed));
    if(content.length!==raw || crc32(content)!==crc) throw new Error("CRC o tamaño incorrecto: "+name);
    files.set(name,content.toString("utf8"));
    cursor+=46+nameLength+extra+comment;
  }
  return files;
}
/** Devuelve las hojas como texto XML indexadas por nombre visible. */
export function readSheets(buffer:Buffer) {
  const files=readZip(buffer),workbook=files.get("xl/workbook.xml")??"";
  const sheets=new Map<string,string>();
  for(const match of workbook.matchAll(/<sheet name="([^"]+)" sheetId="(\d+)"/g)) sheets.set(match[1].replace(/&amp;/g,"&"),files.get(`xl/worksheets/sheet${match[2]}.xml`)??"");
  return {files,sheets};
}
/** Textos en línea de una fila concreta. */
export function rowTexts(xml:string,row:number) {
  const found=new RegExp(`<row r="${row}"[^>]*>(.*?)</row>`).exec(xml)?.[1]??"";
  return [...found.matchAll(/<t[^>]*>(.*?)<\/t>/g)].map(match=>match[1]);
}
export function rowCount(xml:string) {return [...xml.matchAll(/<row r="/g)].length;}
