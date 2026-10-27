"use client";

/**
 * CRUD completo de productos conectado a la base de datos:
 * listar, crear, editar (nombre, precio, stock, categoría, imagen) y eliminar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import ProductForm, { type ProductFormData } from "@/features/admin-products/ui/product-form";
import ProductPrice from "@/shared/ui/product-price";
import PromotionSummary from "@/features/admin-products/ui/promotion-summary";
import { categoryLabel } from "@/lib/labels";
import Modal from "@/shared/ui/modal";
import Pagination from "@/shared/ui/pagination";
import AdminListControls from "@/shared/ui/admin-list-controls";
import { CATEGORIES } from "@/shared/validation";
import ProductImage from "@/shared/ui/product-image";
import BrandIcon from "@/shared/ui/brand-icon";
import useAdminFilters from "@/shared/ui/use-admin-filters";

type ProductRow = ProductFormData & {
  id: string;
  slug: string;
};

const DEFAULT_FILTERS: Record<string,string> = { q: "", category: "", visibility: "all", stock: "all", promotion: "all", sort: "newest", pageSize: "25" };

export default function AdminProductosPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,setPage]=useState(1);
  const [pages,setPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [filters,setFilters]=useAdminFilters(DEFAULT_FILTERS,{category:CATEGORIES,visibility:["all","visible","hidden"],stock:["all","available","empty","low"],promotion:["all","active","scheduled","expired","none"],sort:["newest","name","priceAsc","priceDesc"],pageSize:["10","25","50","100"]});
  const requestId=useRef(0);
  const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!=="")).toString();
  function changeFilter(key:string,value:string){setFilters(current=>({...current,[key]:value}));setPage(1);}
  function resetFilters(){setFilters(DEFAULT_FILTERS);setPage(1);}
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; product: ProductRow } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<ProductRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const currentRequest=++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products?"+query+"&page="+page);
      if(currentRequest!==requestId.current)return;
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if(!res.ok) throw new Error("Error al cargar productos");
      const data = (await res.json()) as { products: ProductRow[];pages:number;page:number;total:number };
      if(currentRequest!==requestId.current)return;
      setProducts(data.products ?? []);
      setPages(data.pages);
      setTotal(data.total);
      if(page!==data.page)setPage(data.page);
    } catch {
      if(currentRequest===requestId.current)setError("Error de conexión al cargar productos");
    } finally {
      if(currentRequest===requestId.current)setLoading(false);
    }
  }, [page,query]);

  useEffect(() => {
    void load();
    return ()=>{requestId.current++;};
  }, [load]);

  async function handleDelete(product: ProductRow) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "No se pudo eliminar");
        return;
      }
      setConfirmDelete(null);
      setMessage(`Producto "${product.name}" eliminado`);
      await load();
    } catch {
      setError("Error de conexión");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="section-title">Productos</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setModal({ mode: "create" })}
          data-testid="new-product-button"
        >
          <BrandIcon name="plus" size={19} className="mr-2"/> Nuevo producto
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-mint-50 p-3 text-sm text-mint-700" data-testid="admin-success">
          ✓ {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600" data-testid="admin-error">
          {error}
        </p>
      )}

      <AdminListControls values={filters} filters={[
          {key:"category",label:"Categoría",options:[{value:"",label:"Todas"},...CATEGORIES.map(value=>({value,label:categoryLabel(value)}))]},
          {key:"visibility",label:"Visibilidad",options:[{value:"all",label:"Todos"},{value:"visible",label:"Visibles"},{value:"hidden",label:"Ocultos"}]},
          {key:"stock",label:"Inventario",options:[{value:"all",label:"Todo el inventario"},{value:"available",label:"Disponibles"},{value:"empty",label:"Agotados"},{value:"low",label:"Stock bajo (1–5)"}]},
          {key:"promotion",label:"Promoción",options:[{value:"all",label:"Todas"},{value:"active",label:"Activas"},{value:"scheduled",label:"Programadas"},{value:"expired",label:"Finalizadas"},{value:"none",label:"Sin promoción"}]},
          {key:"sort",label:"Ordenar",options:[{value:"newest",label:"Más recientes"},{value:"name",label:"Nombre A–Z"},{value:"priceAsc",label:"Menor precio"},{value:"priceDesc",label:"Mayor precio"}]},
        ]} searchLabel="Nombre o identificador del producto"
        onChange={changeFilter} onReset={resetFilters} total={total} page={page} loading={loading}/>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="products-table">
          <thead className="bg-baby-pink-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Promoción</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No hay productos que coincidan con los filtros. Puedes limpiar la búsqueda o crear un producto.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-t border-gray-100" data-testid="product-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-baby-pink-50">
                        <ProductImage slug={p.slug} url={p.imageUrl} alt={p.name} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{categoryLabel(p.category)}</td>
                  <td className="px-4 py-3 font-semibold" data-testid="row-price">
                    <ProductPrice product={p} testId="admin-effective-price" />
                  </td>
                  <td className="px-4 py-3"><PromotionSummary product={p} /></td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "badge " +
                        (p.stock > 5
                          ? "bg-mint-100 text-mint-700"
                          : p.stock > 0
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-600")
                      }
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "badge " +
                        (p.isActive
                          ? "bg-baby-blue-100 text-baby-blue-800"
                          : "bg-gray-200 text-gray-600")
                      }
                    >
                      {p.isActive ? "Visible" : "Oculto"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        onClick={() => setModal({ mode: "edit", product: p })}
                        data-testid="edit-product-button"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDelete(p)}
                        data-testid="delete-product-button"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} loading={loading} onPage={setPage}/>
      {/* Modal crear/editar */}
      {modal && (
        <Modal label={modal.mode === "create" ? "Nuevo producto" : "Editar producto"} onClose={()=>setModal(null)}>
          <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              {modal.mode === "create" ? "Nuevo producto" : `Editar: ${modal.product.name}`}
            </h2>
            <ProductForm
              initial={modal.mode === "edit" ? modal.product : undefined}
              onCancel={() => setModal(null)}
              onSaved={async () => {
                setModal(null);
                if(modal.mode==="create")setPage(1);
                setMessage(
                  modal.mode === "create"
                    ? "Producto creado correctamente"
                    : "Producto actualizado correctamente"
                );
                if(modal.mode!=="create" || page===1)await load();
              }}
            />
          </div>
        </Modal>
      )}

      {/* Modal eliminar */}
      {confirmDelete && (
        <Modal label="Eliminar producto" onClose={()=>setConfirmDelete(null)}>
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900">¿Eliminar producto?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Vas a eliminar <strong>{confirmDelete.name}</strong>. Esta acción no
              se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setConfirmDelete(null)}
                data-testid="cancel-delete"
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => void handleDelete(confirmDelete)}
                data-testid="confirm-delete"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
