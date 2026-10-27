import {readFile,readdir,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const results=[];
async function walk(directory){
  const entries=await readdir(directory,{withFileTypes:true}).catch(error=>{if(error.code==="ENOENT"&&directory.startsWith("docs/"))return [];throw error;});
  for(const item of entries){
    const file=directory+"/"+item.name;
    if(item.isDirectory()){if(!["node_modules","dist","originals",".obsidian"].includes(item.name))await walk(file);}
    else if(item.name!=="manifest.json" && /\.(ts|tsx|mjs|js|css|json|md|yml|yaml|toml|prisma|sql|webp|svg|png|ico|log|txt)$/.test(file)){results.push({file,sha256:createHash("sha256").update(await readFile(file)).digest("hex")});}
  }
}
for(const directory of ["src","backend/src","prisma","cypress","tests","scripts","public/images","docs/assets","docs/obsidian","docs/validation"])await walk(directory);
results.push({file:"public/favicon.ico",sha256:createHash("sha256").update(await readFile("public/favicon.ico")).digest("hex")});
for(const file of ["Dockerfile","backend/Dockerfile","docker-compose.yml","docker-compose.test.yml","pnpm-lock.yaml","pnpm-workspace.yaml","package.json","backend/package.json","tsconfig.json","cypress.config.ts","next.config.mjs","tailwind.config.ts","postcss.config.js",".env.example",".dockerignore",".gitignore","deploy/Caddyfile","README.md"])results.push({file,sha256:createHash("sha256").update(await readFile(file)).digest("hex")});
await mkdir("docs/validation",{recursive:true});
await writeFile("docs/validation/manifest.json",JSON.stringify({createdAt:new Date().toISOString(),files:results.sort((a,b)=>a.file.localeCompare(b.file))},null,2));
const names=await readdir("docs/obsidian").catch(error=>{if(error.code==="ENOENT")return [];throw error;});
const available=new Set(names.filter(n=>n.endsWith(".md")).map(n=>n.slice(0,-3)));
for(const name of names.filter(n=>n.endsWith(".md"))){const text=await readFile("docs/obsidian/"+name,"utf8");for(const match of text.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g))if(!available.has(match[1]))throw new Error("Enlace Obsidian sin destino: "+match[1]);}
console.log(results.length+" archivos registrados; todos los enlaces de la bóveda resuelven");
