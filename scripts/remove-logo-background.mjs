/** Direct alpha extraction authorized by the user. Never redraws the source. */
import sharp from "sharp";
import {writeFile} from "node:fs/promises";
const source="public/images/brand/instagram-reference.png";
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(info.width!==150 || info.height!==150) throw new Error("Esta máscara está definida para la referencia original de 150x150");
const visited=new Uint8Array(info.width*info.height);
const eligible=index=>{
  const rgb=[data[index*4],data[index*4+1],data[index*4+2]];
  return Math.min(...rgb)>=235 && Math.max(...rgb)-Math.min(...rgb)<=18;
};
let removed=0;
for(let start=0;start<visited.length;start++) {
  if(visited[start] || !eligible(start)) continue;
  const component=[start];visited[start]=1;
  let xSum=0,ySum=0,border=false;
  for(let position=0;position<component.length;position++) {
    const index=component[position],x=index%info.width,y=Math.floor(index/info.width);
    xSum+=x;ySum+=y;
    if(x===0 || y===0 || x===info.width-1 || y===info.height-1) border=true;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy;
      if(nx<0 || ny<0 || nx>=info.width || ny>=info.height)continue;
      const next=ny*info.width+nx;
      if(!visited[next] && eligible(next)) {visited[next]=1;component.push(next);}
    }
  }
  // Preserve the white outfit and other white highlights inside the original globe.
  const cx=xSum/component.length,cy=ySum/component.length;
  const insideGlobe=((cx-78)/35)**2+((cy-50)/37)**2<=1;
  if(border || !insideGlobe) for(const index of component){data[index*4+3]=0;removed++;}
}
await sharp(data,{raw:info}).png().toFile("public/images/brand/logo-transparent.png");
const {data:original}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let changedRgb=0;
for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)if(data[i+c]!==original[i+c])changedRgb++;
if(changedRgb!==0 || removed===0)throw new Error("El proceso debe modificar únicamente el canal alfa");
await writeFile("docs/obsidian/evidence/branding-2026-10-02/logo-alpha.json",JSON.stringify({source,width:info.width,height:info.height,transparentPixels:removed,totalPixels:info.width*info.height,changedRgbChannels:changedRgb,method:"Near-white connected components; preserve white components inside original globe; RGB unchanged",userAuthorization:"Sí, conservar el logo original",date:"2026-10-02"},null,2));
console.log(`${removed} píxeles de fondo transparentes; cero cambios de RGB; tamaño original 150x150`);
