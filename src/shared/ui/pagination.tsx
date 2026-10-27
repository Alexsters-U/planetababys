"use client";
export default function Pagination({page,pages,loading,onPage}:{page:number;pages:number;loading:boolean;onPage:(page:number)=>void}){
  const last=Math.max(1,pages);
  const numbers=[...new Set([1,page-1,page,page+1,last])].filter(n=>n>=1&&n<=last).sort((a,b)=>a-b);
  return <nav aria-label="Paginación" className="mt-6 flex flex-wrap items-center justify-center gap-2">
    <button type="button" className="btn-outline disabled:opacity-40" disabled={loading||page<=1} onClick={()=>onPage(page-1)}>Anterior</button>
    {numbers.map((n,index)=><span className="flex items-center gap-2" key={n}>
      {index>0&&n-numbers[index-1]>1&&<span aria-hidden="true">…</span>}
      <button type="button" className={(n===page?"btn-primary":"btn-outline")+" min-w-10 disabled:opacity-40"}
        aria-label={`Ir a página ${n}`} aria-current={n===page?"page":undefined} disabled={loading||n===page} onClick={()=>onPage(n)}>{n}</button>
    </span>)}
    <button type="button" className="btn-outline disabled:opacity-40" disabled={loading||page>=pages} onClick={()=>onPage(page+1)}>Siguiente</button>
    <span className="w-full text-center text-sm text-gray-500" aria-live="polite">Página {page} de {last}</span>
  </nav>;
}
