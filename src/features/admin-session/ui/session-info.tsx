"use client";
import {useEffect} from "react";
import {useAdminSession} from "../model/store";
export default function SessionInfo(){
  const {user,refresh}=useAdminSession();
  useEffect(()=>{void refresh();},[refresh]);
  return <span className="hidden text-xs text-gray-500 md:block">{user?.email??"Verificando sesión..."}</span>;
}
