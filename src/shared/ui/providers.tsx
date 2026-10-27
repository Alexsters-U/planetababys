"use client";
import {useEffect,type ReactNode} from "react";
import {Toaster} from "sonner";
import {useCartStore} from "@/features/cart/model/store";
export function Providers({children}:{children:ReactNode}) {
  useEffect(()=>{void Promise.resolve(useCartStore.persist.rehydrate()).finally(()=>useCartStore.getState().setHydrated());},[]);
  return <>{children}<Toaster className="pbb-toaster" position="bottom-right" richColors closeButton
    containerAriaLabel="Notificaciones" toastOptions={{duration:3500,closeButtonAriaLabel:"Cerrar notificación"}} /></>;
}
