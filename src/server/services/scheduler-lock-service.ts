import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function acquireSchedulerLock(id: string, owner: string, lockSeconds: number) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + lockSeconds * 1000);

  const updated = await prisma.schedulerLock.updateMany({
    where: {
      id,
      lockedUntil: { lt: now }
    },
    data: { owner, lockedUntil }
  });

  if (updated.count > 0) return true;

  const existing = await prisma.schedulerLock.findUnique({ where: { id } });
  if (existing) return false;

  try {
    await prisma.schedulerLock.create({
      data: { id, owner, lockedUntil }
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}

export async function releaseSchedulerLock(id: string, owner: string) {
  await prisma.schedulerLock.updateMany({
    where: { id, owner },
    data: { lockedUntil: new Date(0) }
  });
}
