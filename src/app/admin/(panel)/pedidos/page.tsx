"use client";

/**
 * Gestor de pedidos: muestra la información recolectada del cliente
 * (nombre, teléfono, correo, dirección) y el estado del pago, y permite
 * actualizar el estado logístico del pedido.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import BrandIcon from "@/shared/ui/brand-icon";
import useAdminFilters from "@/shared/ui/use-admin-filters";
import Pagination from "@/shared/ui/pagination";
import AdminListControls from "@/shared/ui/admin-list-controls";
import { formatCOP, formatDate } from "@/lib/money";
import {
  orderStatusLabel,
  paymentStatusLabel,
} from "@/lib/labels";

type OrderRow = {
  id: string;
  reference: string;
  status: string;
  totalCents: number;
  reviewRequired:boolean;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string;
  shippingNotes: string | null;
  createdAt: string;
  items: { id: string; name: string; quantity: number; unitCents: number }[];
  payments: { status: string; method: string | null; transactionId: string | null }[];
};

const NEXT_STATUS:Record<string,string>={PAID:"PACKED",PACKED:"SHIPPED",SHIPPED:"DELIVERED"};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-mint-100 text-mint-800",
  PACKED: "bg-baby-blue-100 text-baby-blue-800",
  SHIPPED: "bg-baby-blue-100 text-baby-blue-800",
  DELIVERED: "bg-mint-100 text-mint-800",
  DECLINED: "bg-red-100 text-red-700",
  VOIDED: "bg-gray-200 text-gray-700",
  CANCELLED: "bg-gray-200 text-gray-700",
};

const DEFAULT_FILTERS: Record<string,string> = { q: "", status: "", review:"all", pageSize: "25" };

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,setPage]=useState(1);
  const [pages,setPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [filters,setFilters]=useAdminFilters(DEFAULT_FILTERS,{status:["","PENDING","PAID","PACKED","SHIPPED","DELIVERED","CANCELLED","VOIDED","DECLINED"],review:["all","required","clear"],pageSize:["10","25","50","100"]});
  const requestId=useRef(0);
  const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!=="")).toString();
  function changeFilter(key:string,value:string){setFilters(current=>({...current,[key]:value}));setPage(1);}
  function resetFilters(){setFilters(DEFAULT_FILTERS);setPage(1);}
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const currentRequest=++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders?"+query+"&page="+page);
      if(currentRequest!==requestId.current)return;
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if(!res.ok)throw new Error("Error al cargar pedidos");
      const data = (await res.json()) as { orders: OrderRow[];pages:number;page:number;total:number };
      if(currentRequest!==requestId.current)return;
      setOrders(data.orders ?? []);
      setPages(data.pages);
      setTotal(data.total);
      if(page!==data.page)setPage(data.page);
    } catch {
      if(currentRequest===requestId.current)setError("Error de conexión al cargar pedidos");
    } finally {
      if(currentRequest===requestId.current)setLoading(false);
    }
  }, [page,query]);

  useEffect(() => {
    void load();
    return ()=>{requestId.current++;};
  }, [load]);

  async function updateStatus(order: OrderRow, status: string) {
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "No se pudo actualizar el pedido");
        return;
      }
      toast.success("Estado del pedido actualizado");
      await load();
    } catch {
      setError("Error de conexión");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="section-title">Pedidos</h1>
        <button type="button" className="btn-outline" onClick={() => void load()}>
          <BrandIcon name="refresh" size={18} className="mr-2"/> Actualizar
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600" data-testid="admin-orders-error">
          {error}
        </p>
      )}

      <AdminListControls values={filters} filters={[{key:"status",label:"Estado",options:[{value:"",label:"Todos"},...Object.keys(STATUS_STYLES).map(value=>({value,label:orderStatusLabel(value)}))]},{key:"review",label:"Revisión",options:[{value:"all",label:"Todos"},{value:"required",label:"Necesitan revisión"},{value:"clear",label:"Sin revisión pendiente"}]}]} searchLabel="Referencia, nombre o correo del cliente"
        onChange={changeFilter} onReset={resetFilters} total={total} page={page} loading={loading}/>

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-gray-400">Cargando pedidos...</p>
        ) : orders.length === 0 ? (
          <p className="card p-10 text-center text-gray-400">
            No hay pedidos que coincidan con los filtros. Puedes limpiar la búsqueda.
          </p>
        ) : (
          orders.map((order) => {
            const payment = order.payments[0];
            const isOpen = expanded === order.id;
            return (
              <div key={order.id} className="card p-4" data-testid="order-row">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    aria-expanded={isOpen}
                  >
                    <p className="font-mono text-xs text-gray-400">{order.reference}</p>
                    <p className="font-semibold text-gray-800">
                      {order.customerName}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        · {order.shippingCity}
                      </span>
                    </p>
                  </button>

                  <span className="flex-1" />

                  <span
                    className={
                      "badge " + (STATUS_STYLES[order.status] ?? "bg-gray-200")
                    }
                    data-testid="order-row-status"
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                  <span
                    className={
                      "badge " +
                      (payment?.status === "APPROVED"
                        ? "bg-mint-100 text-mint-800"
                        : payment?.status === "DECLINED"
                          ? "bg-red-100 text-red-700"
                          : "bg-baby-blue-100 text-baby-blue-800")
                    }
                    data-testid="order-row-payment"
                  >
                    <BrandIcon name="sales" size={15} className="mr-1"/> {paymentStatusLabel(payment?.status ?? "PENDING")}
                  </span>
                  <span className="font-bold text-gray-900">
                    {formatCOP(order.totalCents)}
                  </span>

                  <select
                    className="input max-w-44 py-1.5 text-xs"
                    value={order.status}
                    onChange={(e) => void updateStatus(order, e.target.value)}
                    disabled={!NEXT_STATUS[order.status] || order.reviewRequired}
                    data-testid="order-status-select"
                    aria-label={`Cambiar estado del pedido ${order.reference}`}
                  >
                    {[order.status,NEXT_STATUS[order.status]].filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {orderStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>

                {order.reviewRequired && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Pago en revisión. No despachar: verifica la transacción y la disponibilidad antes de resolver el caso.</p>}
                {isOpen && (
                  <div className="mt-4 grid gap-6 border-t border-gray-100 pt-4 sm:grid-cols-2">
                    <div className="text-sm">
                      <h3 className="font-bold text-gray-800">Cliente</h3>
                      <p className="mt-2 text-gray-700" data-testid="order-customer-name">
                        👤 {order.customerName}
                      </p>
                      <p className="text-gray-700" data-testid="order-customer-phone">
                        📱 {order.customerPhone}
                      </p>
                      <p className="text-gray-700" data-testid="order-customer-email">
                        ✉️ {order.customerEmail}
                      </p>
                      <p className="mt-2 text-gray-700">
                        📍 {order.shippingAddress}, {order.shippingCity}
                      </p>
                      {order.shippingNotes && (
                        <p className="mt-1 text-gray-500">📝 {order.shippingNotes}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        Creado: {formatDate(order.createdAt)}
                      </p>
                      {payment?.transactionId && (
                        <p className="mt-1 text-xs text-gray-400">
                          Transacción Wompi: {payment.transactionId}
                        </p>
                      )}
                    </div>
                    <div className="text-sm">
                      <h3 className="font-bold text-gray-800">Productos</h3>
                      <ul className="mt-2 space-y-1">
                        {order.items.map((i) => (
                          <li key={i.id} className="flex justify-between gap-3 text-gray-700">
                            <span>
                              {i.quantity}× {i.name}
                            </span>
                            <span className="shrink-0">
                              {formatCOP(i.unitCents * i.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-bold">
                        <span>Total</span>
                        <span>{formatCOP(order.totalCents)}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <Pagination page={page} pages={pages} loading={loading} onPage={setPage}/>
    </div>
  );
}
