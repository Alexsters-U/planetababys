import {deflateSync} from "node:zlib";

// Generador PDF mínimo y sin dependencias: A4, Helvetica estándar con WinAnsiEncoding (cubre tildes, ñ, ¿ y ¡),
// texto, líneas, rectángulos y tablas con paginación. Las fuentes estándar no se incrustan.

const HELVETICA="278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500".split(",").map(Number);
const HELVETICA_BOLD="278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556".split(",").map(Number);
// Caracteres Unicode fuera de Latin-1 que WinAnsi sí representa.
const WIN_ANSI_EXTRA:Record<string,number>={"€":0x80,"‚":0x82,"„":0x84,"…":0x85,"‘":0x91,"’":0x92,"“":0x93,"”":0x94,"•":0x95,"–":0x96,"—":0x97,"™":0x99,"−":0x2D};

export type Rgb=[number,number,number];
export const BRAND={primary:[0x70,0x50,0x8F] as Rgb,dark:[0x54,0x36,0x6F] as Rgb,ink:[0x38,0x2C,0x46] as Rgb,muted:[0x71,0x64,0x79] as Rgb,
  line:[0xE8,0xDE,0xEE] as Rgb,lilac:[0xF1,0xEA,0xF8] as Rgb,mint:[0xEA,0xF5,0xEE] as Rgb,rose:[0xFB,0xEB,0xF1] as Rgb,danger:[0xB4,0x23,0x4B] as Rgb,white:[1,1,1].map(v=>v*255) as Rgb};

export function winAnsi(text:string):number[] {
  const bytes:number[]=[];
  for(const char of text.normalize("NFC")) {
    const code=char.codePointAt(0)!;
    if(code===9||code===10||code===13) bytes.push(32);
    else if((code>=32&&code<=126)||(code>=160&&code<=255)) bytes.push(code);
    else if(WIN_ANSI_EXTRA[char]!==undefined) bytes.push(WIN_ANSI_EXTRA[char]);
    else if(code>=32) bytes.push(63); // «?» para lo que la fuente estándar no puede dibujar (emojis, otros alfabetos).
  }
  return bytes;
}
function literal(bytes:number[]) {
  // Cadena literal PDF con escapes; los bytes altos van en octal para no depender de la codificación del archivo.
  return "("+bytes.map(b=>b===40||b===41||b===92?"\\"+String.fromCharCode(b):b<32||b>126?"\\"+b.toString(8).padStart(3,"0"):String.fromCharCode(b)).join("")+")";
}
export function textWidth(text:string,size:number,bold=false) {
  const table=bold?HELVETICA_BOLD:HELVETICA;
  return winAnsi(text).reduce((sum,b)=>sum+(b>=32?table[b-32]:0),0)*size/1000;
}
export function fit(text:string,maxWidth:number,size:number,bold=false) {
  if(textWidth(text,size,bold)<=maxWidth) return text;
  let result=text;
  while(result.length>1 && textWidth(result+"…",size,bold)>maxWidth) result=result.slice(0,-1);
  return result.trimEnd()+"…";
}
export function wrap(text:string,maxWidth:number,size:number,bold=false) {
  const lines:string[]=[];
  for(const paragraph of text.split(/\n/)) {
    let line="";
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate=line?line+" "+word:word;
      if(textWidth(candidate,size,bold)<=maxWidth) line=candidate;
      else {if(line)lines.push(line);line=textWidth(word,size,bold)>maxWidth?fit(word,maxWidth,size,bold):word;}
    }
    lines.push(line);
  }
  return lines;
}
const n=(value:number)=>Number(value.toFixed(2)).toString();
const color=(rgb:Rgb,stroke=false)=>`${rgb.map(v=>n(v/255)).join(" ")} ${stroke?"RG":"rg"}`;

/** Imagen rasterizada: RGB de 8 bits y canal alfa opcional, del mismo tamaño. */
export type RasterImage={width:number;height:number;rgb:Buffer;alpha?:Buffer};
export type TextOptions={size?:number;bold?:boolean;color?:Rgb;align?:"left"|"right"|"center";width?:number};
export type TableColumn={header:string;width:number;align?:"left"|"right"};

export class PdfDocument {
  readonly width=595.28;readonly height=841.89;readonly margin=40;
  private pages:string[][]=[];
  private images=new Map<string,RasterImage>();
  private ops:string[]=[];
  y=0;
  constructor(private meta:{title:string;footer:string;created:Date}) {this.addPage();}
  /** Dibuja una imagen registrada; la misma imagen se guarda una sola vez aunque aparezca en varias páginas. */
  image(name:string,image:RasterImage,x:number,y:number,width:number,height:number) {
    if(!/^[A-Za-z0-9]+$/.test(name)) throw new Error("Nombre de imagen inválido");
    this.images.set(name,image);
    this.ops.push(`q ${n(width)} 0 0 ${n(height)} ${n(x)} ${n(y)} cm /${name} Do Q`);
  }
  get contentWidth(){return this.width-this.margin*2;}
  addPage() {
    this.ops=[];this.pages.push(this.ops);this.y=this.height-this.margin;
  }
  /** Garantiza espacio vertical; si no cabe, abre una página nueva. */
  ensure(height:number) {if(this.y-height<this.margin+24){this.addPage();return true;}return false;}
  text(x:number,y:number,value:string,options:TextOptions={}) {
    const size=options.size??10,bold=options.bold??false;
    const content=options.width?fit(value,options.width,size,bold):value;
    const w=textWidth(content,size,bold);
    const left=options.align==="right"?x+(options.width??0)-w:options.align==="center"?x+((options.width??0)-w)/2:x;
    this.ops.push(`BT ${color(options.color??BRAND.ink)} /${bold?"F2":"F1"} ${n(size)} Tf ${n(left)} ${n(y)} Td ${literal(winAnsi(content))} Tj ET`);
  }
  rect(x:number,y:number,w:number,h:number,fill:Rgb,stroke?:Rgb) {
    this.ops.push(`${color(fill)}${stroke?" "+color(stroke,true)+" 0.6 w":""} ${n(x)} ${n(y)} ${n(w)} ${n(h)} re ${stroke?"B":"f"}`);
  }
  line(x1:number,y1:number,x2:number,y2:number,stroke:Rgb=BRAND.line,width=0.6) {
    this.ops.push(`${color(stroke,true)} ${n(width)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`);
  }
  /** Párrafo con salto de línea automático; avanza el cursor. */
  paragraph(value:string,options:TextOptions&{lineHeight?:number}={}) {
    const size=options.size??9,lineHeight=options.lineHeight??size*1.4;
    for(const row of wrap(value,options.width??this.contentWidth,size,options.bold)) {
      this.ensure(lineHeight);this.text(this.margin,this.y-size,row,{...options,width:undefined});this.y-=lineHeight;
    }
  }
  heading(value:string) {
    this.ensure(48);this.y-=10;
    this.text(this.margin,this.y-13,value,{size:13,bold:true,color:BRAND.dark});
    this.y-=20;this.line(this.margin,this.y,this.width-this.margin,this.y,BRAND.line,1);this.y-=8;
  }
  /** Tabla con cabecera repetida en cada página, filas alternas y fila de total opcional. */
  table(columns:TableColumn[],rows:string[][],options:{total?:string[];size?:number}={}) {
    const size=options.size??8,rowHeight=size+7,total=columns.reduce((sum,c)=>sum+c.width,0),scale=this.contentWidth/total;
    const widths=columns.map(c=>c.width*scale);
    const header=()=>{
      this.rect(this.margin,this.y-rowHeight,this.contentWidth,rowHeight,BRAND.lilac);
      let x=this.margin;
      columns.forEach((c,i)=>{this.text(x+4,this.y-rowHeight+5,c.header,{size,bold:true,color:BRAND.dark,width:widths[i]-8,align:c.align});x+=widths[i];});
      this.y-=rowHeight;
    };
    this.ensure(rowHeight*3);header();
    const draw=(values:string[],bold:boolean,index:number)=>{
      if(this.ensure(rowHeight)) header();
      if(index%2===1) this.rect(this.margin,this.y-rowHeight,this.contentWidth,rowHeight,[0xFA,0xF7,0xFC]);
      let x=this.margin;
      values.forEach((value,i)=>{this.text(x+4,this.y-rowHeight+5,value,{size,bold,width:widths[i]-8,align:columns[i].align});x+=widths[i];});
      this.y-=rowHeight;
    };
    rows.forEach((row,i)=>draw(row,false,i));
    if(options.total){if(this.ensure(rowHeight+2))header();this.line(this.margin,this.y,this.width-this.margin,this.y,BRAND.primary,0.8);draw(options.total,true,0);}
    this.y-=6;
  }
  toBuffer():Buffer {
    const total=this.pages.length;
    // Pie con numeración: se agrega al cerrar, cuando ya se conoce el total de páginas.
    this.pages.forEach((ops,i)=>{
      ops.push(`${color(BRAND.line,true)} 0.6 w ${n(this.margin)} 30 m ${n(this.width-this.margin)} 30 l S`);
      const footer=fit(this.meta.footer,this.contentWidth-80,7);
      ops.push(`BT ${color(BRAND.muted)} /F1 7 Tf ${n(this.margin)} 18 Td ${literal(winAnsi(footer))} Tj ET`);
      const label=`Página ${i+1} de ${total}`;
      ops.push(`BT ${color(BRAND.muted)} /F1 7 Tf ${n(this.width-this.margin-textWidth(label,7))} 18 Td ${literal(winAnsi(label))} Tj ET`);
    });
    const objects:(string|Buffer)[]=[];
    const add=(body:string|Buffer)=>{objects.push(body);return objects.length;};
    const catalog=add(""),pagesRef=add("");
    const f1=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const xobjects:string[]=[];
    for(const [name,image] of this.images) {
      const stream=(body:Buffer,extra:string)=>{const packed=deflateSync(body);
        return add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /BitsPerComponent 8 ${extra} /Length ${packed.length} /Filter /FlateDecode >>\nstream\n`),packed,Buffer.from("\nendstream")]));};
      const mask=image.alpha?stream(image.alpha,"/ColorSpace /DeviceGray"):0;
      xobjects.push(`/${name} ${stream(image.rgb,`/ColorSpace /DeviceRGB${mask?` /SMask ${mask} 0 R`:""}`)} 0 R`);
    }
    const resources=`<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xobjects.length?` /XObject << ${xobjects.join(" ")} >>`:""} >>`;
    const kids:number[]=[];
    for(const ops of this.pages) {
      const stream=deflateSync(Buffer.from(ops.join("\n"),"latin1"));
      const content=add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`),stream,Buffer.from("\nendstream")]));
      kids.push(add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] /Resources ${resources} /Contents ${content} 0 R >>`));
    }
    objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
    objects[pagesRef-1]=`<< /Type /Pages /Kids [${kids.map(k=>`${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
    const d=new Date(this.meta.created.getTime()-5*3600000).toISOString();
    const date=`D:${d.slice(0,4)}${d.slice(5,7)}${d.slice(8,10)}${d.slice(11,13)}${d.slice(14,16)}${d.slice(17,19)}-05'00'`;
    const info=add(`<< /Title ${literal(winAnsi(this.meta.title))} /Producer (Planeta Baby's) /CreationDate (${date}) >>`);
    const chunks:Buffer[]=[Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n","latin1")];
    let offset=chunks[0].length;const offsets:number[]=[];
    objects.forEach((body,i)=>{
      const part=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),typeof body==="string"?Buffer.from(body,"latin1"):body,Buffer.from("\nendobj\n")]);
      offsets.push(offset);offset+=part.length;chunks.push(part);
    });
    const xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,"0")+" 00000 n \n").join("")}`;
    chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
    return Buffer.concat(chunks);
  }
}
