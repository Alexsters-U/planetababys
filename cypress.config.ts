import {defineConfig} from "cypress";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {randomUUID,createHash} from "node:crypto";
import {PrismaClient} from "@prisma/client";
for(const line of readFileSync(".env.test","utf8").split(/\r?\n/)){const index=line.indexOf("=");if(index>0 && /^[A-Z_]+$/.test(line.slice(0,index)))process.env[line.slice(0,index)]=line.slice(index+1);}
if(process.env.APP_ENV!=="test" || !process.env.DATABASE_URL?.includes("/planetababys_test?")) throw new Error("Cypress exige la base aislada planetababys_test");
const db=new PrismaClient();
const api="http://localhost:4400";
const origin=process.env.SITE_URL!;
export default defineConfig({
  video:false,screenshotOnRunFailure:true,screenshotsFolder:"test-results/cypress/screenshots",
  e2e:{
    baseUrl:process.env.CYPRESS_BASE_URL??"http://localhost:3100",
    supportFile:"cypress/support/e2e.ts",specPattern:"cypress/e2e/**/*.cy.ts",
    defaultCommandTimeout:15000,retries:0,
    env:{ADMIN_EMAIL:"test@admin.com",ADMIN_PASSWORD:"password"},
    setupNodeEvents(on) {
      on("task",{
        async createShippingFixture(){
          return db.product.create({data:{name:"Envío UI "+randomUUID(),slug:"envio-ui-"+randomUUID(),priceCents:1200000,stock:5},select:{id:true,name:true,slug:true,priceCents:true,stock:true}});
        },
        async cleanupShippingFixture(fixture:{productId:string;quoteId?:string}){
          const product=await db.product.findUniqueOrThrow({where:{id:fixture.productId}});
          if(!product.name.startsWith("Envío UI "))throw new Error("Solo fixtures de envíos UI");
          if(fixture.quoteId){
            const quote=await db.shippingQuote.findUniqueOrThrow({where:{id:fixture.quoteId}});
            const input=quote.request as {items:{productId:string}[]};
            if(input.items.length!==1||input.items[0].productId!==product.id)throw new Error("Cotización ajena al fixture");
            await db.order.deleteMany({where:{shippingQuoteId:quote.id}});
            await db.shippingQuote.delete({where:{id:quote.id}});
          }
          await db.product.delete({where:{id:product.id}});return null;
        },
        async backendAvailability(action:"stop"|"start"){
          if(!["stop","start"].includes(action))throw new Error("Acción no permitida");
          execFileSync("docker",["compose","--env-file",".env.test","-p","pbb-validation","-f","docker-compose.yml","-f","docker-compose.test.yml",action,"backend"],{stdio:"pipe",timeout:30000});
          if(action==="start"){
            for(let attempt=0;attempt<40;attempt++){try{const health=await fetch(api+"/api/health");if(health.ok)return null;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
            throw new Error("La API de pruebas no recuperó disponibilidad");
          }
          return null;
        },
        recordPromotionFormat(browser:{date:string;money:string}){
          const script='console.log(JSON.stringify({date:new Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date("2026-10-04T04:59:00Z")),money:new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:2,maximumFractionDigits:2}).format(25000.50),node:process.version,icu:process.versions.icu}))';
          const server=JSON.parse(execFileSync("docker",["compose","--env-file",".env.test","-p","pbb-validation","-f","docker-compose.yml","-f","docker-compose.test.yml","exec","-T","frontend","node","-e",script],{encoding:"utf8"}));
          mkdirSync("docs/obsidian/evidence/promotions-2026-10-03",{recursive:true});
          writeFileSync("docs/obsidian/evidence/promotions-2026-10-03/format-diagnostics.json",JSON.stringify({server,browser,sameDate:server.date===browser.date,sameMoney:server.money===browser.money},null,2));return null;
        },
        async createPaidOrder(){
          const product=await db.product.create({data:{name:"Fixture E2E "+randomUUID(),slug:"fixture-"+randomUUID(),priceCents:1500000,stock:10}});
          const response=await fetch(api+"/api/orders",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,"Idempotency-Key":randomUUID()},body:JSON.stringify({
            items:[{productId:product.id,quantity:1}],customer:{name:"Cliente Prueba",phone:"3001234567",email:"e2e@example.com",address:"Calle 12 # 5-34",city:"Mocoa"},dataConsent:true,termsAccepted:true,
          })});
          if(!response.ok) throw new Error("No se pudo crear pedido E2E, HTTP "+response.status);
          const order=await response.json();
          const transaction={id:randomUUID(),reference:order.reference,status:"APPROVED",amount_in_cents:order.totalCents,currency:"COP",payment_method_type:"NEQUI"};
          const timestamp=Math.floor(Date.now()/1000);
          const properties=["transaction.id","transaction.status","transaction.amount_in_cents","transaction.reference","transaction.currency"];
          const checksum=createHash("sha256").update(transaction.id+transaction.status+transaction.amount_in_cents+transaction.reference+"COP"+timestamp+process.env.WOMPI_EVENTS_KEY).digest("hex");
          const payment=await fetch(api+"/api/webhooks/wompi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"transaction.updated",environment:"test",timestamp,data:{transaction},signature:{checksum,properties}})});
          if(!payment.ok) throw new Error("No se pudo aplicar webhook E2E");
          return {orderId:order.orderId,reference:order.reference,productId:product.id};
        },
        async orderStatus(id:string){return (await db.order.findUniqueOrThrow({where:{id}})).status;},
        async productByName(name:string){return db.product.findFirst({where:{name},select:{id:true,name:true,priceCents:true,stock:true}});},
        async promotionProduct(name:string){return db.product.findFirst({where:{name},select:{id:true,slug:true,priceCents:true,stock:true,promotionEnabled:true,promotionPriceCents:true,promotionStartsAt:true,promotionEndsAt:true}});},
        async expirePromotion(id:string){
          const p=await db.product.findUniqueOrThrow({where:{id}});
          if(!p.name.startsWith("Promoción UI "))throw new Error("Solo fixture de promociones");
          await db.product.update({where:{id},data:{promotionStartsAt:null,promotionEndsAt:new Date(Date.now()-1000)}});return null;
        },
        async promotionOrder(id:string){return db.order.findUniqueOrThrow({where:{id},select:{totalCents:true,shippingCents:true,items:{select:{productId:true,unitCents:true,quantity:true}},payments:{select:{amountInCents:true}}}});},
        async cleanupPromotion(fixture:{name:string;orderId?:string}){
          if(!fixture.name.startsWith("Promoción UI "))throw new Error("Solo fixture de promociones");
          if(fixture.orderId)await db.order.deleteMany({where:{id:fixture.orderId}});
          await db.product.deleteMany({where:{name:fixture.name}});return null;
        },
        async cleanupFixture(fixture:{orderId:string;productId:string}){
          await db.order.delete({where:{id:fixture.orderId}});
          await db.product.delete({where:{id:fixture.productId}});return null;
        },
      });
      on("after:run",()=>db.$disconnect());
    },
  },
});
