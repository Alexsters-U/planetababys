import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";

export default function CareBanner() {
  return <section className="container-page pb-16">
    <div className="care-banner grid items-center gap-8 p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr]">
      <div><p className="eyebrow"><Star size={15} aria-hidden /> CERCA DE TI, EN CADA ETAPA</p><h2 className="editorial-title mt-4">Pequeños cuidados.<br />Grandes momentos.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-brand-muted">Somos Planeta Baby&apos;s. Yesica y su tienda en Mocoa te acompañan a encontrar los esenciales para los días en familia.</p><Link href="/catalogo" className="btn-primary mt-6 gap-2">Encuentra sus esenciales <ArrowRight size={16} /></Link></div>
      <div className="relative overflow-hidden rounded-[24px] bg-cream"><img src="/images/products/branding-2026-10-02/enterito.webp" alt="Enterito marfil de manga larga con detalles lavanda" width={960} height={960} loading="lazy" className="aspect-[4/3] w-full object-contain" /></div>
    </div>
  </section>;
}
