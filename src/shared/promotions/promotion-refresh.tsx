"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";

// Refresh the server-filtered list when an offer ends or the visitor returns.
export default function PromotionRefresh({ends}:{ends:(string|null|undefined)[]}) {
  const router=useRouter();
  const boundary=ends.map(value=>value?new Date(value).getTime():NaN).filter(value=>value>Date.now()).sort((a,b)=>a-b)[0];
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==="visible")router.refresh();};
    const interval=setInterval(refresh,60000);
    const timeout=Number.isFinite(boundary)?setTimeout(refresh,Math.min(2147483647,Math.max(0,boundary-Date.now())+50)):undefined;
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{clearInterval(interval);clearTimeout(timeout);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[router,boundary]);
  return null;
}
