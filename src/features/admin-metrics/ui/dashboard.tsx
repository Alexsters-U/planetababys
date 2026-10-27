"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {DASHBOARD_DAYS,metricChange,type DashboardDays,type DashboardSummary} from "@/shared/analytics";
import {formatCOP} from "@/lib/money";
import {orderStatusLabel} from "@/lib/labels";
import {formatPromotionDate} from "@/shared/promotions";
import BrandIcon,{type BrandIconName} from "@/shared/ui/brand-icon";
import BrandScene from "@/shared/ui/brand-scene";

function dayLabel(date:string){const [,month,day]=date.split("-");return `${Number(day)}/${month}`;}
function Trend({value,previous}:{value:number;previous:number}){
  const change=metricChange(value,previous);
  return <p className="mt-3 text-xs text-brand-muted">{change===null?"Sin base para comparar":<><span className={change<0?"text-rose-700 font-bold":"text-emerald-800 font-bold"}>{change>0?"+":""}{String(change).replace(".",",")}%</span> vs. período anterior</>}</p>;
}
function SalesChart({rows}:{rows:DashboardSummary["dailySales"]}){
  const [selected,setSelected]=useState(rows.length-1);
  useEffect(()=>setSelected(rows.length-1),[rows]);
  const index=Math.min(selected,rows.length-1),point=rows[index],max=Math.max(...rows.map(r=>r.salesCents),100);
  const x=(i:number)=>58+i*624/Math.max(rows.length-1,1),y=(v:number)=>185-v/max*145;
  const line=rows.map((r,i)=>`${x(i)},${y(r.salesCents)}`).join(" ");
  const empty=rows.every(r=>r.orders===0);
  return <div data-testid="sales-chart">
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-brand-lilac/60 px-4 py-3" aria-live="polite" data-testid="chart-selected">
      <span className="text-sm font-bold">{point.date} · {point.orders} {point.orders===1?"venta":"ventas"}</span><strong className="text-brand-primary">{formatCOP(point.salesCents)}</strong>
    </div>
    <div className="relative mt-3">
      <svg viewBox="0 0 700 230" className="w-full rounded-xl text-brand-primary" tabIndex={0} role="img" aria-label="Ventas diarias. Usa las flechas izquierda y derecha para consultar cada día." onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();setSelected(e.key==="Home"?0:e.key==="End"?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(e.key==="ArrowRight"?1:-1))));}}}>
        {[0,.5,1].map(r=><g key={r}><line x1="58" x2="682" y1={y(max*r)} y2={y(max*r)} stroke="#E8DEEE" strokeDasharray="4 5"/><text x="49" y={y(max*r)+4} textAnchor="end" fill="#716479" fontSize="11">{formatCOP(Math.round(max*r)).replace("$ ","")}</text></g>)}
        {!empty&&<polygon points={`58,185 ${line} 682,185`} fill="#F1EAF8"/>}
        <polyline points={line} fill="none" stroke="#70508F" strokeWidth="2.5" strokeLinejoin="round"/>
        {[0,Math.floor((rows.length-1)/2),rows.length-1].map((i)=><text key={i} x={x(i)} y="216" textAnchor="middle" fontSize="12" fill="#716479">{dayLabel(rows[i].date)}</text>)}
        {rows.map((r,i)=><circle key={r.date} cx={x(i)} cy={y(r.salesCents)} r={i===index?5:8} fill={i===index?"#70508F":"transparent"} className="cursor-pointer" onMouseEnter={()=>setSelected(i)} onClick={()=>setSelected(i)}><title>{`${r.date}: ${formatCOP(r.salesCents)} · ${r.orders} ventas`}</title></circle>)}
      </svg>
      {empty&&<div className="pointer-events-none absolute inset-x-14 top-5 text-center"><p className="mx-auto w-fit rounded-2xl border border-brand-line bg-white/95 px-5 py-3 text-sm font-semibold text-brand-muted">La primera venta dibujará esta órbita.<span className="mt-1 block text-xs font-normal">Aún no hay pagos confirmados en este período.</span></p></div>}
    </div>
    <p className="text-xs text-brand-muted">Hora de Colombia · Primer y último día pueden ser parciales. Usa las flechas sobre la gráfica.</p>
    <details className="mt-3 text-xs text-brand-muted"><summary className="cursor-pointer font-bold text-brand-primary">Consultar datos diarios</summary><div className="mt-3 max-h-52 overflow-auto"><table className="w-full text-left"><caption className="sr-only">Ventas diarias en pesos colombianos</caption><thead><tr><th className="py-2">Día</th><th>Venta de productos</th><th>Pagados</th></tr></thead><tbody>{rows.map(r=><tr key={r.date}><td className="py-1.5">{r.date}</td><td>{formatCOP(r.salesCents)}</td><td>{r.orders}</td></tr>)}</tbody></table></div></details>
  </div>;
}

export default function Dashboard({initial}:{initial:DashboardSummary}){
  const [data,setData]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[requested,setRequested]=useState<DashboardDays>(initial.period.days);
  const activeRequest=useRef(0);
  useEffect(()=>{setData(initial);setRequested(initial.period.days);},[initial]);
  useEffect(()=>()=>{activeRequest.current++;},[]);
  // Browser back/forward restores the server-rendered range through App Router.
  async function update(days:DashboardDays){
    const request=++activeRequest.current;setBusy(true);setError(null);setRequested(days);
    try{
      const response=await fetch("/api/admin/summary?days="+days,{cache:"no-store"});
      if(request!==activeRequest.current)return;
      if(response.status===401){window.location.href="/admin/login";return;}
      if(!response.ok)throw new Error("No disponible");
      const summary:DashboardSummary=await response.json();
      if(request!==activeRequest.current)return;
      setData(summary);window.history.replaceState(null,"","/admin?days="+days);
    }catch{if(request===activeRequest.current)setError("No pudimos actualizar las métricas. Los datos anteriores se conservan con su fecha de consulta.");}
    finally{if(request===activeRequest.current)setBusy(false);}
  }
  const m=data.metrics;
  const cards:{label:string;value:number;previous:number;icon:BrandIconName;money?:boolean;note:string;style:string;id:string}[]=[
    {label:"Ventas confirmadas",value:m.salesCents,previous:m.previousSalesCents,icon:"sales",money:true,note:"Web y local · sin envío",style:"metric-lilac",id:"sales"},
    {label:"Ventas completadas",value:m.paidOrders,previous:m.previousPaidOrders,icon:"check",note:"Pagos web y registros del local",style:"metric-mint",id:"paid"},
    {label:"Ticket promedio",value:m.averageTicketCents,previous:m.previousAverageTicketCents,icon:"ticket",money:true,note:"Importe por venta completada",style:"metric-rose",id:"ticket"},
    {label:"Pedidos web recibidos",value:m.placedOrders,previous:m.previousPlacedOrders,icon:"orders",note:"Solo web · todos los estados",style:"metric-butter",id:"orders"},
  ];
  const actions:{label:string;description:string;value:number;href:string;icon:BrandIconName;test:string}[]=[
    {label:"Listos para preparar",description:"Pagados y sin revisión pendiente",value:data.operations.readyToPack,href:"/admin/pedidos?status=PAID&review=clear",icon:"products",test:"ready"},
    {label:"Necesitan revisión",description:"Comprueba las alertas del pedido",value:data.operations.reviewRequired,href:"/admin/pedidos?review=required",icon:"alert",test:"review"},
    {label:"Stock bajo",description:"Productos visibles con 1–5 unidades",value:data.inventory.lowStock,href:"/admin/productos?stock=low&visibility=visible",icon:"stock",test:"low-stock"},
    {label:"Agotados",description:"Productos visibles sin unidades",value:data.inventory.outOfStock,href:"/admin/productos?stock=empty&visibility=visible",icon:"clock",test:"out-of-stock"},
  ];
  const colors:Record<string,string>={PENDING:"#F5DB9A",PAID:"#B8D8C8",PACKED:"#B7A0D2",SHIPPED:"#70508F",DELIVERED:"#54366F",DECLINED:"#EAB4C8",VOIDED:"#E8DEEE",CANCELLED:"#E8DEEE"};
  return <div className="space-y-6" data-testid="admin-dashboard" aria-busy={busy}>
    <header className="dashboard-welcome relative overflow-hidden rounded-[2rem] border border-brand-line p-6 sm:p-8">
      <div className="relative z-10 max-w-2xl lg:pr-12"><p className="eyebrow"><BrandIcon name="planet" size={20}/>CENTRO DE CUIDADO</p><h1 className="section-title mt-3">Resumen de tu pequeño universo</h1><p className="mt-3 text-sm leading-6 text-brand-muted">Cada venta cuenta una historia. Aquí puedes ver cómo va tu tienda y qué necesita atención hoy.</p></div>
      <div className="pointer-events-none absolute -right-5 -top-7 hidden w-52 opacity-80 lg:block"><BrandScene variant="empty"/></div>
      <div className="relative z-10 mt-5 flex flex-wrap gap-2"><Link href="/admin/productos" className="btn-outline gap-2"><BrandIcon name="plus" size={18}/>Gestionar catálogo</Link><Link href="/admin/pedidos" className="btn-outline gap-2"><BrandIcon name="orders" size={18}/>Ver pedidos</Link></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-lg font-extrabold">Así va tu tienda</h2><p className="mt-1 text-xs text-brand-muted" data-testid="metrics-period">Últimos {data.period.days} días · {formatPromotionDate(data.period.start)} — {formatPromotionDate(data.period.end)} · Colombia</p></div>
      <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-full border border-brand-line bg-white p-1" role="group" aria-label="Período de las métricas">{DASHBOARD_DAYS.map(days=><button key={days} type="button" disabled={busy} aria-pressed={data.period.days===days} onClick={()=>void update(days)} className={"min-h-10 rounded-full px-4 text-xs font-bold transition disabled:opacity-60 "+(data.period.days===days?"bg-brand-primary text-white":"text-brand-muted hover:bg-brand-lilac")} data-testid={`range-${days}`}>{days} días</button>)}</div><button type="button" disabled={busy} className="btn-outline gap-2" onClick={()=>void update(data.period.days)} data-testid="metrics-refresh"><BrandIcon name="refresh" size={18}/>{busy?"Actualizando…":"Actualizar"}</button></div>
    </div>
    {data.testMode&&<p className="rounded-xl bg-brand-butter/35 px-4 py-2 text-xs font-semibold text-brand-ink">Entorno de pruebas · Las ventas y los pedidos son de demostración.</p>}
    {error&&<div role="alert" className="card flex flex-wrap items-center gap-3 bg-brand-rose p-4" data-testid="metrics-error"><BrandIcon name="alert"/><p className="min-w-48 flex-1 text-sm">{error}</p><button type="button" className="btn-outline" disabled={busy} onClick={()=>void update(requested)}>Reintentar</button></div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card=><article key={card.label} className={`metric-card ${card.style}`}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{card.label}</h3><span className="metric-icon"><BrandIcon name={card.icon}/></span></div><p className="mt-5 text-[clamp(1.4rem,2.4vw,2rem)] font-extrabold tracking-tight" data-testid={`metric-${card.id}`}>{card.money?formatCOP(card.value):card.value}</p><p className="mt-1 text-xs text-brand-muted">{card.note}</p><Trend value={card.value} previous={card.previous}/></article>)}</div>
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Ventas por canal">{([{key:"web",label:"Ventas web",href:"/admin/pedidos",icon:"orders"},{key:"local",label:"Ventas del local",href:"/admin/ventas-local?vista=historial",icon:"store"}] as const).map(channel=><Link href={channel.href} key={channel.key} className="card flex items-center justify-between gap-4 p-5"><div><p className="text-sm font-bold">{channel.label}</p><p className="mt-2 text-xl font-extrabold text-brand-primary" data-testid={`sales-channel-${channel.key}`}>{formatCOP(data.channels[channel.key].salesCents)}</p><p className="mt-1 text-xs text-brand-muted">{data.channels[channel.key].completedSales} ventas completadas en el período</p></div><span className="metric-icon bg-brand-lilac"><BrandIcon name={channel.icon}/></span></Link>)}</section>
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <section className="card min-w-0 p-5 sm:p-6" aria-label="Evolución de las ventas"><div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold">La órbita de tus ventas</h2><p className="mt-1 text-xs text-brand-muted">Ventas web y del local, en COP y sin envío.</p></div><span className="metric-icon bg-brand-lilac"><BrandIcon name="sales"/></span></div><SalesChart rows={data.dailySales}/></section>
      <section className="card min-w-0 p-5 sm:p-6"><h2 className="font-extrabold">Pedidos web en movimiento</h2><p className="mt-1 text-xs text-brand-muted">Estado de los pedidos web recibidos en el período.</p><div className="my-5 flex h-3 overflow-hidden rounded-full bg-brand-lilac" aria-hidden="true">{data.orderStatuses.map(s=><span key={s.status} style={{width:`${s.count/Math.max(m.placedOrders,1)*100}%`,background:colors[s.status]??"#B7A0D2"}}/>)}</div><ul className="space-y-3">{data.orderStatuses.length?data.orderStatuses.map(s=><li key={s.status} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background:colors[s.status]??"#B7A0D2"}}/>{orderStatusLabel(s.status)}</span><strong>{s.count}</strong></li>):<li className="text-sm text-brand-muted">Aún no hay pedidos en este período.</li>}</ul><div className="mt-5 rounded-2xl bg-brand-mintLight p-4"><p className="text-sm"><strong>{String(m.confirmationRate).replace(".",",")}%</strong> de los pedidos web recibidos tienen pago confirmado.</p><p className="mt-1 text-xs text-brand-muted">Excluye pedidos que requieren revisión.</p></div></section>
    </div>
    <section aria-label="Prioridades de hoy"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Un poco de atención, mucho cuidado</h2><span className="text-xs text-brand-muted">Situación actual de toda la tienda</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{actions.map(action=><Link key={action.label} href={action.href} className="attention-card" data-testid={`action-${action.test}`}><div className="flex items-center justify-between"><span className="metric-icon bg-brand-lilac"><BrandIcon name={action.icon}/></span><strong className="text-2xl text-brand-primary">{action.value}</strong></div><h3 className="mt-4 text-sm font-extrabold">{action.label}</h3><p className="mt-1 text-xs leading-5 text-brand-muted">{action.description}</p><p className="mt-3 flex items-center gap-1 text-xs font-bold text-brand-primary">Ver listado <BrandIcon name="arrow" size={15}/></p></Link>)}</div></section>
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <section className="card min-w-0 p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-extrabold">Los favoritos de tus clientes</h2><BrandIcon name="tag"/></div><p className="mt-1 text-xs text-brand-muted">Top 5 por unidades vendidas en la web y el local.</p>{data.topProducts.length?<ol className="mt-5 space-y-4">{data.topProducts.map((p,i)=><li key={p.productId} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-lilac text-sm font-extrabold text-brand-primary">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold" title={p.name}>{p.name}</p><p className="mt-1 text-xs text-brand-muted">{p.quantity} unidades · {formatCOP(p.salesCents)}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-lilac"><div className="h-full rounded-full bg-brand-lavender" style={{width:`${p.quantity/data.topProducts[0].quantity*100}%`}}/></div></div></li>)}</ol>:<div className="mt-5 rounded-2xl bg-cream p-5 text-center"><div className="mx-auto w-24"><BrandScene variant="empty"/></div><p className="text-sm font-bold">Los favoritos empiezan con una venta.</p><p className="mt-1 text-xs text-brand-muted">Aquí aparecerán los productos vendidos en la web y el local.</p></div>}<div className="mt-5 flex flex-wrap gap-2 border-t border-brand-line pt-4"><Link href="/admin/productos?visibility=visible" className="badge bg-brand-mintLight text-brand-dark">{data.inventory.visible} productos visibles</Link><Link href="/admin/productos?promotion=active&visibility=visible" className="badge gap-1 bg-brand-rose text-brand-dark"><BrandIcon name="tag" size={15}/>{data.inventory.activePromotions} promociones activas</Link></div></section>
      <section className="card min-w-0 p-5 sm:p-6"><div className="flex items-center justify-between gap-2"><h2 className="font-extrabold">Últimos pedidos web</h2><Link href="/admin/pedidos" className="text-xs font-bold text-brand-primary">Ver todos →</Link></div><p className="mt-1 text-xs text-brand-muted">Recibidos en el período · el total incluye envío.</p>{data.recentOrders.length?<ul className="mt-4 divide-y divide-brand-line">{data.recentOrders.map(o=><li key={o.id}><Link href={"/admin/pedidos?q="+encodeURIComponent(o.reference)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl py-3 hover:bg-brand-lilac/50"><div className="min-w-0"><p className="max-w-60 truncate text-xs font-bold text-brand-primary" title={o.reference}>{o.reference}</p><p className="mt-1 text-xs text-brand-muted">{orderStatusLabel(o.status)}</p></div><strong className="text-sm">{formatCOP(o.totalCents)}</strong></Link></li>)}</ul>:<p className="mt-6 text-sm text-brand-muted">Aún no hay pedidos en este período.</p>}</section>
    </div>
    <footer className="rounded-2xl border border-brand-line bg-white/60 p-4 text-xs leading-6 text-brand-muted"><p>Consulta: {formatPromotionDate(data.generatedAt)} · America/Bogota. Comparación con los {data.period.days} días inmediatamente anteriores.</p><p>Las ventas suman el precio guardado al comprar, incluidas las promociones. Se excluyen envío, pagos pendientes, fallidos, cancelados, pedidos en revisión y ventas locales anuladas. No es un informe contable.</p></footer>
  </div>;
}
