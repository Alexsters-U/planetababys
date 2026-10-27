import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const mapping = JSON.parse(await readFile("src/shared/brand/catalog-images.json", "utf8"));
const manifest = JSON.parse(await readFile("docs/assets/branding-2026-10-02/prompts.json", "utf8"));
const catalogResponse = await fetch("http://localhost:4400/api/products?limit=48");
assert.equal(catalogResponse.status, 200);
const {products} = await catalogResponse.json();
const results = [];
for (const asset of manifest.assets) {
  const local = await readFile("public" + asset.file);
  assert.equal(createHash("sha256").update(local).digest("hex"), asset.sha256);
  const remote = await fetch("http://localhost:3100" + asset.file);
  assert.equal(remote.status, 200, asset.name);
  const bytes = Buffer.from(await remote.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, "Servidor debe servir la imagen actual: " + asset.name);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "webp");
  results.push({asset: asset.name, status: remote.status, width: metadata.width, height: metadata.height, sha256: asset.sha256});
}
for (const [slug, name] of Object.entries(mapping)) {
  const p = products.find(product => product.slug === slug);
  assert(p, "Producto esperado: " + slug);
  assert.equal(p.images[0]?.url, `/images/products/branding-2026-10-02/${name}.webp`, slug);
}
function luminance(hex) {
  const rgb = hex.match(/\w\w/g).map(value => parseInt(value,16)/255).map(v => v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722;
}
const contrasts = [
  ["Botón principal", "FFFFFF", "70508F"],
  ["Texto", "382C46", "FFF9F3"],
  ["Texto secundario", "716479", "FFF9F3"],
  ["Botón de producto", "54366F", "F1EAF8"],
  ["Texto secundario en lavanda", "716479", "F1EAF8"],
  ["Texto secundario en menta", "716479", "EAF5EE"],
].map(([use, foreground, background]) => {
  const a=luminance(foreground), b=luminance(background), ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  assert(ratio>=4.5, use + " debe alcanzar 4.5:1");
  return {use, foreground:"#"+foreground, background:"#"+background, ratio};
});
const report = {createdAt:new Date().toISOString(), images:results, demoProductsVerified:Object.keys(mapping).length, contrasts,
  scope:"Asset hashes, served WebP files, primary image URLs returned by live API and selected text contrasts. Not a complete accessibility audit."};
await writeFile("docs/obsidian/evidence/branding-2026-10-02/asset-audit.json", JSON.stringify(report,null,2));
console.log(`${results.length} WebP verificadas por HTTP y SHA-256; ${Object.keys(mapping).length} productos vinculados; ${contrasts.length} combinaciones de contraste >=4.5:1`);
