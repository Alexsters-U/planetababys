"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {toast} from "sonner";
import AdminListControls from "@/shared/ui/admin-list-controls";
import Pagination from "@/shared/ui/pagination";
import useAdminFilters from "@/shared/ui/use-admin-filters";
import RestrictedInput from "@/shared/forms/restricted-input";
import {spanishValidation} from "@/shared/forms/spanish-validation";
import {PRICE_PATTERN,PRICE_MESSAGE} from "@/shared/validation";
import {contactWhatsApp} from "@/shared/store-profile";
import type {ShippingQuoteView} from "@/shared/shipping-quote";
import {formatCOP,formatDate} from "@/lib/money";
const defaults={q:"",status:"REQUESTED",pageSize:"25"};
const statusLabels={REQUESTED:"Por cotizar",QUOTED:"Confirmada",CONSUMED:"Pedido creado",DECLINED:"No disponible"};
function OfferForm({quote,onSaved}:{quote:ShippingQuoteView;onSaved:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const form=new FormData(event.currentTarget),[pesos,fraction=""]=String(form.get("price")).split(/[.,]/);
    const shippingCents=Number(pesos)*100+Number(fraction.padEnd(2,"0"));
    try {
      const response=await fetch(`/api/admin/shipping-quotes/${quote.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({shippingCents,deliveryEstimate:String(form.get("estimate"))})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      toast.success("Envío confirmado. Comparte el enlace de pago con el cliente.");window.dispatchEvent(new Event("pbb:shipping-changed"));onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Error de conexión.");}finally{setBusy(false);}
  }
  async function decline(){
    setBusy(true);setError("");
    try {const response=await fetch(`/api/admin/shipping-quotes/${quote.id}/decline`,{method:"POST"});if(!response.ok)throw new Error((await response.json()).error);toast.success("Solicitud marcada sin entrega disponible");window.dispatchEvent(new Event("pbb:shipping-changed"));onSaved();}
    catch(e){setError(e instanceof Error?e.message:"Error de conexión.");}finally{setBusy(false);}
  }
  return <form {...spanishValidation} onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-brand-cream p-4"><p className="text-sm">Acuerda el servicio por WhatsApp e ingresa la tarifa del domiciliario (Mocoa) o de la transportadora (fuera del municipio). Al confirmar, el importe queda fijado para este carrito y dirección.</p><div className="grid gap-3 sm:grid-cols-2"><label className="label">Costo del envío (COP) *<RestrictedInput name="price" restriction="decimal" required maxLength={10} pattern={PRICE_PATTERN} inputMode="decimal" data-format-message={PRICE_MESSAGE} className="input mt-1" placeholder="Ej. 5000" data-testid="quote-cost"/></label><label className="label">Plazo de entrega acordado *<input name="estimate" required minLength={3} maxLength={120} className="input mt-1" placeholder="Ej. 1 a 2 días hábiles" data-testid="quote-estimate"/></label></div><p className="text-xs text-brand-muted">Puedes indicar 0 únicamente si acordaste expresamente envío gratuito. Vigencia: 24 horas desde la confirmación.</p>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex flex-wrap gap-3"><button className="btn-primary disabled:opacity-50" disabled={busy} type="submit" data-testid="quote-confirm">{busy?"Guardando…":"Confirmar costo y entrega"}</button><button type="button" className="btn-outline disabled:opacity-50" disabled={busy} onClick={()=>void decline()}>Sin entrega disponible</button></div></form>;
}
export default function AdminQuotations() {
  const [quotes,setQuotes]=useState<ShippingQuoteView[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [page,setPage]=useState(1),[pages,setPages]=useState(1),[total,setTotal]=useState(0);
  const [filters,setFilters]=useAdminFilters(defaults,{status:["","REQUESTED","QUOTED","CONSUMED","DECLINED"],pageSize:["10","25","50","100"]});
  const sequence=useRef(0);
  const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!=="")).toString();
  const load=useCallback(async()=>{
    const current=++sequence.current;setLoading(true);setError("");
    try {
      const response=await fetch(`/api/admin/shipping-quotes?${query}&page=${page}`);
      if(response.status===401){window.location.assign("/admin/login");return;}
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      if(current!==sequence.current)return;
      setQuotes(data.quotes);setTotal(data.total);setPages(data.pages);setPage(data.page);
    }catch(e){if(current===sequence.current)setError(e instanceof Error?e.message:"Error de conexión.");}
    finally{if(current===sequence.current)setLoading(false);}
  },[page,query]);
  useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
  useEffect(()=>{
    const showPending=()=>{setFilters(defaults);setPage(1);if(page===1&&query==="status=REQUESTED&pageSize=25")void load();};
    window.addEventListener("pbb:shipping-open",showPending);
    return()=>window.removeEventListener("pbb:shipping-open",showPending);
  },[load,page,query,setFilters]);
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="section-title">Cotizaciones de envío</h1><button type="button" className="btn-outline" onClick={()=>void load()}>Actualizar</button></div><p className="mt-3 text-brand-muted">1. Busca la referencia recibida por WhatsApp. 2. Confirma costo y plazo. 3. Comparte el enlace para que el cliente revise el total y pague.</p>
    <AdminListControls values={filters} filters={[{key:"status",label:"Estado",options:[{value:"",label:"Todos"},...Object.entries(statusLabels).map(([value,label])=>({value,label}))]}]} searchLabel="Referencia de cotización" onChange={(key,value)=>{setFilters(current=>({...current,[key]:value}));setPage(1);}} onReset={()=>{setFilters(defaults);setPage(1);}} total={total} page={page} loading={loading}/>
    {error&&<p className="mt-4 text-red-700" role="alert">{error}</p>}
    <div className="mt-6 space-y-5">{loading?<p>Cargando cotizaciones…</p>:quotes.length===0?<p className="card p-8 text-center text-brand-muted">No hay solicitudes para estos filtros.</p>:quotes.map(quote=><article className="card p-5" key={quote.id} data-testid="admin-quote"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">{quote.reference} · {quote.request.customer.name}</h2><span className="badge bg-brand-lilac">{quote.expired?"Vencida":statusLabels[quote.status]}</span></div><p className="mt-3 text-sm">{quote.request.customer.address}, {quote.request.customer.city}</p>{quote.request.customer.notes&&<p className="mt-1 text-sm text-brand-muted">Notas: {quote.request.customer.notes}</p>}<p className="mt-1 text-sm">Celular: {quote.request.customer.phone} · Correo: {quote.request.customer.email}</p><p className="mt-1 text-xs text-brand-muted">Creada: {formatDate(quote.createdAt)}</p><ul className="mt-3 space-y-1 text-sm">{quote.lines.map((line,index)=><li key={index}>{line.quantity}× {line.name} · {formatCOP(line.unitCents*line.quantity)}</li>)}</ul><p className="mt-3 font-semibold">Productos: {formatCOP(quote.subtotalCents)} · Envío: {quote.shippingCents===null?"Por cotizar":formatCOP(quote.shippingCents)}{quote.shippingCents!==null&&` · Total: ${formatCOP(quote.subtotalCents+quote.shippingCents)}`}</p>
      {quote.status==="REQUESTED"&&!quote.expired&&<OfferForm quote={quote} onSaved={()=>{setFilters(current=>({...current,q:quote.reference,status:""}));setPage(1);}}/>}
      {quote.status==="QUOTED"&&!quote.expired&&<div className="mt-4 rounded-xl bg-mint-50 p-4"><p className="text-sm">Entrega: {quote.deliveryEstimate}. Vigente hasta {formatDate(quote.expiresAt)}.</p><div className="mt-3 flex flex-wrap gap-3"><a className="btn-primary" href={contactWhatsApp(quote.request.customer.phone,`Hola ${quote.request.customer.name}, tu cotización ${quote.reference} está confirmada. Envío: ${formatCOP(quote.shippingCents!)}. Total: ${formatCOP(quote.subtotalCents+quote.shippingCents!)}. Entrega: ${quote.deliveryEstimate}. Revisa y acepta el total antes de pagar: ${quote.reviewUrl}`)} target="_blank" rel="noopener noreferrer" data-testid="quote-share">Compartir por WhatsApp</a><button type="button" className="btn-outline" onClick={()=>void navigator.clipboard.writeText(quote.reviewUrl!).then(()=>toast.success("Enlace copiado")).catch(()=>toast.error("No pudimos copiar el enlace. Puedes abrirlo y copiarlo desde el navegador."))}>Copiar enlace</button><a className="btn-outline" href={quote.reviewUrl} target="_blank" rel="noopener noreferrer">Ver resumen del cliente</a></div></div>}
      {quote.status==="REQUESTED"&&<a className="mt-4 inline-block text-sm underline" href={contactWhatsApp(quote.request.customer.phone,`Hola, estamos revisando tu cotización ${quote.reference} de Planeta Baby's.`)} target="_blank" rel="noopener noreferrer">Contactar al cliente por WhatsApp</a>}
    </article>)}</div><Pagination page={page} pages={pages} loading={loading} onPage={setPage}/>
  </div>;
}
