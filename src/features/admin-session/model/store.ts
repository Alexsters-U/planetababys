"use client";
import {create} from "zustand";
type User={id:string;email:string};
export const useAdminSession=create<{user:User|null;ready:boolean;refresh:()=>Promise<void>;clear:()=>void}>(set=>({
  user:null,ready:false,
  refresh:async()=>{try{const res=await fetch("/api/auth/me",{cache:"no-store"});const data=await res.json();set({user:res.ok?data.user:null,ready:true});}catch{set({user:null,ready:true});}},
  clear:()=>set({user:null,ready:true}),
}));
