/** Deliberately limited to the isolated demo DB. Does not overwrite uploaded photos. */
import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
const url = new URL(process.env.DATABASE_URL ?? "");
if (process.env.APP_ENV !== "test" || url.pathname !== "/planetababys_test" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5544") {
  throw new Error("Solo se permite la base local aislada planetababys_test en puerto 5544 y APP_ENV=test");
}
const mapping = JSON.parse(await readFile("src/shared/brand/catalog-images.json", "utf8"));
const legacy = /^\/images\/products\/(?:panales-ai|tetero-ai|ropa-ai)\.webp$|^\/images\/products\/[\w-]+-1\.svg$/;
const db = new PrismaClient();
try {
  const changes = [];
  for (const [slug, name] of Object.entries(mapping)) {
    const nextUrl = `/images/products/branding-2026-10-02/${name}.webp`;
    await access("public" + nextUrl);
    const product = await db.product.findUnique({where: {slug}, include: {images: {orderBy: {sort: "asc"}}}});
    if (!product) throw new Error("Producto demo ausente: " + slug);
    const image = product.images[0];
    if (!image || !legacy.test(image.url)) {
      console.log(slug + ": conservado (sin imagen, personalizado o ya actualizado)");
      continue;
    }
    changes.push({id: image.id, slug, previous: {url: image.url, alt: image.alt}, next: {url: nextUrl, alt: product.name + " · imagen ilustrativa generada por IA"}});
  }
  const evidence = "docs/obsidian/evidence/branding-2026-10-02";
  await mkdir(evidence, {recursive: true});
  const file = `${evidence}/image-migration-${Date.now()}.json`;
  await writeFile(file, JSON.stringify({createdAt: new Date().toISOString(), database: "planetababys_test", changes}, null, 2));
  await db.$transaction(changes.map(change => db.productImage.updateMany({
    where: {id: change.id, url: change.previous.url}, data: change.next,
  })));
  for (const change of changes) {
    const actual = await db.productImage.findUniqueOrThrow({where: {id: change.id}});
    if (actual.url !== change.next.url) throw new Error("No coincide la imagen persistida: " + change.slug);
  }
  console.log(`${changes.length} imágenes actualizadas y verificadas directamente en PostgreSQL. Reversión: ${file}`);
} finally { await db.$disconnect(); }
