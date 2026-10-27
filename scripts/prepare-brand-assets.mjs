import sharp from "sharp";
import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const archive = "docs/assets/branding-2026-10-02";
const vault = "docs/obsidian/assets/branding-2026-10-02";
const target = "public/images/products/branding-2026-10-02";
const manifest = JSON.parse(await readFile(`${archive}/prompts.json`, "utf8"));
for (const dir of [archive + "/originals", vault, target]) await mkdir(dir, {recursive: true});
for (const asset of manifest.assets) {
  const original = `${archive}/originals/${asset.name}.png`;
  try { await readFile(original); } catch { await copyFile(asset.source, original); }
  await sharp(original).resize({width: asset.name === "hero" ? 1600 : 960, withoutEnlargement: true})
    .webp({quality: 88}).toFile(`${target}/${asset.name}.webp`);
  await copyFile(`${target}/${asset.name}.webp`, `${vault}/${asset.name}.webp`);
  const bytes = await readFile(`${target}/${asset.name}.webp`);
  const metadata = await sharp(bytes).metadata();
  asset.sha256 = createHash("sha256").update(bytes).digest("hex");
  asset.width = metadata.width; asset.height = metadata.height; asset.bytes = bytes.length;
  console.log(`${asset.name}: ${metadata.width}x${metadata.height}, ${bytes.length} bytes`);
}
await writeFile(`${archive}/prompts.json`, JSON.stringify(manifest, null, 2) + "\n");
await copyFile(`${archive}/prompts.json`, `${vault}/prompts.json`);
const thumbs = await Promise.all(manifest.assets.map(async (asset, index) => ({
  input: await sharp(`${target}/${asset.name}.webp`).resize(230, 230, {fit: "contain", background: "#FFF9F3"}).png().toBuffer(),
  left: (index % 4) * 230, top: Math.floor(index / 4) * 230,
})));
await sharp({create: {width: 920, height: 920, channels: 3, background: "#F1EAF8"}})
  .composite(thumbs).png().toFile("docs/obsidian/evidence/branding-2026-10-02/contact-sheet.png");
