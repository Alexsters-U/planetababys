import {randomBytes} from "node:crypto";
import {writeFile,readFile,appendFile} from "node:fs/promises";
const secret=()=>randomBytes(32).toString("hex");
const db=secret(),redis=secret();
const lines=[
 "APP_ENV=test","APP_PORT=3100","SITE_URL=http://localhost:3100","API_INTERNAL_URL=http://127.0.0.1:4400","API_PORT=4400",
 "COOKIE_SECURE=false","POSTGRES_USER=planetababys","POSTGRES_DB=planetababys_test",
 "POSTGRES_PASSWORD="+db,"REDIS_PASSWORD="+redis,
 "DATABASE_URL=postgresql://planetababys:"+db+"@127.0.0.1:5544/planetababys_test?schema=public",
 "REDIS_URL=redis://:"+redis+"@127.0.0.1:5638","JWT_SECRET="+secret(),"SESSION_SECRET="+secret(),
 "SEED_ADMIN_EMAIL=test@admin.com","SEED_ADMIN_PASSWORD=password","SEED_DEMO_CATALOG=true",
 "PAYMENT_MODE=test","WOMPI_ENV=test","WOMPI_PUBLIC_KEY=","WOMPI_PRIVATE_KEY=","WOMPI_INTEGRITY_KEY=",
 "WOMPI_EVENTS_KEY="+secret(),"SHIPPING_MODE=quote","SHIPPING_CENTS=0","SHIPPING_CONFIGURED=true","SHIPPING_ALLOWED_CITIES=*","UPLOAD_DIR=./uploads-test","TRUST_PROXY=false",
 "PROXY_SHARED_SECRET="+secret(),"INDEXING_ENABLED=false","CYPRESS_BASE_URL=http://localhost:3100",
];
try{await writeFile(".env.test",lines.join("\n")+"\n",{flag:"wx"});console.log(".env.test creada con secretos locales únicos");}
catch(error){
  if(error.code!=="EEXIST")throw error;
  const current=await readFile(".env.test","utf8");
  if(!/^PROXY_SHARED_SECRET=/m.test(current))await appendFile(".env.test","\nPROXY_SHARED_SECRET="+secret()+"\n");
  console.log(".env.test conservada; configuración de proxy verificada");
}
