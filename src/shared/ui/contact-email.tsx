"use client";

import {useEffect,useRef,useState} from "react";
import BrandIcon from "./brand-icon";

/** HTTPS composition works without a system-level mailto handler. */
export function gmailComposeUrl(email:string){
  const query=new URLSearchParams({view:"cm",fs:"1",to:email});
  return `https://mail.google.com/mail/?${query}`;
}

export default function ContactEmail({email}:{email:string}){
  const [feedback,setFeedback]=useState<{kind:"success"|"error";message:string;phase:"visible"|"fading"}|null>(null);
  const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const request=useRef(0);
  function clearTimers(){timers.current.forEach(clearTimeout);timers.current=[];}
  useEffect(()=>()=>{clearTimers();request.current++;},[]);
  function notify(kind:"success"|"error",message:string){
    setFeedback({kind,message,phase:"visible"});
    const duration=kind==="success"?3000:8000;
    timers.current=[
      setTimeout(()=>setFeedback(current=>current?{...current,phase:"fading"}:null),duration-400),
      setTimeout(()=>setFeedback(null),duration),
    ];
  }
  async function copy(){
    const currentRequest=++request.current;
    clearTimers();
    setFeedback(null);
    try {
      if(!navigator.clipboard?.writeText)throw new Error();
      await navigator.clipboard.writeText(email);
      if(currentRequest===request.current)notify("success","Correo copiado.");
    }catch{if(currentRequest===request.current)notify("error","No pudimos copiarlo automáticamente. Selecciona la dirección visible y cópiala.");}
  }
  return <div className="inline-flex max-w-full flex-wrap items-center gap-x-1 align-middle text-sm" data-testid="contact-email">
    <a className="min-w-0 break-all underline underline-offset-2" href={gmailComposeUrl(email)} target="_blank" rel="noopener noreferrer"
      aria-label={`Escribir a ${email} en Gmail (se abre en otra pestaña)`} title="Escribir en Gmail" data-testid="contact-email-web">{email}</a>
    <span className="inline-flex max-w-full items-center gap-1.5">
      <button type="button" className="contact-icon-action" onClick={()=>void copy()} data-copied={feedback?.kind==="success"}
        aria-label={`Copiar correo ${email}`} title="Copiar correo" data-testid="contact-email-copy">
        <BrandIcon name={feedback?.kind==="success"?"check":"copy"} size={18}/>
      </button>
      <span className="contact-copy-feedback" data-kind={feedback?.kind} data-phase={feedback?.phase}
        role="status" aria-live="polite" aria-atomic="true" data-testid="contact-email-copy-status">{feedback?.message??""}</span>
    </span>
  </div>;
}
