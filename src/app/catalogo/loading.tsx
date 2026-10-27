export default function CatalogLoading() {
  return <div className="container-page py-12" role="status" aria-label="Cargando catálogo"><div className="skeleton mb-8 h-10 w-64"/><div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{Array.from({length:8},(_,i)=><div key={i} className="card overflow-hidden"><div className="skeleton aspect-square"/><div className="p-5"><div className="skeleton h-5"/><div className="skeleton mt-3 h-6 w-24"/><div className="skeleton mt-4 h-10"/></div></div>)}</div></div>;
}
