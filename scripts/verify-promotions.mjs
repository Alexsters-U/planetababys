import {PrismaClient} from "@prisma/client";
import {writeFile} from "node:fs/promises";
const db=new PrismaClient();
if(process.env.APP_ENV!=="test" || !process.env.DATABASE_URL?.includes("/planetababys_test?"))throw new Error("Solo base aislada planetababys_test");
try{
  const [products,orders,promotions,fixtures,migrations]=await Promise.all([
    db.product.count(),db.order.count(),db.product.count({where:{promotionEnabled:true}}),
    db.product.findMany({where:{OR:[{name:{startsWith:"Promoción UI "}},{name:{startsWith:"Promoción API "}}]},select:{id:true,name:true,createdAt:true}}),
    db.$queryRaw`SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY started_at`,
  ]);
  const report={checkedAt:new Date().toISOString(),products,orders,configuredPromotions:promotions,remainingFixtures:fixtures,migrations};
  await writeFile("docs/obsidian/evidence/promotions-2026-10-03/database-verification.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(fixtures.length)process.exitCode=1;
}finally{await db.$disconnect();}
