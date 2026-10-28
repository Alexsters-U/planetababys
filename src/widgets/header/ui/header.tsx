"use client";
import Link from "next/link";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { useCart } from "@/features/cart/model/use-cart";
export default function Header() {
  const { count, hydrated } = useCart();
  return <>
    <div className="bg-brand-primary px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-white">Un universo de amor para tu bebé · Mocoa, Putumayo</div>
    <header className="sticky top-0 z-40 border-b border-brand-line bg-white/95 backdrop-blur-md">
      <div className="container-page flex h-24 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 sm:gap-3" aria-label="Planeta Baby's, inicio">
          <img src="/images/brand/logo-transparent.png" alt="" width={76} height={76} className="h-16 w-16 shrink-0 object-contain sm:h-[76px] sm:w-[76px]" />
          <span className="brand-wordmark">Planeta Baby&apos;s<span className="mt-1.5 hidden text-[9px] font-bold uppercase tracking-[0.12em] text-brand-muted sm:block">Todo para su mundo todo para su bienestar</span></span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-bold sm:gap-6" aria-label="Navegación principal">
          <Link href="/" className="hidden hover:text-brand-primary md:block">Inicio</Link>
          <Link href="/catalogo" className="hidden hover:text-brand-primary sm:block">Catálogo</Link>
          <Link href="/catalogo?promociones=1" className="hidden text-brand-primary hover:underline sm:block" data-testid="header-promotions">Promociones</Link>
          <Link href="/privacidad" className="hidden items-center gap-1 hover:text-brand-primary lg:flex">Tu tranquilidad <ArrowUpRight size={14} /></Link>
          <Link href="/carrito" className="relative flex min-h-11 items-center gap-2 rounded-full bg-brand-lilac px-3 py-2.5 text-brand-primary sm:px-4" aria-label="Ver carrito de compras"><ShoppingBag size={20} /><span className="hidden sm:block">Carrito</span>{hydrated && count > 0 && <span data-testid="cart-count" className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-xs text-white">{count}</span>}</Link>
        </nav>
      </div>
      <nav className="container-page flex flex-wrap gap-x-4 border-t border-brand-line py-2 text-xs font-bold text-brand-primary sm:hidden" aria-label="Navegación móvil"><Link className="flex min-h-9 items-center" href="/catalogo">Ver catálogo</Link><Link className="flex min-h-9 items-center" href="/catalogo?promociones=1">Promociones</Link><Link className="flex min-h-9 items-center" href="/catalogo?categoria=panales">Pañales</Link><Link className="flex min-h-9 items-center" href="/catalogo?categoria=ropa">Ropita</Link></nav>
    </header>
  </>;
}
