import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { catalog, productBySlug } from "@/shared/api/server";
import ProductPrice from "@/shared/ui/product-price";
import { categoryLabel } from "@/lib/labels";
import AddToCart from "@/features/cart/ui/add-to-cart";
import ProductCard from "@/entities/product/ui/product-card";
import ProductImage from "@/shared/ui/product-image";
import { productImageUrl } from "@/shared/brand/product-images";

export const dynamic = "force-dynamic";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await productBySlug((await params).slug);
  if (!product) return { title: "Producto no encontrado" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const product = await productBySlug((await params).slug);
  if (!product || !product.isActive) notFound();

  const image = product.images[0];
  const related=(await catalog({category:product.category,limit:5})).products.filter(p=>p.id!==product.id).slice(0,4);

  return (
    <div className="container-page py-10">
      <nav className="mb-6 text-sm text-gray-500" aria-label="migas de pan">
        <Link href="/" className="hover:text-baby-pink-600">
          Inicio
        </Link>
        {" / "}
        <Link href="/catalogo" className="hover:text-baby-pink-600">
          Catálogo
        </Link>
        {" / "}
        <span className="text-gray-700">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="aspect-square w-full bg-baby-pink-50">
            <ProductImage slug={product.slug} url={image?.url} alt={image?.alt || product.name} priority />
          </div>
        </div>

        <div>
          <p className="badge bg-baby-blue-100 text-baby-blue-800">
            {categoryLabel(product.category)}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900">
            {product.name}
          </h1>
          <div className="mt-4"><ProductPrice product={product} large testId="product-detail-price"/></div>
          <p className="mt-2 text-sm">
            {product.stock > 0 ? (
              <span className="font-semibold text-mint-600">
                ✓ {product.stock} disponible{product.stock === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="font-semibold text-red-500">Agotado</span>
            )}
          </p>

          {product.description && (
            <p className="mt-6 whitespace-pre-line text-gray-700">
              {product.description}
            </p>
          )}

          <div className="mt-8 max-w-xs">
            <AddToCart
              withQuantity
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                promotionEnabled:product.promotionEnabled,promotionPriceCents:product.promotionPriceCents,
                promotionStartsAt:product.promotionStartsAt,promotionEndsAt:product.promotionEndsAt,pricingAsOf:product.pricingAsOf,
                imageUrl: productImageUrl(product.slug, image?.url),
                stock: product.stock,
              }}
            />
          </div>

          <div className="card mt-8 p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-800">🚚 Envío y entrega</p>
            <p className="mt-1">
              Coordinamos la entrega según tu dirección. El costo de envío se muestra antes del pago en Wompi.
            </p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="section-title">También te puede gustar</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
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
        </section>
      )}
    </div>
  );
}
