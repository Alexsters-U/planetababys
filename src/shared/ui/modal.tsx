"use client";
import {useEffect,useRef,type ReactNode} from "react";

// El diálogo nativo entra en la capa superior del navegador y gestiona foco y Escape.
export default function Modal({children,label,onClose}:{children:ReactNode;label:string;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow="hidden";
    return ()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <dialog ref={dialog} aria-label={label} onCancel={event=>{event.preventDefault();onClose();}}
    className="m-auto max-h-[95vh] w-full max-w-2xl overflow-y-auto bg-transparent p-4 backdrop:bg-black/40">
    {children}
  </dialog>;
}
