import Link from "next/link";
import { ArrowRight, Heart, MapPin, Star } from "lucide-react";

export default function HeroSection() {
  return <section className="hero-section">
    <div className="container-page grid items-center gap-12 py-12 lg:grid-cols-2 lg:gap-16 lg:py-16">
      <div className="relative z-10">
        <p className="eyebrow"><Star size={15} fill="currentColor" aria-hidden /> SU PRIMER UNIVERSO EMPIEZA AQUÍ</p>
        <h1 className="hero-title mt-6">Un pequeño mundo.<br /><em>Un amor infinito.</em></h1>
        <p className="mt-6 max-w-md text-base leading-7 text-brand-muted">Pañales, ropita y pequeños esenciales para acompañar sus grandes descubrimientos. Con cariño, desde Mocoa.</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/catalogo" className="btn-primary gap-3" data-testid="hero-cta">Explorar su mundo <ArrowRight size={17} /></Link>
          <Link href="/catalogo?categoria=panales" className="min-h-11 py-3 text-sm font-bold text-brand-primary underline decoration-brand-lavender underline-offset-4">Ver pañales</Link>
        </div>
        <div className="mt-9 flex flex-wrap items-center gap-4 border-t border-brand-line pt-5 text-xs font-semibold text-brand-muted"><span className="flex items-center gap-1.5"><MapPin size={14} /> Mocoa, Putumayo</span><span className="h-1 w-1 rounded-full bg-brand-lavender" aria-hidden /><span>Compra sin crear cuenta</span></div>
      </div>
      <div className="hero-image">
        <div className="hero-orbit" aria-hidden />
        <Star className="absolute -right-2 top-5 z-10 text-brand-primary" size={28} fill="#F5DB9A" aria-hidden />
        <img src="/images/products/branding-2026-10-02/hero.webp" alt="Esenciales para bebé en lavanda, rosa y marfil: ropita, tetero, pañales y osito" width={1600} height={1067} fetchPriority="high" className="h-full w-full object-cover" />
        <div className="hero-note"><span className="rounded-full bg-brand-rose p-2.5"><Heart size={21} /></span><span>Para sus primeros días.<br /><strong>Y todos los que vienen.</strong></span></div>
      </div>
    </div>
  </section>;
}
