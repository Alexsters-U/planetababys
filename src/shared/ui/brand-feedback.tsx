import Link from "next/link";
import BrandScene from "./brand-scene";
import BrandIcon from "./brand-icon";
export default function BrandFeedback({kind,onRetry}:{kind:"404"|"error"|"admin";onRetry?:()=>void}){
  const missing=kind==="404",admin=kind==="admin";
  return <section className="container-page py-12 sm:py-16" data-testid={missing?"brand-404":"brand-error"}>
    <div className="brand-feedback grid items-center gap-8 rounded-[2rem] border border-brand-line bg-white p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:p-14">
      <div className="mx-auto w-full max-w-sm"><BrandScene variant={missing?"lost":"pause"}/></div>
      <div>
        <p className="eyebrow"><BrandIcon name="planet" size={19}/>{missing?"FUERA DE ÓRBITA · 404":admin?"CENTRO DE CUIDADO":"UN MOMENTO PARA RESPIRAR"}</p>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-brand-ink sm:text-4xl">{missing?"Este rincón del planeta aún no existe.":admin?"El panel necesita un pequeño descanso.":"Un pequeño descanso en nuestro planeta."}</h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-brand-muted">{missing?"Puede que el enlace haya cambiado o que el producto ya no esté disponible. Todavía hay mucho por descubrir para tu bebé.":admin?"No pudimos cargar esta información. Vuelve a intentarlo en un momento para continuar con tus productos y pedidos.":"No pudimos cargar esta página. Vuelve a intentarlo en un momento; tu carrito sigue guardado en este equipo."}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {missing?<Link href="/catalogo" className="btn-primary gap-2" data-testid="error-primary-link">Explorar catálogo <BrandIcon name="arrow" size={18}/></Link>:<button type="button" onClick={onRetry} className="btn-primary gap-2" data-testid="error-retry"><BrandIcon name="refresh" size={18}/>Volver a intentar</button>}
          <Link href={admin?"/admin":"/"} className="btn-outline" data-testid="error-home-link">{admin?"Volver al resumen":"Volver al inicio"}</Link>
        </div>
        <p className="mt-7 text-xs font-semibold text-brand-primary">Planeta Baby’s · Un universo de pequeños cuidados.</p>
      </div>
    </div>
  </section>;
}
