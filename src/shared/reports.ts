import {z} from "zod";
import {dashboardWindow,colombiaDay,type DashboardDays} from "./analytics";

const DAY=86400000;
export const REPORT_MAX_DAYS=366;
const isoDay=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Usa fechas con formato AAAA-MM-DD.")
  .refine(value=>!Number.isNaN(Date.parse(value+"T00:00:00Z")) && new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value,"La fecha no existe en el calendario.");

// Dos modos: el período móvil del panel (coincide con sus tarjetas) o días calendario de Colombia.
export const salesReportQuerySchema=z.object({
  days:z.enum(["7","30","90"]).optional(),
  from:isoDay.optional(),
  to:isoDay.optional(),
  contact:z.enum(["true","false"]).default("false"),
}).strict().superRefine((query,ctx)=>{
  const custom=query.from!==undefined || query.to!==undefined;
  if(query.days && custom) ctx.addIssue({code:"custom",path:["days"],message:"Elige el período del panel o un rango de fechas, no ambos."});
  if(custom && (!query.from || !query.to)) ctx.addIssue({code:"custom",path:[query.from?"to":"from"],message:"Indica la fecha inicial y la final."});
  if(query.from && query.to) {
    const span=(Date.parse(query.to)-Date.parse(query.from))/DAY+1;
    if(span<1) ctx.addIssue({code:"custom",path:["to"],message:"La fecha final debe ser igual o posterior a la inicial."});
    if(span>REPORT_MAX_DAYS) ctx.addIssue({code:"custom",path:["to"],message:`El rango máximo es de ${REPORT_MAX_DAYS} días.`});
  }
});
export type SalesReportQuery=z.infer<typeof salesReportQuerySchema>;
export type ReportWindow={mode:"rolling"|"calendar";start:Date;end:Date;fromDay:string;toDay:string;days:number;label:string};

/** Convierte la consulta en un intervalo [start, end) con límites UTC equivalentes a la medianoche de Colombia. */
export function reportWindow(query:SalesReportQuery,now=new Date()):ReportWindow {
  if(query.from && query.to) {
    const start=new Date(query.from+"T05:00:00Z"),end=new Date(Date.parse(query.to+"T05:00:00Z")+DAY);
    const days=Math.round((end.getTime()-start.getTime())/DAY);
    return {mode:"calendar",start,end,fromDay:query.from,toDay:query.to,days,label:`${query.from} a ${query.to} (días completos)`};
  }
  const days=Number(query.days??"30") as DashboardDays;
  const {start,end}=dashboardWindow(days,now);
  return {mode:"rolling",start,end,fromDay:colombiaDay(start),toDay:colombiaDay(new Date(end.getTime()-1)),days,
    label:`Últimos ${days} días (mismo período del panel)`};
}
/** Días calendario de Colombia cubiertos por el intervalo, incluidos los parciales. */
export function reportDays(window:Pick<ReportWindow,"start"|"end">) {
  const first=Date.parse(colombiaDay(window.start)+"T00:00:00Z"),last=Date.parse(colombiaDay(new Date(window.end.getTime()-1))+"T00:00:00Z");
  const days:string[]=[];
  for(let time=first;time<=last;time+=DAY) days.push(new Date(time).toISOString().slice(0,10));
  return days;
}
export function reportFileName(window:Pick<ReportWindow,"fromDay"|"toDay">) {
  return `planetababys-ventas-${window.fromDay}_a_${window.toDay}.xlsx`;
}
