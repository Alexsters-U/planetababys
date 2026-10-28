import { PrismaClient, Prisma } from "@prisma/client";
export const db = new PrismaClient({ log: ["error"] });
export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt=0; ; attempt++) {
    try { return await db.$transaction(work, { isolationLevel: "Serializable", timeout: 15000 }); }
    catch (error) {
      const retryable=error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code==="P2034" || (error.code==="P2010" && ["40001","40P01"].includes(String(error.meta?.code))));
      if(!retryable || attempt>=3)throw error;
      await new Promise(resolve=>setTimeout(resolve,10*(attempt+1)+Math.random()*20));
    }
  }
}
