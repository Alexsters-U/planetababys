"use client";
import {useEffect,useState} from "react";
import {getProductPricing,type PromotionSource} from "@/shared/promotions";

export function useProductPricing(product:PromotionSource) {
  const [now,setNow]=useState(()=>new Date(product.pricingAsOf??Date.now()));
  const start=product.promotionStartsAt?new Date(product.promotionStartsAt).getTime():0;
  const end=product.promotionEndsAt?new Date(product.promotionEndsAt).getTime():0;
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    function update(){
      const current=Date.now();setNow(new Date(current));
      const next=[start,end].filter(value=>value>current).sort((a,b)=>a-b)[0];
      if(next)timer=setTimeout(update,Math.min(next-current+20,2_147_000_000));
    }
    update();return()=>clearTimeout(timer);
  },[start,end,product.pricingAsOf]);
  return getProductPricing(product,now);
}
