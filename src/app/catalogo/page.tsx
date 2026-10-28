import Link from "next/link";
import type { Metadata } from "next";
import { catalog } from "@/shared/api/server";
import ProductCard from "@/entities/product/ui/product-card";
import { CATEGORIES } from "@/lib/validation";
import { categoryLabel } from "@/lib/labels";
import PromotionRefresh from "@/shared/promotions/promotion-refresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates:{canonical:"/catalogo"},
  title: "Catálogo",
  description: "Todos los productos para tu bebé en Planeta Baby's.",
};

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; page?: string; promociones?:string }>;
}) {
  const query = await searchParams;
  const categoria = query.categoria;
  const q = query.q?.trim().slice(0,100);
  const page = Math.max(1,Math.floor(Number(query.page)||1));
  const promotions=query.promociones==="1";
  const href=(category?:string,onSale=promotions,nextPage?:number)=>"/catalogo?"+new URLSearchParams({...(category?{categoria:category}:{}),...(q?{q}:{}),...(onSale?{promociones:"1"}:{}),...(nextPage?{page:String(nextPage)}:{})});

  const {products,total,pages}=await catalog({category:categoria && CATEGORIES.includes(categoria as never)?categoria:undefined,q,page,limit:24,promotions:promotions?"true":undefined});

  return (
    <div className="container-page py-10">
      <PromotionRefresh ends={products.map(p=>p.promotionEndsAt as string|null|undefined)} />
      <h1 className="section-title">{promotions?"Promociones":"Catálogo"}</h1>
      <p className="mt-1 text-gray-600">
        {promotions?"Ofertas vigentes para cuidar tu bolsillo. ":""}{total} producto{total === 1 ? "" : "s"} disponible{total === 1 ? "" : "s"}
      </p>

      <form action="/catalogo" className="mt-6 flex flex-wrap gap-3" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar pañales, biberones, ropa..."
          className="input max-w-md flex-1"
          aria-label="Buscar productos"
        />
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        {promotions && <input type="hidden" name="promociones" value="1"/>}
        <button type="submit" className="btn-primary">
          Buscar
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={href()}
          className={
            "badge border " +
            (!categoria
              ? "border-baby-pink-500 bg-baby-pink-500 text-white"
              : "border-baby-pink-200 bg-white text-baby-pink-700")
          }
        >
          Todos
        </Link>
        {CATEGORIES.filter((c) => c !== "general").map((c) => (
          <Link
            key={c}
            href={href(c)}
            className={
              "badge border " +
              (categoria === c
                ? "border-baby-pink-500 bg-baby-pink-500 text-white"
                : "border-baby-pink-200 bg-white text-baby-pink-700")
            }
          >
            {categoryLabel(c)}
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={href(categoria,!promotions)} data-testid="catalog-promotions-filter" aria-current={promotions ? "true" : undefined}
          className={(promotions?"bg-brand-primary text-white":"border border-brand-primary bg-white text-brand-primary")+" inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold"}>Promociones {promotions?"✓":""}</Link>
        {promotions && <Link href={href(categoria,false)} className="text-sm text-brand-primary underline">Quitar filtro de promociones</Link>}
      </div>

      {products.length === 0 ? (
        <div className="card mt-10 p-10 text-center text-gray-500">
          <p className="text-4xl" aria-hidden>
            🔍
          </p>
          <p className="mt-3 font-semibold">{promotions?"No hay promociones que coincidan con estos filtros":"No encontramos productos"}</p>
          <p className="mt-1 text-sm">
            {promotions?"Consulta todas las promociones o explora el catálogo. Las nuevas ofertas aparecerán aquí.":"Prueba con otra búsqueda o revisa todas las categorías."}
          </p>
          {promotions && <div className="mt-4 flex flex-wrap justify-center gap-3"><Link href="/catalogo?promociones=1" className="btn-outline">Todas las promociones</Link><Link href="/catalogo" className="btn-primary">Ver catálogo completo</Link></div>}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                ...p,
                id: p.id,
                slug: p.slug,
                name: p.name,
                priceCents: p.priceCents,
                stock: p.stock,
                imageUrl: p.images[0]?.url ?? null,
                alt: p.images[0]?.alt,
              }}
            />
          ))}
        </div>
      )}
      {pages>1 && <nav className="mt-8 flex flex-wrap gap-3" aria-label="Páginas del catálogo">{Array.from({length:pages},(_,i)=><Link key={i} className="btn-outline" aria-current={page===i+1?"page":undefined} href={href(categoria,promotions,i+1)}>{i+1}</Link>)}</nav>}
    </div>
  );
}
