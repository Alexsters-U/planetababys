import {storeConfig} from "@/shared/api/store";
import {contactWhatsApp} from "@/shared/store-profile";
import {storeLocation} from "@/shared/brand/location";
import ContactEmail from "./contact-email";
import BrandIcon from "./brand-icon";
export default async function LegalIdentity(){
  const {legal}=await storeConfig();
  return <div className="card my-6 p-5 text-sm" data-testid="legal-identity"><h2 className="font-bold">Responsable y canales de atención</h2><dl className="mt-3 grid gap-2">
    <div><dt className="inline font-semibold">Responsable: </dt><dd className="inline">{legal.name||"Pendiente de definir"}</dd></div>
    <div><dt className="inline font-semibold">NIT: </dt><dd className="inline">{legal.taxId||"Pendiente de confirmar, si aplica"}</dd></div>
    <div><dt className="inline font-semibold">Dirección: </dt><dd className="inline">{legal.address}{" "}<a className="contact-icon-action ml-1 align-middle" href={storeLocation.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Ver local de Planeta Baby’s en Google Maps (se abre en otra pestaña)" title="Ver local en Google Maps" data-testid="legal-location"><BrandIcon name="location" size={18}/></a></dd></div>
    <div><dt className="inline font-semibold">Correo: </dt><dd className="inline"><ContactEmail email={legal.email}/></dd></div>
    <div><dt className="inline font-semibold">Teléfono: </dt><dd className="inline"><a className="underline" href={"tel:+57"+legal.phone.replace(/\D/g,"")}>{legal.phone}</a> · <a className="underline" href={contactWhatsApp(legal.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a></dd></div>
  </dl>{!legal.email && <p className="mt-4 text-amber-800">La información comercial está en preparación. El entorno de producción requiere completar estos campos.</p>}</div>;
}
