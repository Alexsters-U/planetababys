import {deflateRawSync} from "node:zlib";

// Escritor XLSX mínimo y sin dependencias: produce Office Open XML (SpreadsheetML) dentro de un ZIP.
// Los textos se guardan como cadenas en línea, así que un valor como "=HYPERLINK(...)" nunca se evalúa como fórmula.

export type ColumnType="text"|"wrap"|"money"|"integer"|"datetime"|"date"|"percent"|"boolean";
export type Column={header:string;width:number;type?:ColumnType;total?:boolean};
export type CellValue=string|number|boolean|Date|null|undefined;
export type TableSheet={kind:"table";name:string;columns:Column[];rows:CellValue[][];totalLabel?:string};
export type SummaryRow={label:string;value?:CellValue;type?:ColumnType;note?:string;style?:"title"|"section"|"normal"|"muted"};
export type SummarySheet={kind:"summary";name:string;rows:SummaryRow[]};
export type Sheet=TableSheet|SummarySheet;

// Índices de cellXfs en styles.xml.
const STYLE={default:0,header:1,money:2,datetime:3,date:4,integer:5,wrap:6,bold:7,moneyBold:8,integerBold:9,title:10,percent:11,muted:12,section:13} as const;
const COLUMN_STYLE:Record<ColumnType,number>={text:STYLE.default,wrap:STYLE.wrap,money:STYLE.money,integer:STYLE.integer,datetime:STYLE.datetime,date:STYLE.date,percent:STYLE.percent,boolean:STYLE.default};
const MAX_TEXT=32767;
const BOGOTA_OFFSET_MS=5*3600000; // Colombia no aplica horario de verano.

export function columnName(index:number) {
  let name="",n=index+1;
  while(n>0){const rest=(n-1)%26;name=String.fromCharCode(65+rest)+name;n=Math.floor((n-1)/26);}
  return name;
}
export function escapeXml(value:string) {
  // Quita caracteres que XML 1.0 no admite y sustitutos sueltos antes de escapar.
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g,"")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
/** Número de serie de Excel con la hora civil de Colombia, para que la celda muestre la hora local. */
export function excelSerial(date:Date) {
  return (date.getTime()-BOGOTA_OFFSET_MS)/86400000+25569;
}
export function safeSheetName(name:string) {
  const clean=name.replace(/[\[\]:*?/\\]/g," ").trim().slice(0,31);
  return clean || "Hoja";
}

function cell(ref:string,value:CellValue,style:number):string {
  if(value===null || value===undefined || value==="") return style?`<c r="${ref}" s="${style}"/>`:"";
  if(value instanceof Date) {
    if(Number.isNaN(value.getTime())) return "";
    return `<c r="${ref}" s="${style}"><v>${excelSerial(value)}</v></c>`;
  }
  if(typeof value==="number") {
    if(!Number.isFinite(value)) return "";
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  if(typeof value==="boolean") return cell(ref,value?"Sí":"No",style);
  const text=value.length>MAX_TEXT?value.slice(0,MAX_TEXT):value;
  const preserve=/^\s|\s$|\n/.test(text)?' xml:space="preserve"':"";
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t${preserve}>${escapeXml(text)}</t></is></c>`;
}
function row(index:number,cells:string[],height?:number) {
  return `<row r="${index}"${height?` ht="${height}" customHeight="1"`:""}>${cells.join("")}</row>`;
}
function cols(widths:number[]) {
  return `<cols>${widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join("")}</cols>`;
}
function sheetXml(parts:{dimension:string;frozen:boolean;tabSelected:boolean;widths:number[];rows:string[];autoFilter?:string}) {
  const view=parts.frozen
    ?`<sheetView workbookViewId="0"${parts.tabSelected?' tabSelected="1"':""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>`
    :`<sheetView workbookViewId="0"${parts.tabSelected?' tabSelected="1"':""}/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    +`<dimension ref="${parts.dimension}"/><sheetViews>${view}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols(parts.widths)}`
    +`<sheetData>${parts.rows.join("")}</sheetData>${parts.autoFilter?`<autoFilter ref="${parts.autoFilter}"/>`:""}`
    +`<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>`;
}

function tableSheet(sheet:TableSheet,tabSelected:boolean) {
  const last=columnName(Math.max(sheet.columns.length-1,0));
  const rows=[row(1,sheet.columns.map((column,i)=>cell(`${columnName(i)}1`,column.header,STYLE.header)),30)];
  sheet.rows.forEach((values,r)=>{
    rows.push(row(r+2,sheet.columns.map((column,i)=>cell(`${columnName(i)}${r+2}`,values[i],COLUMN_STYLE[column.type??"text"]))));
  });
  const lastData=sheet.rows.length+1;
  let lastRow=lastData;
  if(sheet.columns.some(column=>column.total)) {
    // Fila de totales separada del rango filtrable; SUBTOTAL respeta los filtros aplicados.
    lastRow=lastData+2;
    rows.push(row(lastRow,sheet.columns.map((column,i)=>{
      const ref=`${columnName(i)}${lastRow}`;
      if(i===0) return cell(ref,sheet.totalLabel??"Total (filas visibles)",STYLE.bold);
      if(!column.total) return "";
      const sum=sheet.rows.reduce((acc,values)=>acc+(typeof values[i]==="number"?values[i] as number:0),0);
      const range=`${columnName(i)}2:${columnName(i)}${Math.max(lastData,2)}`;
      return `<c r="${ref}" s="${column.type==="money"?STYLE.moneyBold:STYLE.integerBold}"><f>SUBTOTAL(109,${range})</f><v>${Math.round(sum*100)/100}</v></c>`;
    })));
  }
  return {xml:sheetXml({dimension:`A1:${last}${lastRow}`,frozen:true,tabSelected,widths:sheet.columns.map(column=>column.width),rows,autoFilter:`A1:${last}${lastData}`}),
    filter:`$A$1:$${last}$${lastData}`};
}
function summarySheet(sheet:SummarySheet,tabSelected:boolean) {
  const rows=sheet.rows.map((item,r)=>{
    const index=r+1;
    const labelStyle=item.style==="title"?STYLE.title:item.style==="section"?STYLE.section:item.style==="muted"?STYLE.muted:STYLE.default;
    const valueStyle=item.type?COLUMN_STYLE[item.type]:STYLE.default;
    return row(index,[cell(`A${index}`,item.label,labelStyle),cell(`B${index}`,item.value,valueStyle),cell(`C${index}`,item.note,STYLE.muted)],item.style==="title"?24:undefined);
  });
  return {xml:sheetXml({dimension:`A1:C${Math.max(sheet.rows.length,1)}`,frozen:false,tabSelected,widths:[46,34,96],rows}),filter:null};
}

const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$ &quot;#,##0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="166" formatCode="yyyy-mm-dd"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><color rgb="FF70508F"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="10"/><color rgb="FF716479"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF54366F"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1EAF8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFB7A0D2"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function buildWorkbook(sheets:Sheet[],meta:{title:string;creator:string;created:Date}):Buffer {
  if(!sheets.length) throw new Error("El libro necesita al menos una hoja");
  const names=new Set<string>();
  const prepared=sheets.map((sheet,i)=>{
    let name=safeSheetName(sheet.name);
    for(let n=2;names.has(name.toLowerCase());n++) name=`${safeSheetName(sheet.name).slice(0,28)} ${n}`;
    names.add(name.toLowerCase());
    const built=sheet.kind==="table"?tableSheet(sheet,i===0):summarySheet(sheet,i===0);
    return {name,...built};
  });
  const quoted=(name:string)=>`'${name.replace(/'/g,"''")}'`;
  const definedNames=prepared.map((sheet,i)=>sheet.filter?`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${escapeXml(quoted(sheet.name))}!${sheet.filter}</definedName>`:"").join("");
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    +`<bookViews><workbookView activeTab="0"/></bookViews><sheets>${prepared.map((sheet,i)=>`<sheet name="${escapeXml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets>`
    +`${definedNames?`<definedNames>${definedNames}</definedNames>`:""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    +prepared.map((_sheet,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")
    +`<Relationship Id="rId${prepared.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    +`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
    +`<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    +prepared.map((_sheet,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
    +`<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
    +`<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    +`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
    +`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const iso=meta.created.toISOString().replace(/\.\d{3}Z$/,"Z");
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
    +`<dc:title>${escapeXml(meta.title)}</dc:title><dc:creator>${escapeXml(meta.creator)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created></cp:coreProperties>`;
  return zip([
    ["[Content_Types].xml",contentTypes],["_rels/.rels",rootRels],["docProps/core.xml",core],
    ["xl/workbook.xml",workbook],["xl/_rels/workbook.xml.rels",workbookRels],["xl/styles.xml",STYLES],
    ...prepared.map((sheet,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheet.xml] as [string,string]),
  ],meta.created);
}

// --- ZIP (método deflate, sin ZIP64: el reporte limita filas muy por debajo de 4 GiB) ---
const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
export function crc32(data:Buffer) {
  let crc=0xFFFFFFFF;
  for(const byte of data) crc=CRC_TABLE[(crc^byte)&0xFF]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}
function dosDateTime(date:Date) {
  const local=new Date(date.getTime()-BOGOTA_OFFSET_MS);
  const year=Math.max(local.getUTCFullYear(),1980);
  return {time:(local.getUTCHours()<<11)|(local.getUTCMinutes()<<5)|Math.floor(local.getUTCSeconds()/2),
    date:((year-1980)<<9)|((local.getUTCMonth()+1)<<5)|local.getUTCDate()};
}
export function zip(entries:[string,string][],modified:Date):Buffer {
  const {time,date}=dosDateTime(modified);
  const locals:Buffer[]=[],central:Buffer[]=[];
  let offset=0;
  for(const [name,content] of entries) {
    const nameBytes=Buffer.from(name,"utf8"),raw=Buffer.from(content,"utf8"),packed=deflateRawSync(raw,{level:6}),crc=crc32(raw);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x0800,6);header.writeUInt16LE(8,8);
    header.writeUInt16LE(time,10);header.writeUInt16LE(date,12);header.writeUInt32LE(crc,14);
    header.writeUInt32LE(packed.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(nameBytes.length,26);header.writeUInt16LE(0,28);
    locals.push(header,nameBytes,packed);
    const entry=Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x0800,8);entry.writeUInt16LE(8,10);
    entry.writeUInt16LE(time,12);entry.writeUInt16LE(date,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(packed.length,20);
    entry.writeUInt32LE(raw.length,24);entry.writeUInt16LE(nameBytes.length,28);entry.writeUInt32LE(offset,42);
    central.push(entry,nameBytes);
    offset+=header.length+nameBytes.length+packed.length;
  }
  const directory=Buffer.concat(central);
  if(offset>0xFFFFFFFF || directory.length>0xFFFFFFFF) throw new Error("Archivo demasiado grande para ZIP sin ZIP64");
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
