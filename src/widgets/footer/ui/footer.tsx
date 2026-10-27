import Link from "next/link";
import { storeConfig } from "@/shared/api/store";
import { Navigation } from "lucide-react";
import { directionsUrl } from "@/shared/brand/location";
import {contactWhatsApp} from "@/shared/store-profile";
import ContactEmail from "@/shared/ui/contact-email";
export default async function Footer() {
  const { legal, paymentMode } = await storeConfig();
  return <footer className="border-t border-brand-line bg-brand-lilac"><div className="container-page grid gap-8 py-12 sm:grid-cols-3">
    <div><p className="brand-wordmark">Planeta Baby&apos;s</p><p className="mt-4 text-sm leading-7 text-brand-muted">Un pequeño mundo. Un amor infinito.<br />Mocoa, Putumayo, Colombia.</p><a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-primary" data-testid="footer-directions"><Navigation size={16} /> Cómo llegar</a>{legal.phone && <p className="mt-3 text-sm">{legal.phone}</p>}{legal.email && <ContactEmail email={legal.email}/>}</div>
    <nav aria-label="Información legal"><h2 className="text-sm font-extrabold">Tu tranquilidad</h2><ul className="mt-4 space-y-3 text-sm text-brand-muted"><li><Link href="/terminos">Términos y condiciones</Link></li><li><Link href="/privacidad">Privacidad y tratamiento de datos</Link></li><li><Link href="/devoluciones">Cambios y devoluciones</Link></li><li><Link href="/admin/login">Administración</Link></li></ul></nav>
    <div><h2 className="text-sm font-extrabold">Te lo ponemos fácil</h2><p className="mt-4 text-sm leading-7 text-brand-muted">Compra como invitado. Cotizamos y confirmamos el envío por WhatsApp antes del pago; la tarifa depende del domiciliario o de la transportadora. Revisa el total y completa el pago en Wompi.</p><a className="mt-3 inline-block text-sm font-bold underline" href={contactWhatsApp(legal.phone)} target="_blank" rel="noopener noreferrer">Atención por WhatsApp</a>{paymentMode === "test" && <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-brand-muted">Modo de prueba · No se cobra dinero.</p>}</div>
  </div><div className="border-t border-brand-line py-5 text-center text-xs text-brand-muted">© 2026 Planeta Baby&apos;s · Con cariño, desde Mocoa</div></footer>;
}
