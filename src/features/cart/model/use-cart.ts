"use client";
import {useCartStore} from "@/features/cart/model/store";
export type {CartItem} from "@/features/cart/model/store";
export function useCart(){const state=useCartStore();return {...state,count:state.items.reduce((n,i)=>n+i.quantity,0),subtotalCents:state.items.reduce((n,i)=>n+i.priceCents*i.quantity,0)};}
