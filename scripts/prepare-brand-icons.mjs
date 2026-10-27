import sharp from "sharp";
import {readFile, writeFile, copyFile, mkdir} from "node:fs/promises";
const source = "public/images/brand/logo-transparent.png";
const vault = "docs/obsidian/assets/branding-2026-10-02";
await mkdir(vault, {recursive:true});
const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha) throw new Error("El logo debe tener canal alfa antes de crear los iconos");
await copyFile(source, vault + "/logo-transparent.png");
for (const size of [16,32,192,512]) {
  await sharp(source).resize(size,size,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png()
    .toFile(`public/images/brand/icon-${size}.png`);
  await copyFile(`public/images/brand/icon-${size}.png`, `${vault}/icon-${size}.png`);
}
// ICO directory containing PNG representations preserves the source alpha channel.
const sizes=[16,32,48];
const images=await Promise.all(sizes.map(size=>sharp(source).resize(size,size,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()));
const header=Buffer.alloc(6+sizes.length*16);
header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
images.forEach((bytes,index)=>{
  const entry=6+index*16;
  header[entry]=sizes[index];header[entry+1]=sizes[index];
  header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);
  header.writeUInt32LE(bytes.length,entry+8);header.writeUInt32LE(offset,entry+12);
  offset+=bytes.length;
});
await writeFile("public/favicon.ico",Buffer.concat([header,...images]));
await copyFile("public/favicon.ico", vault + "/favicon.ico");
console.log("Favicon ICO 16/32/48 y PNG 16/32/192/512 creados desde el mismo logo con transparencia");
