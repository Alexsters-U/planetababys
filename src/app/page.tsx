import Link from "next/link";
import { ArrowRight, Truck, ShieldCheck, ShoppingBag } from "lucide-react";
import { catalog } from "@/shared/api/server";
import ProductCard from "@/entities/product/ui/product-card";
import HeroSection from "@/widgets/home/ui/hero-section";
import CareBanner from "@/widgets/home/ui/care-banner";
import LocationSection from "@/widgets/home/ui/location-section";
import PromotionRefresh from "@/shared/promotions/promotion-refresh";
export const dynamic = "force-dynamic";
export const metadata={alternates:{canonical:"/"}};
const categories = [
  { key: "panales", title: "Pañales y cuidado", image: "panales-etapa-1", caption: "Suavidad para cada día", color: "bg-brand-lilac" },
  { key: "lactancia", title: "Alimentación", image: "tetero", caption: "Momentos llenos de conexión", color: "bg-brand-rose" },
  { key: "ropa", title: "Ropita para abrazar", image: "enterito", caption: "Sus primeros grandes looks", color: "bg-brand-mintLight" },
  { key: "higiene", title: "Higiene y bienestar", image: "kit-higiene", caption: "Cuidado en los pequeños detalles", color: "bg-brand-mintLight" },
  { key: "juguetes", title: "Jugar y descubrir", image: "osito", caption: "Un mundo por explorar", color: "bg-brand-lilac" },
  { key: "accesorios", title: "Aventuras juntos", image: "coche", caption: "Todo para acompañar su camino", color: "bg-brand-rose" },
];
export default async function HomePage() {
  const [{products},{products:promotions}]=await Promise.all([catalog({ featured:"true",limit:4 }),catalog({promotions:"true",limit:4})]);
  return <div>
    <PromotionRefresh ends={promotions.map(p=>p.promotionEndsAt as string|null|undefined)} />
    <HeroSection />
    <section className="border-b border-brand-line bg-white">
      <div className="container-page grid gap-5 py-7 sm:grid-cols-3">
        {[
          { icon: Truck, title: "Con cariño, hasta tu puerta", text: "Consulta la cobertura de entrega", color: "bg-brand-mintLight" },
          { icon: ShieldCheck, title: "Tu pago, en buenas manos", text: "Tu pago se verifica en Wompi", color: "bg-brand-lilac" },
          { icon: ShoppingBag, title: "Más fácil para ti", text: "Compra sin necesidad de registrarte", color: "bg-brand-rose" },
        ].map(({ icon: Icon, title, text, color }) => <div key={title} className="flex items-center gap-3"><span className={"rounded-2xl p-3 text-brand-primary " + color}><Icon size={21} aria-hidden /></span><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs text-brand-muted">{text}</p></div></div>)}
      </div>
    </section>
    <section className="container-page py-14 lg:py-16">
      <p className="eyebrow text-center">PARA CADA PEQUEÑA AVENTURA</p><h2 className="editorial-title mt-3 text-center">Todo un mundo para tu bebé</h2><p className="mt-3 text-center text-sm text-brand-muted">Encuentra justo lo que necesita, en cada etapa.</p>
      <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-6">
        {categories.map(c => <Link key={c.key} href={"/catalogo?categoria=" + c.key} className="category-card group">
          <div className={"aspect-[5/4] overflow-hidden rounded-3xl " + c.color}><img src={"/images/products/branding-2026-10-02/" + c.image + ".webp"} alt={c.title} width={960} height={960} loading="lazy" className="h-full w-full object-contain transition duration-500 group-hover:scale-105" /></div>
          <div className="mt-4 flex items-center justify-between gap-2"><div><h3 className="text-sm font-extrabold sm:text-base">{c.title}</h3><p className="mt-1 text-xs leading-5 text-brand-muted">{c.caption}</p></div><span className="category-arrow hidden rounded-full border border-brand-line p-2 text-brand-primary transition sm:block"><ArrowRight size={17} aria-hidden /></span></div>
        </Link>)}
      </div>
    </section>
    {promotions.length>0 && <section className="container-page pb-14" data-testid="home-promotions">
      <div className="rounded-3xl bg-brand-mintLight p-5 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">OFERTAS VIGENTES</p><h2 className="editorial-title mt-3">Promociones para tu bebé</h2><p className="mt-2 text-sm text-brand-muted">Los mismos cuidados, a un precio especial.</p></div>
        <Link href="/catalogo?promociones=1" className="btn-outline">Ver todas las promociones <ArrowRight size={16} aria-hidden/></Link>
      </div><div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{promotions.map(p=><ProductCard key={p.id} product={{...p,imageUrl:p.images[0]?.url??null,alt:p.images[0]?.alt}}/>)}</div></div>
    </section>}
    <section className="container-page pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">ELEGIDOS CON CARIÑO</p><h2 className="editorial-title mt-3">Pequeños esenciales, gran amor</h2></div><Link href="/catalogo" className="flex min-h-11 items-center gap-2 text-sm font-bold text-brand-primary">Ver todo el catálogo <ArrowRight size={17} /></Link></div>
      {products.length ? <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">{products.map(p => <ProductCard key={p.id} product={{ ...p, imageUrl: p.images[0]?.url ?? null, alt: p.images[0]?.alt }} />)}</div> : <p className="mt-8">Estamos preparando nuestra colección.</p>}
    </section>
    <CareBanner />
    <LocationSection />
  </div>;
}
