"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {toast} from "sonner";
import {useCartStore} from "./store";

type Result={ok:boolean;changed:boolean};
class QuoteError extends Error {}
const signature=()=>useCartStore.getState().items.map(item=>`${item.productId}:${item.quantity}`).join("|");
export function useCartQuote() {
  const hydrated=useCartStore(state=>state.hydrated);
  const key=useCartStore(state=>state.items.map(item=>`${item.productId}:${item.quantity}`).join("|"));
  const [pricingReady,setReady]=useState(false);
  const [pricingError,setError]=useState<string|null>(null);
  const mounted=useRef(true);
  const pending=useRef<{key:string;promise:Promise<Result>}|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const refreshPrices=useCallback(():Promise<Result>=>{
    const currentKey=signature();
    if(!currentKey)return Promise.resolve({ok:true,changed:false});
    if(pending.current?.key===currentKey)return pending.current.promise;
    const items=useCartStore.getState().items.map(({productId,quantity})=>({productId,quantity}));
    const promise=(async()=>{
      try {
        const response=await fetch("/api/cart/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items}),signal:AbortSignal.timeout(10000)});
        const data=await response.json();
        if(!mounted.current || signature()!==currentKey)return {ok:false,changed:false};
        if(!response.ok)throw new QuoteError(data.error??"No pudimos comprobar los precios. Inténtalo de nuevo.");
        const changed=useCartStore.getState().applyQuote(data.items);
        setReady(true);setError(null);
        if(changed)toast.info("Actualizamos los precios de tu carrito. Revisa el total antes de confirmar.");
        return {ok:true,changed};
      }catch(error){
        if(mounted.current && signature()===currentKey){setReady(false);setError(error instanceof QuoteError ? error.message : "No pudimos comprobar los precios. Verifica tu conexión.");}
        return {ok:false,changed:false};
      }finally{if(pending.current?.key===currentKey)pending.current=null;}
    })();
    pending.current={key:currentKey,promise};return promise;
  },[]);
  useEffect(()=>{
    setReady(false);setError(null);
    if(!hydrated || !key)return;
    void refreshPrices();
    const refresh=()=>{if(document.visibilityState==="visible")void refreshPrices();};
    const interval=setInterval(refresh,15000);
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{clearInterval(interval);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[hydrated,key,refreshPrices]);
  return {pricingReady,pricingError,refreshPrices};
}
