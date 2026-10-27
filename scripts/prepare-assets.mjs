import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
const sources=[
 ["panales-ai","exec-e06b8e8e-3901-4361-968f-a8be05acb0f3.png"],
 ["tetero-ai","exec-db89b010-b233-475a-b075-a5395ff5fe02.png"],
 ["ropa-ai","exec-36678996-c2bf-4c44-ae45-720dcec34218.png"],
 ["hero-ai","exec-96656ded-35fe-43dd-909d-1c96177ade56.png"],
];
const source=process.argv[2]??"docs/assets/originals";
await fs.mkdir("public/images/products",{recursive:true});
await fs.mkdir("docs/assets/originals",{recursive:true});
for(const [name,file] of sources){
  let original=path.join(source,name+".png");
  try{await fs.access(original);}catch{original=path.join(source,file);}
  const archived="docs/assets/originals/"+name+".png";
  if(path.resolve(original)!==path.resolve(archived))await fs.copyFile(original,archived);
  await sharp(original).resize(name==="hero-ai"?1600:900).webp({quality:85}).toFile("public/images/products/"+name+".webp");
  console.log(name+" convertido a WebP");
}
