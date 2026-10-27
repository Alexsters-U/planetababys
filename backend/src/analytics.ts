import {Prisma} from "@prisma/client";
import {db} from "./db";
import {config} from "./config";
import {dashboardWindow,fillSalesDays,type DashboardDays,type DashboardSummary} from "../../src/shared/analytics";
import {promotionWhere} from "./promotions";

const eligible=Prisma.sql`
  WITH confirmed AS (
    SELECT "orderId", MIN("updatedAt") AS paid_at FROM payments
    WHERE status = 'APPROVED' GROUP BY "orderId"
  ), eligible AS (
    SELECT o.id, o."totalCents" - o."shippingCents" AS sales_cents, c.paid_at, 'WEB' AS channel
    FROM orders o JOIN confirmed c ON c."orderId" = o.id
    WHERE o.status IN ('PAID','PACKED','SHIPPED','DELIVERED') AND o."reviewRequired" = false
    UNION ALL
    SELECT s.id, s."totalCents" AS sales_cents, s."createdAt" AS paid_at, 'LOCAL' AS channel
    FROM store_sales s WHERE s.status = 'COMPLETED'
  )`;
type Aggregate={sales:bigint;count:bigint};
function integer(value:number|bigint) {const result=Number(value);if(!Number.isSafeInteger(result))throw new Error("Métrica fuera del rango seguro");return result;}

export async function dashboardSummary(days:DashboardDays,now=new Date()):Promise<DashboardSummary> {
  const window=dashboardWindow(days,now);
  const {start,end,previousStart,previousEnd}=window;
  return db.$transaction(async tx=>{
    const [current]=await tx.$queryRaw<Aggregate[]>(Prisma.sql`${eligible} SELECT COALESCE(SUM(sales_cents),0)::bigint AS sales, COUNT(*)::bigint AS count FROM eligible WHERE paid_at >= ${start} AND paid_at < ${end}`);
    const [previous]=await tx.$queryRaw<Aggregate[]>(Prisma.sql`${eligible} SELECT COALESCE(SUM(sales_cents),0)::bigint AS sales, COUNT(*)::bigint AS count FROM eligible WHERE paid_at >= ${previousStart} AND paid_at < ${previousEnd}`);
    const daily=await tx.$queryRaw<{date:string;sales:bigint;count:bigint}[]>(Prisma.sql`${eligible}
      SELECT ((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota')::date::text AS date,
        SUM(sales_cents)::bigint AS sales, COUNT(*)::bigint AS count FROM eligible
      WHERE paid_at >= ${start} AND paid_at < ${end} GROUP BY 1 ORDER BY 1`);
    const best=await tx.$queryRaw<{productId:string;name:string;quantity:bigint;sales:bigint}[]>(Prisma.sql`${eligible}, sale_lines AS (
      SELECT id, "productId", name, quantity, "unitCents", "orderId" AS sale_id, 'WEB' AS channel FROM order_items
      UNION ALL
      SELECT id, "productId", name, quantity, "unitCents", "saleId" AS sale_id, 'LOCAL' AS channel FROM store_sale_items
    ), ranked AS (
      SELECT i."productId", (array_agg(i.name ORDER BY e.paid_at DESC,i.id))[1] AS snapshot_name,
        SUM(i.quantity)::bigint AS quantity, SUM(i."unitCents"::bigint*i.quantity)::bigint AS sales
      FROM sale_lines i JOIN eligible e ON e.id=i.sale_id AND e.channel=i.channel WHERE e.paid_at >= ${start} AND e.paid_at < ${end}
      GROUP BY i."productId" ORDER BY quantity DESC, sales DESC, i."productId" LIMIT 5
    ) SELECT r."productId", r.quantity, r.sales, COALESCE(p.name,r.snapshot_name) AS name
      FROM ranked r LEFT JOIN products p ON p.id=r."productId" ORDER BY r.quantity DESC,r.sales DESC,r."productId"`);
    const channels=await tx.$queryRaw<{channel:string;sales:bigint;count:bigint}[]>(Prisma.sql`${eligible}
      SELECT channel, COALESCE(SUM(sales_cents),0)::bigint AS sales, COUNT(*)::bigint AS count FROM eligible
      WHERE paid_at >= ${start} AND paid_at < ${end} GROUP BY channel`);
    const created={createdAt:{gte:start,lt:end}};
    const placedOrders=await tx.order.count({where:created});
    const previousPlacedOrders=await tx.order.count({where:{createdAt:{gte:previousStart,lt:previousEnd}}});
    const confirmedCohort=await tx.order.count({where:{...created,status:{in:["PAID","PACKED","SHIPPED","DELIVERED"]},reviewRequired:false,payments:{some:{status:"APPROVED",updatedAt:{lt:end}}}}});
    const statuses=await tx.order.groupBy({by:["status"],where:created,_count:{_all:true},orderBy:{status:"asc"}});
    const productCount=await tx.product.count(),orderCount=await tx.order.count();
    const pendingOrders=await tx.order.count({where:{status:"PENDING"}});
    const paidCount=await tx.order.count({where:{status:{in:["PAID","PACKED","SHIPPED","DELIVERED"]}}});
    const visible=await tx.product.count({where:{isActive:true}});
    const lowStock=await tx.product.count({where:{isActive:true,stock:{gt:0,lte:5}}});
    const outOfStock=await tx.product.count({where:{isActive:true,stock:0}});
    const activePromotions=await tx.product.count({where:{isActive:true,AND:[promotionWhere("active",end)]}});
    const readyToPack=await tx.order.count({where:{status:"PAID",reviewRequired:false,payments:{some:{status:"APPROVED"}}}});
    const reviewRequired=await tx.order.count({where:{reviewRequired:true}});
    const recent=await tx.order.findMany({where:created,orderBy:[{createdAt:"desc"},{id:"desc"}],take:5,select:{id:true,reference:true,totalCents:true,status:true,createdAt:true}});
    const salesCents=integer(current.sales),paidOrders=integer(current.count),previousSalesCents=integer(previous.sales),previousPaidOrders=integer(previous.count);
    return {productCount,orderCount,pendingOrders,paidCount,generatedAt:end.toISOString(),testMode:config.PAYMENT_MODE==="test",
      period:{days,start:start.toISOString(),end:end.toISOString(),previousStart:previousStart.toISOString(),previousEnd:previousEnd.toISOString()},
      metrics:{salesCents,paidOrders,placedOrders,averageTicketCents:paidOrders?Math.round(salesCents/paidOrders):0,
        confirmationRate:placedOrders?Math.round(confirmedCohort*1000/placedOrders)/10:0,previousSalesCents,previousPaidOrders,previousPlacedOrders,
        previousAverageTicketCents:previousPaidOrders?Math.round(previousSalesCents/previousPaidOrders):0},
      dailySales:fillSalesDays(start,end,daily.map(row=>({date:row.date,salesCents:integer(row.sales),orders:integer(row.count)}))),
      orderStatuses:statuses.map(row=>({status:row.status,count:row._count._all})),
      topProducts:best.map(row=>({productId:row.productId,name:row.name,quantity:integer(row.quantity),salesCents:integer(row.sales)})),
      inventory:{visible,lowStock,outOfStock,activePromotions},operations:{readyToPack,reviewRequired},recentOrders:recent.map(o=>({...o,createdAt:o.createdAt.toISOString()})),
      channels:{web:{salesCents:integer(channels.find(row=>row.channel==="WEB")?.sales??0),completedSales:integer(channels.find(row=>row.channel==="WEB")?.count??0)},
        local:{salesCents:integer(channels.find(row=>row.channel==="LOCAL")?.sales??0),completedSales:integer(channels.find(row=>row.channel==="LOCAL")?.count??0)}}};
  },{isolationLevel:"RepeatableRead",timeout:15000});
}
