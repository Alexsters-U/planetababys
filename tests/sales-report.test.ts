import {test} from "node:test";
import assert from "node:assert/strict";
import {buildWorkbook,columnName,escapeXml,excelSerial,safeSheetName} from "../backend/src/xlsx";
import {reportWindow,reportDays,reportFileName,salesReportQuerySchema} from "../src/shared/reports";
import {dashboardWindow} from "../src/shared/analytics";
import {readSheets,rowTexts} from "./helpers/xlsx-reader";

test("Columnas, fechas de Colombia y nombres de hoja seguros",()=>{
  assert.deepEqual([0,25,26,51,701,702].map(columnName),["A","Z","AA","AZ","ZZ","AAA"]);
  assert.equal(excelSerial(new Date("2024-01-01T05:00:00Z")),45292); // Medianoche en Bogotá.
  assert.equal(excelSerial(new Date("2024-01-01T17:00:00Z")),45292.5);
  assert.equal(safeSheetName("Ventas: [web]/local*?"),"Ventas   web  local");
  assert.equal(safeSheetName("x".repeat(40)).length,31);
});
test("Escapa XML, elimina caracteres de control y nunca convierte texto en fórmula",()=>{
  assert.equal(escapeXml(`<a href="x">&</a>\u0001\u0008`),"&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  const book=buildWorkbook([{kind:"table",name:"Datos",columns:[{header:"Texto",width:10},{header:"Monto",width:10,type:"money",total:true}],
    rows:[['=HYPERLINK("http://x","clic")',1.5],["+cmd|' /C calc'!A0",2],["Ñandú & \"comillas\" <b>",null]]}],{title:"Prueba",creator:"Test",created:new Date("2030-01-01T00:00:00Z")});
  const {files,sheets}=readSheets(book);
  for(const name of ["[Content_Types].xml","_rels/.rels","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","docProps/core.xml","xl/worksheets/sheet1.xml"]) assert.ok(files.has(name),name);
  const sheet=sheets.get("Datos")!;
  assert.equal([...sheet.matchAll(/<f>/g)].length,1,"Solo la fila de total lleva fórmula");
  assert.match(sheet,/<f>SUBTOTAL\(109,B2:B4\)<\/f><v>3.5<\/v>/);
  assert.deepEqual(rowTexts(sheet,2),['=HYPERLINK(&quot;http://x&quot;,&quot;clic&quot;)']);
  assert.deepEqual(rowTexts(sheet,4),["Ñandú &amp; &quot;comillas&quot; &lt;b&gt;"]);
  assert.match(sheet,/<autoFilter ref="A1:B4"\/>/);
  assert.match(files.get("xl/workbook.xml")!,/_xlnm\._FilterDatabase/);
});
test("Consulta: modos exclusivos, fechas reales y rango máximo",()=>{
  const ok=(query:Record<string,string>)=>salesReportQuerySchema.safeParse(query).success;
  assert.ok(ok({}));assert.ok(ok({days:"90",contact:"true"}));assert.ok(ok({from:"2026-01-01",to:"2026-12-31"}));
  assert.ok(ok({from:"2024-01-01",to:"2024-12-31"}),"366 días en año bisiesto");
  for(const bad of [{days:"8"},{days:"7",from:"2026-01-01",to:"2026-01-02"},{from:"2026-01-01"},{from:"2026-02-10",to:"2026-02-01"},
    {from:"2026-02-30",to:"2026-03-01"},{from:"2025-01-01",to:"2026-01-02"},{from:"01/02/2026",to:"2026-02-02"},{contact:"si"},{days:"7",extra:"1"}]) assert.equal(ok(bad as Record<string,string>),false,JSON.stringify(bad));
});
test("Ventanas: calendario con medianoche de Colombia y período móvil idéntico al panel",()=>{
  const calendar=reportWindow({from:"2026-11-01",to:"2026-11-30",contact:"false"});
  assert.equal(calendar.start.toISOString(),"2026-11-01T05:00:00.000Z");assert.equal(calendar.end.toISOString(),"2026-12-01T05:00:00.000Z");
  assert.equal(calendar.days,30);assert.equal(reportDays(calendar).length,30);
  assert.equal(reportFileName(calendar),"planetababys-ventas-2026-11-01_a_2026-11-30.xlsx");
  const now=new Date("2030-03-15T21:00:00Z"),rolling=reportWindow({days:"7",contact:"false"},now),panel=dashboardWindow(7,now);
  assert.equal(rolling.start.getTime(),panel.start.getTime());assert.equal(rolling.end.getTime(),panel.end.getTime());
  assert.equal(reportDays(rolling).length,8,"Incluye el primer y el último día parciales");
});
import {PdfDocument,winAnsi,fit,wrap,textWidth} from "../backend/src/pdf";
import {readPdf} from "./helpers/pdf-reader";

test("PDF: codificación WinAnsi para español y escape de cadenas",()=>{
  assert.deepEqual(winAnsi("ñÑáéíóúü¿¡"),[0xF1,0xD1,0xE1,0xE9,0xED,0xF3,0xFA,0xFC,0xBF,0xA1]);
  assert.deepEqual(winAnsi("€ – “x” …"),[0x80,32,0x96,32,0x93,0x78,0x94,32,0x85]);
  assert.deepEqual(winAnsi("🍼\u0007a"),[63,97],"Emoji como ?, control eliminado");
  const doc=new PdfDocument({title:"Prueba (1)",footer:"pie",created:new Date("2030-01-01T00:00:00Z")});
  doc.text(40,700,"Paréntesis (a) y barra \\ ñandú");
  const {content}=readPdf(doc.toBuffer());
  assert.ok(content.includes("(Par\\351ntesis \\(a\\) y barra \\\\ \\361and\\372) Tj"));
});
test("PDF: medidas de texto, recorte y ajuste de líneas",()=>{
  assert.equal(textWidth("A",10),6.67);assert.equal(textWidth("A",10,true),7.22);
  const cut=fit("Referencia muy larga para una columna estrecha",60,8);
  assert.ok(cut.endsWith("…"));assert.ok(textWidth(cut,8)<=60);
  const lines=wrap("uno dos tres cuatro cinco seis siete ocho nueve diez",60,10);
  assert.ok(lines.length>1);assert.ok(lines.every(line=>textWidth(line,10)<=60));
});
test("PDF: tablas largas paginan, repiten cabecera y numeran páginas",()=>{
  const doc=new PdfDocument({title:"Tabla",footer:"Pie de prueba",created:new Date("2030-01-01T00:00:00Z")});
  doc.table([{header:"Columna A",width:100},{header:"Monto",width:60,align:"right"}],Array.from({length:150},(_v,i)=>[`Fila ${i+1}`,String(i)]),{total:["Total","11175"]});
  const {pages,content}=readPdf(doc.toBuffer());
  assert.ok(pages>=3,`páginas: ${pages}`);
  assert.equal([...content.matchAll(/\(Columna A\) Tj/g)].length,pages,"Cabecera en cada página");
  assert.ok(content.includes(`(P\\341gina ${pages} de ${pages}) Tj`));
  assert.ok(content.includes("(Fila 150) Tj"));assert.ok(content.includes("(11175) Tj"));
});
test("PDF: imagen con transparencia incrustada una sola vez y logo de marca disponible",async()=>{
  const {brandLogo}=await import("../backend/src/brand-logo");
  const logo=await brandLogo();
  assert.ok(logo,"Se encuentra public/images/brand/icon-512.png");
  assert.equal(logo!.rgb.length,logo!.width*logo!.height*3);assert.equal(logo!.alpha!.length,logo!.width*logo!.height);
  const doc=new PdfDocument({title:"Logo",footer:"pie",created:new Date("2030-01-01T00:00:00Z")});
  doc.image("Logo",logo!,40,700,80,80);doc.addPage();doc.image("Logo",logo!,40,700,80,80);
  const buffer=doc.toBuffer(),text=buffer.toString("latin1");
  assert.equal([...text.matchAll(/\/Subtype \/Image/g)].length,2,"Una imagen RGB y su máscara, compartidas por las dos páginas");
  assert.match(text,/\/SMask \d+ 0 R/);
  const {pages,content}=readPdf(buffer);assert.equal(pages,2);assert.equal([...content.matchAll(/\/Logo Do/g)].length,2);
  assert.throws(()=>doc.image("Logo malo",logo!,0,0,1,1));
});
