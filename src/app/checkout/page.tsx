"use client";

/**
 * Checkout como invitado: recoge ÚNICAMENTE los datos estrictamente
 * necesarios (nombre, teléfono, correo y dirección) y exige el
 * consentimiento del tratamiento de datos personales (Ley 1581/2012).
 * Al confirmar se crea la orden y se redirige a Wompi (Web Checkout).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/features/cart/model/use-cart";
import { formatCOP } from "@/lib/money";
import {checkoutSchema, LETTERS_PATTERN, LETTERS_MESSAGE, PHONE_PATTERN, PHONE_MESSAGE} from "@/shared/validation";
import {toast} from "sonner";
import { spanishValidation } from "@/shared/forms/spanish-validation";
import RestrictedInput from "@/shared/forms/restricted-input";
import {useCartQuote} from "@/features/cart/model/use-cart-quote";
import {useCartStore} from "@/features/cart/model/store";
import {contactWhatsApp,storeProfile} from "@/shared/store-profile";

const CITIES = [
  "Mocoa",
  "Puerto Asís",
  "Puerto Caicedo",
  "Villagarzón",
  "Orito",
  "Valle del Guamuez",
  "Bogotá",
  "Otra ciudad",
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, hydrated, subtotalCents, clear } = useCart();
  const {pricingReady,pricingError,refreshPrices}=useCartQuote();
  const requestKey=useRef<string|null>(null);
  const pendingPayload=useRef("");
  const pendingIdentity=useRef("");
  const [uncertain,setUncertain]=useState(false);
  const [shippingCents,setShippingCents]=useState(0);
  const [shippingMode,setShippingMode]=useState<"quote"|"fixed">("quote");
  const [contactPhone,setContactPhone]=useState(storeProfile.phone);
  const [requestedQuote,setRequestedQuote]=useState<{reference:string;id:string;token:string}|null>(null);
  const [shippingConfigured,setShippingConfigured]=useState(false);
  const [testMode,setTestMode]=useState(false);
  useEffect(()=>{fetch("/api/store/config").then(r=>{if(!r.ok)throw new Error();return r.json();}).then(c=>{setShippingCents(c.shippingCents??0);setShippingMode(c.shippingMode);setContactPhone(c.legal.phone);setShippingConfigured(c.shippingConfigured);setTestMode(c.paymentMode==="test");}).catch(()=>{});},[]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && items.length === 0 && !submitting) {
      router.replace("/carrito");
    }
  }, [hydrated, items.length, router, submitting]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      items: useCartStore.getState().items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        expectedUnitCents:i.priceCents,
      })),
      customer: {
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        address: String(form.get("address") ?? ""),
        city: String(form.get("city") ?? ""),
        notes: String(form.get("notes") ?? ""),
      },
      dataConsent: form.get("dataConsent") === "on",
      termsAccepted: form.get("terms") === "on",
    };

    const validated=checkoutSchema.safeParse(payload);
    if(!validated.success){const message=validated.error.issues[0]?.message??"Revisa los datos";setError(message);toast.error(message);setSubmitting(false);return;}
    const identity=JSON.stringify({...validated.data,items:validated.data.items.map(({productId,quantity})=>({productId,quantity}))});
    if(uncertain && identity!==pendingIdentity.current){setError("Primero reintenta la confirmación con los mismos datos y cantidades para recuperar tu pedido anterior.");setSubmitting(false);return;}
    if(!uncertain){
      const checkedPrices=await refreshPrices();
      if(!checkedPrices.ok || checkedPrices.changed){setSubmitting(false);return;}
    }
    const serialized=uncertain?pendingPayload.current:JSON.stringify(validated.data);
    if(pendingPayload.current!==serialized){requestKey.current=crypto.randomUUID();pendingPayload.current=serialized;pendingIdentity.current=identity;}
    try {
      const res = await fetch(shippingMode==="quote"?"/api/shipping/quotes":"/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current! },
        body: serialized,
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string;reference:string;id:string;token:string };
      if (!res.ok || (shippingMode==="fixed"&&!data.paymentUrl) || (shippingMode==="quote"&&!data.token)) {
        setUncertain(res.status>=500);
        setError(data.error ?? "No pudimos crear tu pedido. Inténtalo de nuevo.");
        toast.error(data.error ?? "No pudimos crear el pedido");
        setSubmitting(false);
        if(res.status===409)void refreshPrices();
        return;
      }
      if(shippingMode==="quote") {
        setRequestedQuote(data);setUncertain(false);setSubmitting(false);
        toast.success("Solicitud registrada. Continúa por WhatsApp para confirmar el envío.");
        return;
      }
      toast.success("Pedido recibido. Continuamos al pago");
      clear();
      window.location.assign(data.paymentUrl!);
    } catch {
      setUncertain(true);
      setError("No pudimos confirmar la respuesta. Verifica tu conexión y reintenta con los mismos datos para recuperar el pedido sin duplicarlo.");
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="container-page py-16 text-center text-gray-400">
        Cargando checkout...
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <h1 className="section-title">Finalizar compra</h1>
      <p className="mt-1 text-gray-600">
        Compra como invitado. Solo te pedimos los datos necesarios para
        entregarte el pedido.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <form
          {...spanishValidation}
          onSubmit={handleSubmit}
          className="card space-y-5 p-6 lg:col-span-2"
          data-testid="checkout-form"
          noValidate={false}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">
                Nombre completo *
              </label>
              <RestrictedInput restriction="letters"
                id="name"
                name="name"
                data-testid="checkout-name"
                required
                minLength={3}
                maxLength={80}
                pattern={LETTERS_PATTERN}
                data-format-message={LETTERS_MESSAGE}
                aria-describedby="checkout-name-help"
                className="input"
                placeholder="Ana María Gómez"
                autoComplete="name"
              />
              <p id="checkout-name-help" className="mt-1 text-xs text-gray-500">Nombre y apellido, sin números. Se permiten tildes y ñ.</p>
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Teléfono / WhatsApp *
              </label>
              <RestrictedInput restriction="phone"
                id="phone"
                name="phone"
                data-testid="checkout-phone"
                required
                className="input"
                placeholder="300 123 4567"
                type="tel"
                inputMode="tel"
                maxLength={25}
                pattern={PHONE_PATTERN}
                data-format-message={PHONE_MESSAGE}
                aria-describedby="checkout-phone-help"
                autoComplete="tel"
              />
              <p id="checkout-phone-help" className="mt-1 text-xs text-gray-500">10 dígitos de celular. Puedes incluir +57 y espacios.</p>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="label">
              Correo electrónico *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              maxLength={120}
              data-testid="checkout-email"
              required
              className="input"
              placeholder="ana@correo.com"
              autoComplete="email"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="address" className="label">
                Dirección exacta de entrega *
              </label>
              <input
                id="address"
                name="address"
                data-testid="checkout-address"
                required
                minLength={8}
                maxLength={250}
                className="input"
                placeholder="Calle 12 # 5-34, Barrio Centro, apto 302"
                autoComplete="street-address"
              />
            </div>
            <div>
              <label htmlFor="city" className="label">
                Ciudad *
              </label>
              <RestrictedInput restriction="letters" id="city" name="city" data-testid="checkout-city" required minLength={2} maxLength={60} pattern={LETTERS_PATTERN} data-format-message={LETTERS_MESSAGE} aria-describedby="checkout-city-help" className="input" defaultValue="Mocoa" autoComplete="address-level2" />
              <p id="checkout-city-help" className="mt-1 text-xs text-gray-500">Nombre de la ciudad, sin números.</p>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="label">
              Notas para el domicilio (opcional)
            </label>
            <textarea
              id="notes"
              name="notes"
              maxLength={300}
              rows={2}
              className="input"
              placeholder="Punto de referencia, horario preferido..."
            />
          </div>

          {/* Consentimientos legales obligatorios */}
          <div className="space-y-3 rounded-xl bg-baby-blue-50 p-4">
            <label className="flex items-start gap-3 text-sm" data-testid="consent-data">
              <input
                type="checkbox"
                name="dataConsent"
                data-required-message="Debes autorizar el tratamiento de tus datos personales para continuar."
                data-testid="checkout-data-consent"
                required
                className="mt-1 h-4 w-4"
              />
              <span>
                Autorizo el <strong>tratamiento de mis datos personales</strong>{" "}
                conforme a la Política de Privacidad y la{" "}
                <strong>Ley 1581 de 2012 (Habeas Data)</strong>.{" "}
                <Link href="/privacidad" target="_blank" className="text-baby-pink-600 underline">
                  Leer política
                </Link>{" "}
                *
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm" data-testid="consent-terms">
              <input
                type="checkbox"
                name="terms"
                data-required-message="Debes aceptar los términos y condiciones para continuar."
                data-testid="checkout-terms"
                required
                className="mt-1 h-4 w-4"
              />
              <span>
                Acepto los{" "}
                <Link href="/terminos" target="_blank" className="text-baby-pink-600 underline">
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/devoluciones" target="_blank" className="text-baby-pink-600 underline">
                  Política de Devoluciones
                </Link>
                . *
              </span>
            </label>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600" role="alert" data-testid="checkout-error">
              {error}
            </p>
          )}
          {pricingError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600" role="alert" data-testid="checkout-pricing-error">{pricingError} <Link href="/carrito" className="underline">Revisar carrito</Link> · <button type="button" className="underline" onClick={()=>void refreshPrices()}>Volver a comprobar</button></p>}

          {requestedQuote && <div className="rounded-xl bg-mint-50 p-4 text-sm" role="status" data-testid="shipping-request-result"><p className="font-bold">Solicitud {requestedQuote.reference} registrada</p><p className="mt-2">Envía esta referencia por WhatsApp. La tienda confirmará el costo y el plazo de entrega y te enviará un enlace para revisar el total antes de pagar. No se ha reservado inventario ni cobrado dinero.</p><a className="btn-primary mt-3" href={contactWhatsApp(contactPhone,`Hola, quiero cotizar el envío de mi compra. Mi referencia es ${requestedQuote.reference}.`)} target="_blank" rel="noopener noreferrer" data-testid="shipping-whatsapp">Continuar por WhatsApp</a><Link className="mt-3 block underline" href={`/cotizacion/${requestedQuote.id}?token=${requestedQuote.token}`}>Consultar mi cotización</Link></div>}

          <button
            type="submit"
            disabled={submitting || !shippingConfigured || (!pricingReady && !uncertain)}
            className="btn-primary w-full text-base disabled:opacity-50"
            data-testid="checkout-submit"
          >
            {submitting ? "Procesando..." : uncertain ? "Reintentar confirmación" : !pricingReady && !pricingError ? "Comprobando precios…" : shippingMode==="quote"?"Solicitar cotización del envío":"Confirmar y pagar de forma segura 💳"}
          </button>
          <p className="text-center text-xs text-gray-500">{!shippingConfigured?"Las solicitudes están temporalmente deshabilitadas.":shippingMode==="quote"?"Primero confirmamos el envío por WhatsApp. En Mocoa depende del domiciliario; fuera del municipio, de la transportadora.":testMode?"Entorno de demostración: se crea un pedido de prueba. No se cobra dinero.":"Serás redirigido a Wompi para completar el pago con los medios habilitados por el comercio."}</p>
        </form>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Tu pedido</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="text-gray-700">
                  {i.quantity}× {i.name}
                </span>
                <span className="shrink-0 font-medium">
                  {formatCOP(i.priceCents * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between text-sm"><span>Subtotal de productos</span><span>{formatCOP(subtotalCents)}</span></p>
          <p className="mt-4 flex justify-between text-sm"><span>Envío</span><span>{shippingMode==="quote"?"Por cotizar":shippingConfigured?formatCOP(shippingCents):"Por definir"}</span></p>
          <div className="mt-4 flex justify-between border-t border-gray-200 pt-4">
            <span className="font-bold">Total</span>
            <span className="font-extrabold text-baby-pink-700" data-testid="checkout-total">
              {shippingMode==="quote"?"Pendiente de cotización":formatCOP(subtotalCents+shippingCents)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
