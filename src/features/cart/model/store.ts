"use client";
import {create} from "zustand";
import {persist,createJSONStorage} from "zustand/middleware";
import {z} from "zod";
export type CartItem={productId:string;slug:string;name:string;priceCents:number;imageUrl:string|null;quantity:number;stock:number;originalPriceCents?:number|null;discountPercent?:number;promotionEndsAt?:string|null};
const cartItemSchema=z.object({
  productId:z.string().max(64),slug:z.string().max(160),name:z.string().max(120),
  priceCents:z.number().int().positive().max(2_000_000_000),imageUrl:z.string().max(300).nullable(),
  quantity:z.number().int().min(1).max(50),stock:z.number().int().min(0).max(100000),
  originalPriceCents:z.number().int().min(100).max(2_000_000_000).nullable().optional(),
  discountPercent:z.number().int().min(0).max(99).optional(),promotionEndsAt:z.string().max(80).nullable().optional(),
});
const cartSchema=z.array(cartItemSchema).max(30);
type CartState={
  items:CartItem[];hydrated:boolean;setHydrated:()=>void;
  addItem:(item:Omit<CartItem,"quantity">,quantity?:number)=>boolean;
  setQuantity:(id:string,quantity:number)=>void;removeItem:(id:string)=>void;clear:()=>void;
  applyQuote:(items:unknown)=>boolean;
};
export const useCartStore=create<CartState>()(persist((set,get)=>({
  items:[],hydrated:false,setHydrated:()=>set({hydrated:true}),
  addItem:(item,quantity=1)=>{
    const existing=get().items.find(i=>i.productId===item.productId);
    const max=Math.min(item.stock,50);
    if(!Number.isInteger(quantity) || quantity<1 || max===0 || (existing?.quantity??0)+quantity>max || (!existing && get().items.length>=30)) return false;
    set({items:existing?get().items.map(i=>i.productId===item.productId?{...item,quantity:i.quantity+quantity}:i):[...get().items,{...item,quantity}]});
    return true;
  },
  setQuantity:(id,quantity)=>{if(!Number.isFinite(quantity))return;set({items:get().items.map(i=>i.productId===id?{...i,quantity:Math.min(Math.max(1,Math.floor(quantity)),Math.min(i.stock,50))}:i).filter(i=>i.quantity>0)});},
  removeItem:id=>set({items:get().items.filter(i=>i.productId!==id)}),clear:()=>set({items:[]}),
  applyQuote:input=>{
    const quoted=z.array(cartItemSchema.omit({quantity:true})).max(30).parse(input);
    const changed=get().items.some(item=>quoted.find(row=>row.productId===item.productId)?.priceCents!==item.priceCents);
    set({items:get().items.map(item=>({...item,...quoted.find(row=>row.productId===item.productId)}))});
    return changed;
  },
}),{
  name:"pbb_cart_v2",storage:createJSONStorage(()=>localStorage),skipHydration:true,
  partialize:state=>({items:state.items}),
  merge:(persisted,current)=>{
    const parsed=cartSchema.safeParse((persisted as {items?:unknown})?.items);
    return {...current,items:parsed.success?parsed.data.filter(i=>i.stock>0 && i.quantity<=i.stock):[]};
  },
}));
