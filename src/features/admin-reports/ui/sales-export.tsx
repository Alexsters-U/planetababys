"use client";
import {useEffect,useId,useRef,useState} from "react";
import {colombiaDay,type DashboardDays} from "@/shared/analytics";
import {REPORT_MAX_DAYS,salesReportQuerySchema} from "@/shared/reports";
import BrandIcon from "@/shared/ui/brand-icon";

type Feedback={kind:"success"|"error";text:string};
const SUCCESS_MS=6000;

function fileNameFrom(disposition:string|null) {
  const match=/filename="([^"]+)"/.exec(disposition??"");
  return match?.[1]??"planetababys-ventas.xlsx";
}

/** Descarga el reporte de ventas en Excel con el período del panel o con fechas calendario. */
export default function SalesExport({days}:{days:DashboardDays}) {
  const today=colombiaDay(new Date());
  const [mode,setMode]=useState<"panel"|"range">("panel");
  const [from,setFrom]=useState(()=>today.slice(0,8)+"01");
  const [to,setTo]=useState(today);
  const [contact,setContact]=useState(false);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState<Feedback|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const id=useId();
  useEffect(()=>()=>clearTimeout(timer.current),[]);

  function show(next:Feedback) {
    clearTimeout(timer.current);setFeedback(next);
    if(next.kind==="success") timer.current=setTimeout(()=>setFeedback(null),SUCCESS_MS);
  }
  async function download(format:"xlsx"|"pdf") {
    // El PDF se comparte o imprime: nunca lleva datos de contacto.
    const includeContact=format==="xlsx"&&contact;
    const query:Record<string,string>=mode==="panel"?{days:String(days),contact:String(includeContact)}:{from,to,contact:String(includeContact)};
    const checked=salesReportQuerySchema.safeParse(query);
    if(!checked.success){show({kind:"error",text:checked.error.issues[0]?.message??"Revisa las fechas."});return;}
    setBusy(true);setFeedback(null);
    try {
      const response=await fetch(`/api/admin/reports/sales.${format}?`+new URLSearchParams(query),{cache:"no-store"});
      if(response.status===401){window.location.assign("/admin/login?next=/admin");return;}
      if(response.status===429){const wait=Number(response.headers.get("retry-after"))||60;show({kind:"error",text:`Hiciste varias descargas seguidas. Inténtalo en ${wait} segundos.`});return;}
      if(!response.ok){const data=await response.json().catch(()=>null);show({kind:"error",text:data?.error??"No pudimos generar el reporte. Inténtalo de nuevo."});return;}
      const blob=await response.blob(),name=fileNameFrom(response.headers.get("content-disposition"));
      const url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      show({kind:"success",text:`Descargado: ${name}`});
    } catch {show({kind:"error",text:"No pudimos conectar con la tienda. Revisa la conexión y reintenta."});}
    finally {setBusy(false);}
  }

  return <section className="card p-5 sm:p-6" aria-labelledby={`${id}-title`} data-testid="sales-export">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-xl"><h2 id={`${id}-title`} className="font-extrabold">Reporte de ventas en Excel o PDF</h2>
        <p className="mt-1 text-xs leading-5 text-brand-muted">Excel: resumen, cada venta web y del local, detalle por producto y por día, y todos los pedidos y ventas del período con su estado. PDF: resumen imprimible con métricas, ventas por día, productos y libro de ventas, sin datos personales.</p></div>
      <span className="hidden sm:block" aria-hidden="true"><span className="metric-icon bg-brand-lilac"><BrandIcon name="download"/></span></span>
    </div>
    <fieldset className="mt-4" disabled={busy}>
      <legend className="sr-only">Período del reporte</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        <label className={"badge cursor-pointer gap-2 border "+(mode==="panel"?"border-brand-primary bg-brand-lilac text-brand-dark":"border-brand-line bg-white text-brand-muted")}>
          <input type="radio" name={`${id}-mode`} className="accent-brand-primary" checked={mode==="panel"} onChange={()=>setMode("panel")} data-testid="export-mode-panel"/>Período del panel · {days} días</label>
        <label className={"badge cursor-pointer gap-2 border "+(mode==="range"?"border-brand-primary bg-brand-lilac text-brand-dark":"border-brand-line bg-white text-brand-muted")}>
          <input type="radio" name={`${id}-mode`} className="accent-brand-primary" checked={mode==="range"} onChange={()=>setMode("range")} data-testid="export-mode-range"/>Fechas específicas</label>
      </div>
      {mode==="range"&&<div className="mt-3 grid gap-3 sm:max-w-md sm:grid-cols-2">
        <div><label className="label" htmlFor={`${id}-from`}>Desde</label><input id={`${id}-from`} type="date" className="input" value={from} max={to||today} onChange={event=>setFrom(event.target.value)} data-testid="export-from"/></div>
        <div><label className="label" htmlFor={`${id}-to`}>Hasta</label><input id={`${id}-to`} type="date" className="input" value={to} min={from} max={today} onChange={event=>setTo(event.target.value)} data-testid="export-to"/></div>
        <p className="text-xs text-brand-muted sm:col-span-2">Días completos en hora de Colombia, máximo {REPORT_MAX_DAYS} días.</p>
      </div>}
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-brand-primary" checked={contact} onChange={event=>setContact(event.target.checked)} data-testid="export-contact"/>
        <span>Incluir correo, teléfono y dirección de los clientes (solo Excel)<span className="mt-0.5 block text-xs text-brand-muted">Actívalo solo si lo necesitas para despachar o conciliar. El archivo tendrá datos personales protegidos por la Ley 1581.</span></span></label>
    </fieldset>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" className="btn-primary gap-2" onClick={()=>void download("xlsx")} disabled={busy} data-testid="export-download"><BrandIcon name="download" size={18}/>{busy?"Generando…":"Descargar Excel"}</button>
      <button type="button" className="btn-outline gap-2" onClick={()=>void download("pdf")} disabled={busy} data-testid="export-download-pdf"><BrandIcon name="download" size={18}/>Descargar PDF</button>
      <p role="status" aria-live="polite" className={"min-w-0 text-xs font-semibold "+(feedback?.kind==="error"?"text-rose-700":"text-mint-700")} data-testid="export-feedback">
        {feedback&&<span className="inline-flex items-center gap-1"><BrandIcon name={feedback.kind==="error"?"status-rejected":"status-approved"} size={16}/>{feedback.text}</span>}</p>
    </div>
  </section>;
}
