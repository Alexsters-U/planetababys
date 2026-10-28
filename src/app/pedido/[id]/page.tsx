"use client";

/**
 * Página de confirmación del pedido: Wompi redirige aquí tras el pago.
 * Muestra el estado en tiempo real (consulta cada 3s mientras está pendiente).
 */
import { useEffect, useState } from "react";
import {toast} from "sonner";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCOP, formatDate } from "@/lib/money";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/labels";
import BrandIcon from "@/shared/ui/brand-icon";
import OrderTotals from "@/shared/ui/order-totals";

type OrderData = {
  order: {
    id: string;
    reference: string;
    status: string;
    reviewRequired:boolean;
    simulated:boolean;
    simulationAvailable:boolean;
    expiresAt:string|null;
    totalCents: number;
    shippingCents:number;
    createdAt: string;
    customerName: string;
    shippingCity: string;
    items: { name: string; quantity: number; unitCents: number; imageUrl: string | null }[];
    payment: { status: string; method: string | null; reference: string } | null;
  };
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-mint-100 text-mint-800",
  PACKED:"bg-baby-blue-100 text-baby-blue-800",
  SHIPPED:"bg-baby-blue-100 text-baby-blue-800",
  DELIVERED: "bg-mint-100 text-mint-800",
  DECLINED: "bg-red-100 text-red-700",
  VOIDED: "bg-gray-200 text-gray-700",
  CANCELLED: "bg-gray-200 text-gray-700",
};

export default function PedidoPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<OrderData | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(()=>{
    if(["DECLINED","VOIDED","CANCELLED"].includes(data?.order.status??""))toast.error("El pago no se completó",{id:"payment-failed"});
  },[data?.order.status]);

  useEffect(() => {
    let stop = false;
    let timer:number|undefined;
    const token=new URLSearchParams(window.location.search).get("token")??"";

    async function poll() {
      try {
        const res = await fetch("/api/orders/"+params.id+"?token="+encodeURIComponent(token));
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {if(!stop)timer=window.setTimeout(poll,5000);return;}
        const json = (await res.json()) as OrderData;
        if (stop) return;
        setData(json);
        if (json.order.status === "PENDING") {
          timer=window.setTimeout(poll, 3000);
        }
      } catch {
        if (!stop) timer=window.setTimeout(poll, 5000);
      }
    }

    poll();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [params.id]);

  if (notFound) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-6xl" aria-hidden>
          🔍
        </p>
        <h1 className="mt-4 text-2xl font-bold">Pedido no encontrado</h1>
        <Link href="/catalogo" className="btn-primary mt-6 inline-block">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container-page py-16 text-center text-gray-400">
        Cargando tu pedido...
      </div>
    );
  }

  const { order } = data;
  const pending = order.status === "PENDING";
  const paid=["PAID","PACKED","SHIPPED","DELIVERED"].includes(order.status);
  const paymentState=order.reviewRequired ? "pending" : paid ? "approved"
    : ["DECLINED","VOIDED","CANCELLED"].includes(order.status) ? "rejected" : "pending";
  const iconStyles={
    approved:"bg-emerald-50 text-emerald-700 ring-emerald-100",
    rejected:"bg-red-50 text-red-600 ring-red-100",
    pending:"bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <div className="container-page max-w-3xl py-10">
      {order.simulated&&<div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note"><strong>Pedido de prueba · Sin cobros reales</strong><p className="mt-1">Este resultado pertenece a una demostración y no acredita un pago en Wompi.</p></div>}
      <div className="card p-8 text-center">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ring-1 ring-inset ${iconStyles[paymentState]}`}
          aria-hidden="true" data-testid="payment-status-icon" data-state={paymentState}>
          <BrandIcon name={`status-${paymentState}`} size={56} strokeWidth={1.8}/>
        </div>

        <span
          data-testid="order-status"
          className={`badge mt-4 ${STATUS_STYLES[order.status] ?? "bg-gray-200"}`}
        >
          {orderStatusLabel(order.status)}
        </span>

        <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
          {order.simulated ? (paid?"Pago de prueba aprobado":order.status==="DECLINED"?"Pago de prueba rechazado":pending?"Pago de prueba pendiente":"La reserva de prueba terminó") : order.reviewRequired ? "Estamos revisando tu pedido" : paid
            ? "¡Gracias por tu compra!"
            : order.status === "DECLINED"
              ? "El pago fue rechazado"
              : pending ? "Estamos confirmando tu pago" : "El pago no se completó"}
        </h1>

        <p className="mt-2 text-gray-600" data-testid="order-thanks">
          {order.simulated ? (paid?"La demostración terminó correctamente. No se realizó ningún cobro.":pending?"Así se ve un pago que espera confirmación. Puedes continuar la demostración para aprobarlo o rechazarlo.":"No se realizó ningún cobro. Puedes iniciar otra compra de prueba para conocer un resultado diferente.") : order.reviewRequired ? "Recibimos una actualización que requiere revisar el pago y la disponibilidad. Conserva tu referencia; el pedido todavía no se puede despachar." : paid
            ? `Hola ${order.customerName}, tu pago está confirmado. Puedes consultar aquí el avance de la preparación y entrega en ${order.shippingCity}.`
            : pending
              ? `Si completaste el pago en Wompi, esta página se actualizará automáticamente en unos segundos. Guarda tu referencia: ${order.reference}`
              : "Puedes regresar al catálogo para iniciar una nueva compra. Conserva esta referencia si necesitas consultar el pago."}
        </p>
        {pending&&order.simulationAvailable&&<Link className="btn-primary mt-5" data-testid="resume-simulation" href={`/pago/prueba/${order.id}?token=${encodeURIComponent(new URLSearchParams(window.location.search).get("token")??"")}`}>Continuar demostración</Link>}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-bold text-gray-900">Resumen del pedido</h2>
        <p className="mt-1 text-sm text-gray-500">
          Referencia <strong>{order.reference}</strong> · {formatDate(order.createdAt)}
        </p>

        <ul className="mt-4 space-y-3">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between text-sm">
              <span>
                {i.quantity}× {i.name}
                <small className="mt-1 block text-xs text-brand-muted">Precio unitario: {formatCOP(i.unitCents)}</small>
              </span>
              <span className="font-medium">
                {formatCOP(i.unitCents * i.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <OrderTotals items={order.items} shippingCents={order.shippingCents} totalCents={order.totalCents}/>

        {order.payment && (
          <p className="mt-4 text-sm text-gray-500">
            Pago: {paymentStatusLabel(order.payment.status)}
            {order.payment.method ? ` · Método: ${order.payment.method}` : ""}
          </p>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link href="/catalogo" className="btn-outline">
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
