"use client";

import Link from "next/link";
import { useCart } from "@/features/cart/model/use-cart";
import { formatCOP } from "@/lib/money";
import ProductImage from "@/shared/ui/product-image";
import {PriceDisplay} from "@/shared/ui/product-price";
import {useCartQuote} from "@/features/cart/model/use-cart-quote";

export default function CarritoPage() {
  const { items, hydrated, subtotalCents, setQuantity, removeItem, clear } =
    useCart();
  const {pricingReady,pricingError,refreshPrices}=useCartQuote();

  if (!hydrated) {
    return (
      <div className="container-page py-16 text-center text-gray-400">
        Cargando carrito...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-6xl" aria-hidden>
          🛒
        </p>
        <h1 className="mt-4 text-2xl font-bold text-gray-800">
          Tu carrito está vacío
        </h1>
        <p className="mt-2 text-gray-600">
          Explora nuestro catálogo y encuentra lo mejor para tu bebé.
        </p>
        <Link href="/catalogo" className="btn-primary mt-6 inline-block">
          Ir al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <h1 className="section-title">Tu carrito</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.productId}
              data-testid="cart-item"
              className="card flex gap-4 p-4"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-baby-pink-50">
                <ProductImage slug={item.slug} url={item.imageUrl} alt={item.name} />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/producto/${item.slug}`}
                    className="font-semibold text-gray-800 hover:text-baby-pink-600"
                  >
                    {item.name}
                  </Link>
                  <button
                    type="button"
                    data-testid="cart-remove"
                    onClick={() => removeItem(item.productId)}
                    className="text-sm text-red-500 hover:underline"
                    aria-label={`Eliminar ${item.name} del carrito`}
                  >
                    Eliminar
                  </button>
                </div>
                <div className="my-2"><PriceDisplay priceCents={item.priceCents} originalPriceCents={item.originalPriceCents} discountPercent={item.discountPercent} endsAt={item.promotionEndsAt} testId="cart-unit-price"/><p className="text-xs text-brand-muted">Por unidad</p></div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-gray-300">
                    <button
                      type="button"
                      className="px-3 py-1 text-gray-600 hover:text-baby-pink-600"
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      aria-label="Disminuir"
                    >
                      −
                    </button>
                    <span
                      data-testid="cart-qty"
                      className="w-10 border-x border-gray-300 py-1 text-center text-sm"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1 text-gray-600 hover:text-baby-pink-600"
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>
                  <p className="font-bold text-gray-900" data-testid="cart-line-total">
                    {formatCOP(item.priceCents * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={clear}
            className="text-sm text-gray-500 hover:text-red-500 hover:underline"
          >
            Vaciar carrito
          </button>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-gray-900">Resumen</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Subtotal</dt>
              <dd data-testid="cart-subtotal" className="font-semibold">
                {formatCOP(subtotalCents)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Envío</dt>
              <dd className="text-gray-600">Se confirma por WhatsApp</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-between border-t border-gray-200 pt-4 text-base">
            <span className="font-bold">Total productos</span>
            <span className="font-extrabold text-baby-pink-700" data-testid="cart-total">
              {formatCOP(subtotalCents)}
            </span>
          </div>
          {pricingError && <p role="alert" className="mt-4 text-sm text-red-600" data-testid="cart-pricing-error">{pricingError} <button type="button" className="underline" onClick={()=>void refreshPrices()}>Volver a comprobar</button></p>}
          {pricingReady ? <Link
            href="/checkout"
            className="btn-primary mt-6 block w-full text-center"
            data-testid="go-checkout"
          >
            Continuar al checkout →
          </Link> : <button className="btn-primary mt-6 w-full opacity-50" disabled data-testid="go-checkout">{pricingError?"Revisa tu carrito":"Comprobando precios…"}</button>}
          <p className="mt-3 text-center text-xs text-gray-500">
            Compra como invitado, sin crear cuenta.
          </p>
        </aside>
      </div>
    </div>
  );
}
