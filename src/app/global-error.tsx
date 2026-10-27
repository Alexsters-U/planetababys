"use client";
import "./globals.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/800.css";
import BrandFeedback from "@/shared/ui/brand-feedback";
export default function GlobalError(){return <html lang="es"><head><title>Volvamos a nuestro planeta · Planeta Baby’s</title><link rel="icon" href="/favicon.ico?v=20261002-transparent"/></head><body><main><BrandFeedback kind="error" onRetry={()=>window.location.reload()}/></main></body></html>;}
