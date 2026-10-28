"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {formatCOP} from "@/lib/money";
type Order={reference:string;totalCents:number;status:string;simulationAvailable:boolean;expiresAt:string|null};
export default function PaymentSimulation({id,token}:{id:string;token:string}) {
  const router=useRouter();
  const [order,setOrder]=useState<Order|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[method,setMethod]=useState("CARD");
  useEffect(()=>{let active=true;fetch(`/api/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`).then(async response=>{
    if(!response.ok)throw new Error("El enlace no está disponible. Revisa tu referencia con la tienda.");
    const data=await response.json();if(!data.order.simulationAvailable)throw new Error("La demostración no está disponible para este pedido.");
    if(active)setOrder(data.order);
  }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,token]);
  async function simulate(status:string) {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/payments/simulate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id,token,status,method})});
      const data=await response.json();if(!response.ok)throw new Error(data.error??"No pudimos completar la demostración.");
      router.push(`/pedido/${id}?token=${encodeURIComponent(token)}`);
    }catch(e){setError(e instanceof Error?e.message:"No pudimos conectar con la tienda.");setBusy(false);}
  }
  const finished=order?.status!=="PENDING";
  return <div className="container-page max-w-2xl py-10">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="note"><strong>Demostración · Sin cobros reales</strong><p className="mt-1">Este recorrido muestra cómo se verá el resultado de un pago. No ingreses datos de tarjetas ni cuentas bancarias.</p></div>
    <section className="card mt-6 space-y-6 p-6 sm:p-8"><div><h1 className="text-2xl font-extrabold">Prueba tu experiencia de pago</h1><p className="mt-2 text-sm text-brand-muted">Elige un método y el resultado que deseas conocer.</p></div>
      {order&&<><div className="rounded-xl bg-brand-lilac p-4"><p className="break-all text-xs">Referencia {order.reference}</p><p className="mt-2 text-2xl font-bold">{formatCOP(order.totalCents)}</p></div>
      {finished?<p>Esta compra de prueba ya terminó. Inicia una nueva para explorar otro resultado.</p>:<><label className="label" htmlFor="demo-method">Método de pago de ejemplo</label><select id="demo-method" className="input w-full" value={method} onChange={e=>setMethod(e.target.value)} disabled={busy}><option value="CARD">Tarjeta</option><option value="PSE">PSE</option><option value="NEQUI">Nequi</option></select>
      <div className="grid gap-3 sm:grid-cols-3">{[{status:"APPROVED",label:"Pago aprobado"},{status:"DECLINED",label:"Pago rechazado"},{status:"PENDING",label:"Pago pendiente"}].map(item=><button key={item.status} className="btn-outline justify-center disabled:opacity-50" data-testid={`simulate-${item.status.toLowerCase()}`} disabled={busy} onClick={()=>simulate(item.status)}>{item.label}</button>)}</div></>}
      <Link className="block text-sm text-brand-primary underline" href={`/pedido/${id}?token=${encodeURIComponent(token)}`}>Consultar este pedido de prueba</Link></>}
      {!order&&!error&&<p role="status">Cargando la demostración…</p>}
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  </div>;
}
