import catalogImages from "./catalog-images.json";

const legacy = new Set([
  "panales-ai.webp", "tetero-ai.webp", "ropa-ai.webp", "panales-1.svg",
  "biberones-1.svg", "lactancia-1.svg", "ropa-1.svg", "higiene-1.svg",
  "peluche-1.svg", "juguetes-1.svg", "coche-1.svg",
].map(file => "/images/products/" + file));

/** Also upgrades image URLs retained in older carts. Uploaded photos take precedence. */
export function productImageUrl(slug: string, url?: string | null): string | null {
  if (!url) return null;
  if (!legacy.has(url)) return url;
  const name = (catalogImages as Record<string, string>)[slug];
  return name ? `/images/products/branding-2026-10-02/${name}.webp` : null;
}
