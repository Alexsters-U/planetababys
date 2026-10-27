import { PrismaClient, Prisma } from "@prisma/client";
export const db = new PrismaClient({ log: ["error"] });
export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt=0; ; attempt++) {
    try { return await db.$transaction(work, { isolationLevel: "Serializable", timeout: 15000 }); }
    catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 3) throw error; }
  }
}
