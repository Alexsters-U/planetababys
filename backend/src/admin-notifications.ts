import {db} from "./db";

export async function shippingNotifications(viewerId:string) {
  const where={status:"REQUESTED",expiresAt:{gt:new Date()}};
  const result=await db.$transaction(async tx=>({
    pendingCount:await tx.shippingQuote.count({where}),
    recent:await tx.shippingQuote.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],take:20,
      select:{id:true,reference:true,createdAt:true}}),
  }),{isolationLevel:"RepeatableRead"});
  return {viewerId,...result};
}
