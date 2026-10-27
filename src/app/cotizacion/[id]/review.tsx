"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import type {ShippingQuoteView} from "@/shared/shipping-quote";
import {formatCOP,formatDate} from "@/lib/money";
import {contactWhatsApp,storeProfile} from "@/shared/store-profile";
import {useCartStore} from "@/features/cart/model/store";
export default function QuotationReview({id,token}:{id:string;token:string}) {
  const [quote,setQuote]=useState<ShippingQuoteView|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [paying,setPaying]=useState(false);
  const [accepted,setAccepted]=useState(false);
  const [testMode,setTestMode]=useState(false);
  const [existingOrder,setExistingOrder]=useState<{orderUrl:string;paymentUrl:string|null}|null>(null);
  const requestKey=useRef<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const response=await fetch(`/api/shipping/quotes/${id}?token=${encodeURIComponent(token)}`);
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setQuote(data.quote);setTestMode(data.paymentMode==="test");
      setExistingOrder(data.orderUrl?{orderUrl:data.orderUrl,paymentUrl:data.paymentUrl}:null);
    }catch(e){setError(e instanceof Error?e.message:"No se pudo consultar la cotización.");}
    finally{setLoading(false);}
  },[id,token]);
  useEffect(()=>{void load();},[load]);
  async function pay() {
    if(!quote||!accepted||paying)return;
    setPaying(true);setError("");requestKey.current??=crypto.randomUUID();
    try {
      const response=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":requestKey.current},
        body:JSON.stringify({...quote.request,shippingQuoteToken:token,shippingQuoteAccepted:true})});
      const data=await response.json();
      if(!response.ok||!data.paymentUrl)throw new Error(data.error??"No pudimos iniciar el pago.");
      const cart=useCartStore.getState();
      if(cart.items.length===quote.request.items.length&&cart.items.every(item=>quote.request.items.some(line=>line.productId===item.productId&&line.quantity===item.quantity&&line.expectedUnitCents===item.priceCents)))cart.clear();
      window.location.assign(data.paymentUrl);
    }catch(e){setError((e instanceof Error?e.message:"Error de conexión.")+" Si no se confirmó la respuesta, reintenta aquí para recuperar el mismo pedido.");setPaying(false);}
  }
  const ready=quote?.status==="QUOTED"&&!quote.expired&&quote.shippingCents!==null;
  return <div className="container-page max-w-3xl py-12"><h1 className="section-title">Tu cotización de envío</h1>
    <p className="mt-3 text-brand-muted">Revisa los productos, la entrega y el total antes de continuar al pago.</p>
    {error&&<p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
    {loading?<p className="mt-6" role="status">Consultando cotización…</p>:quote&&<div className="card mt-6 space-y-5 p-6" data-testid="quotation-review">
      <p className="text-sm font-bold">Referencia {quote.reference}</p>
      <div><h2 className="font-bold">Entrega a {quote.request.customer.name}</h2><p>{quote.request.customer.address}, {quote.request.customer.city}</p>{quote.request.customer.notes&&<p className="text-sm text-brand-muted">{quote.request.customer.notes}</p>}</div>
      <ul className="space-y-3 text-sm">{quote.lines.map((item,index)=><li key={index} className="flex justify-between gap-4"><span>{item.quantity}× {item.name}</span><span>{formatCOP(item.unitCents*item.quantity)}</span></li>)}</ul>
      <div className="space-y-2 border-t border-brand-line pt-4"><p className="flex justify-between"><span>Productos</span><span>{formatCOP(quote.subtotalCents)}</span></p><p className="flex justify-between"><span>Envío</span><span data-testid="quotation-shipping">{quote.shippingCents===null?"Por cotizar":formatCOP(quote.shippingCents)}</span></p><p className="flex justify-between font-extrabold text-brand-primary"><span>Total</span><span data-testid="quotation-total">{quote.shippingCents===null?"Pendiente de cotización":formatCOP(quote.subtotalCents+quote.shippingCents)}</span></p></div>
      {quote.deliveryEstimate&&<p>Plazo estimado: <strong>{quote.deliveryEstimate}</strong></p>}
      {ready?<><p className="text-sm text-brand-muted">Vigente hasta {formatDate(quote.expiresAt)}. La disponibilidad y el precio de los productos se comprueban al continuar.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4" data-testid="quotation-accept"/><span>Confirmo la dirección, el costo del envío y el total mostrado. Mantengo mi aceptación de los <Link className="underline" href="/terminos" target="_blank">términos</Link>, las <Link className="underline" href="/devoluciones" target="_blank">devoluciones</Link> y la autorización de <Link className="underline" href="/privacidad" target="_blank">datos personales</Link>.</span></label><button className="btn-primary w-full disabled:opacity-50" type="button" disabled={!accepted||paying} onClick={()=>void pay()} data-testid="quotation-pay">{paying?"Continuando…":"Aceptar total y continuar al pago"}</button>{testMode&&<p className="text-sm text-brand-muted">Modo de demostración: no se cobra dinero.</p>}</>:<p className="rounded-xl bg-brand-lilac p-4" role="status">{quote.expired?"Esta cotización venció. Solicita una nueva para continuar.":quote.status==="CONSUMED"?"Esta cotización ya se utilizó para un pedido. Usa el enlace de tu pedido para consultar su pago.":quote.status==="DECLINED"?"No fue posible confirmar este envío. Contacta a la tienda para revisar las alternativas.":"Estamos esperando la confirmación del envío. Continúa por WhatsApp con la referencia de tu solicitud."}</p>}
      <div className="flex flex-wrap gap-4"><button className="btn-outline" disabled={paying} type="button" onClick={()=>void load()}>Actualizar cotización</button><a className="btn-outline" href={contactWhatsApp(storeProfile.phone,`Hola, quiero consultar mi cotización ${quote.reference}.`)} target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a></div>
      {existingOrder&&<div className="flex flex-wrap gap-4"><a className="btn-outline" href={existingOrder.orderUrl}>Consultar mi pedido</a>{existingOrder.paymentUrl&&<a className="btn-primary" href={existingOrder.paymentUrl}>Continuar el pago del mismo pedido</a>}</div>}
    </div>}
    <Link href="/carrito" className="mt-6 inline-block underline">Volver al carrito</Link>
  </div>;
}
