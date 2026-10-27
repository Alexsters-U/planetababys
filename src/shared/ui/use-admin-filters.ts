"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
/** Only whitelisted values from actionable dashboard links enter list requests. */
export default function useAdminFilters(defaults:Record<string,string>,allowed:Record<string,readonly string[]>){
  const params=useSearchParams(),signature=params.toString();
  function read(){const result={...defaults};for(const key of Object.keys(defaults)){const value=params.get(key);if(value!==null && (key==="q"?value.length<=100:allowed[key]?.includes(value)))result[key]=value;}return result;}
  const [filters,setFilters]=useState(read);
  useEffect(()=>{setFilters(read());},[signature]);
  return [filters,setFilters] as const;
}
