import { MapPin, Navigation, ArrowUpRight } from "lucide-react";
import { directionsUrl, storeLocation } from "@/shared/brand/location";

export default function LocationSection() {
  return <section id="ubicacion" className="container-page scroll-mt-44 pb-16">
    <div className="card grid items-center gap-7 bg-brand-lilac/40 p-7 sm:p-10 md:grid-cols-[auto_1fr_auto]">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-lilac text-brand-primary" aria-hidden><MapPin size={35} /></span>
      <div><p className="eyebrow">CERQUITA DE TU FAMILIA</p><h2 className="editorial-title mt-3">Te esperamos en Mocoa</h2><p className="mt-3 max-w-lg text-sm leading-7 text-brand-muted">Visita Planeta Baby&apos;s y encuentra los esenciales para tu bebé. Consulta nuestra ubicación y elige tu ruta en Google Maps.</p></div>
      <div className="flex flex-col items-start gap-3">
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary gap-2" data-testid="store-directions" aria-label="Cómo llegar en Google Maps, abre una pestaña nueva"><Navigation size={17} /> Cómo llegar</a>
        <a href={storeLocation.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand-primary" aria-label="Ver ubicación de Planeta Baby’s en Google Maps, abre una pestaña nueva">Ver ubicación <ArrowUpRight size={16} /></a>
      </div>
    </div>
  </section>;
}
