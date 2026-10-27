"use client";
import { useState } from "react";
import { productImageUrl } from "@/shared/brand/product-images";

export default function ProductImage({ slug, url, alt, priority = false }: {
  slug: string; url?: string | null; alt: string; priority?: boolean;
}) {
  const src = productImageUrl(slug, url);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!src || failedUrl === src) return <div className="flex h-full items-center justify-center p-2 text-center text-xs text-brand-muted">Fotografía pendiente</div>;
  return <div className="relative h-full w-full">
    <img src={src} alt={alt.replace(/\s*·\s*imagen ilustrativa generada por IA/gi, "")} width={960} height={960}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailedUrl(src)} className="h-full w-full object-contain transition duration-500" />
  </div>;
}
