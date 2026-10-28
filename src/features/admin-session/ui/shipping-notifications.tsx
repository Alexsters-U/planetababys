"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {newerNotices,type NoticeCursor,type ShippingNotice} from "@/shared/admin-notifications";

const Context=createContext({pendingCount:0,unavailable:false,openRequests:()=>{},refresh:()=>{}});
export const useShippingNotifications=()=>useContext(Context);
export default function ShippingNotifications({children}:{children:ReactNode}) {
  const router=useRouter();
  const [pendingCount,setPendingCount]=useState(0),[unavailable,setUnavailable]=useState(false);
  const refreshRef=useRef<()=>void>(()=>{}),memory=useRef(new Map<string,NoticeCursor>());
  const openRequests=useCallback(()=>{router.push("/admin/cotizaciones?status=REQUESTED&pageSize=25");window.dispatchEvent(new Event("pbb:shipping-open"));},[router]);
  const refresh=useCallback(()=>refreshRef.current(),[]);
  useEffect(()=>{
    let stopped=false,running=false,timer:ReturnType<typeof setTimeout>|undefined;
    const controller=new AbortController();
    async function sync(){
      if(stopped||running)return;
      clearTimeout(timer);
      if(document.visibilityState!=="visible"){timer=setTimeout(sync,15000);return;}
      running=true;let delay=15000;
      try{
        const response=await fetch("/api/admin/notifications",{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        if(response.status===401){router.replace("/admin/login");return;}
        if(response.status===429)delay=Math.max(delay,(Number(response.headers.get("retry-after"))||60)*1000+1000);
        if(!response.ok)throw new Error();
        const data=await response.json() as {viewerId:string;pendingCount:number;recent:ShippingNotice[]};
        if(stopped)return;
        const key=`pbb-shipping-notices:${data.viewerId}`;
        let cursor=memory.current.get(key)??null;
        try{const stored=JSON.parse(localStorage.getItem(key)??"null");if(stored&&typeof stored.id==="string"&&typeof stored.createdAt==="string"&&Number.isFinite(Date.parse(stored.createdAt)))cursor=stored;}catch{}
        const added=newerNotices(data.recent,cursor);
        const latest=data.recent[0];
        // El primer acceso establece la referencia; los pendientes siguen visibles en el contador.
        const next=latest&&(!cursor||newerNotices([latest],cursor).length)?{createdAt:latest.createdAt,id:latest.id}:cursor??{createdAt:new Date(0).toISOString(),id:""};
        memory.current.set(key,next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}
        setPendingCount(data.pendingCount);setUnavailable(false);
        if(added.length)toast.info(added.length===1?"Nueva solicitud de envío":"Nuevas solicitudes de envío",{
          id:`shipping-${latest.id}`,description:`${data.pendingCount} ${data.pendingCount===1?"solicitud por cotizar":"solicitudes por cotizar"}.`,duration:8000,
          action:{label:"Ver solicitudes",onClick:openRequests},
        });
      }catch{if(!stopped){setUnavailable(true);delay=Math.max(delay,30000);}}
      finally{running=false;if(!stopped)timer=setTimeout(sync,delay);}
    }
    refreshRef.current=()=>void sync();
    const visible=()=>{if(document.visibilityState==="visible")void sync();};
    document.addEventListener("visibilitychange",visible);window.addEventListener("pbb:shipping-changed",refresh);
    void sync();
    return()=>{stopped=true;controller.abort();clearTimeout(timer);document.removeEventListener("visibilitychange",visible);window.removeEventListener("pbb:shipping-changed",refresh);refreshRef.current=()=>{};};
  },[openRequests,refresh,router]);
  const value=useMemo(()=>({pendingCount,unavailable,openRequests,refresh}),[pendingCount,unavailable,openRequests,refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function ShippingPendingNotice(){
  const {pendingCount,unavailable,openRequests}=useShippingNotifications();
  return <>
    {pendingCount>0&&<div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" data-testid="shipping-pending-notice"><span><strong>{pendingCount}</strong> {pendingCount===1?"solicitud de envío por cotizar":"solicitudes de envío por cotizar"}</span><button type="button" className="font-bold underline underline-offset-4" onClick={openRequests}>Ver solicitudes</button></div>}
    {unavailable&&<p className="mb-4 text-xs text-brand-muted" role="status">Los avisos de envío están temporalmente sin actualizar. Puedes consultar Envíos manualmente.</p>}
  </>;
}
