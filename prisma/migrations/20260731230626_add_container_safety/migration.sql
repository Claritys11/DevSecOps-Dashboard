-- CreateEnum
CREATE TYPE "ContainerProtectionLevel" AS ENUM ('PROTECTED', 'MANAGED', 'UNMANAGED', 'EPHEMERAL');

-- AlterTable
ALTER TABLE "ContainerRecord" ADD COLUMN     "protectionLevel" "ContainerProtectionLevel" NOT NULL DEFAULT 'UNMANAGED';

-- CreateTable
CREATE TABLE "ContainerActionIdempotency" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerActionIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContainerActionIdempotency_key_key" ON "ContainerActionIdempotency"("key");

-- CreateIndex
CREATE INDEX "ContainerActionIdempotency_createdAt_idx" ON "ContainerActionIdempotency"("createdAt");
