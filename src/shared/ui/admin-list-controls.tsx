"use client";

import { useEffect,useState } from "react";

type Filter = { key: string; label: string; options: { value: string; label: string }[] };

export default function AdminListControls({ values, filters, searchLabel, onChange, onReset, total, page, loading }: {
  values: Record<string, string>; filters: Filter[]; searchLabel: string;
  onChange: (key: string, value: string) => void; onReset: () => void;
  total: number; page: number; loading: boolean;
}) {
  const [draft, setDraft] = useState(values.q);
  useEffect(()=>{setDraft(values.q);},[values.q]);
  const pageSize = Number(values.pageSize);
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return <section aria-label="Filtros del listado" className="card mt-6 space-y-4 p-4 sm:p-5">
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); onChange("q", draft.trim()); }}>
      <label className="min-w-48 flex-1 text-sm font-semibold text-gray-700">
        {searchLabel}
        <input className="input mt-1 w-full" type="search" maxLength={100} value={draft}
          onChange={e => setDraft(e.target.value)} placeholder="Escribe y pulsa Buscar" data-testid="admin-search" />
      </label>
      <button className="btn-primary" type="submit">Buscar</button>
      <button className="btn-outline" type="button" onClick={() => { setDraft(""); onReset(); }} data-testid="admin-clear-filters">Limpiar filtros</button>
    </form>
    <div className={"grid gap-3 sm:grid-cols-2 " + (filters.length > 4 ? "xl:grid-cols-3" : "xl:grid-cols-5")}>
      {filters.map(filter => <label key={filter.key} className="text-sm font-semibold text-gray-700">
        {filter.label}
        <select className="input mt-1 w-full" value={values[filter.key]} onChange={e => onChange(filter.key, e.target.value)} data-testid={`admin-filter-${filter.key}`}>
          {filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>)}
      <label className="text-sm font-semibold text-gray-700">Por página
        <select className="input mt-1 w-full" value={values.pageSize} onChange={e => onChange("pageSize", e.target.value)} data-testid="admin-page-size">
          {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
    </div>
    <p className="text-sm text-gray-500" role="status" data-testid="admin-result-count">
      {loading ? "Actualizando resultados…" : `Mostrando ${first}–${last} de ${total} resultados`}
      {!loading && values.q && <> · Búsqueda: “{values.q}”</>}
    </p>
  </section>;
}
