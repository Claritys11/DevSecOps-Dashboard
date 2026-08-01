-- AlterTable
ALTER TABLE "MonitoredEndpoint" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3),
ADD COLUMN     "nextCheckAt" TIMESTAMP(3),
ADD COLUMN     "timeoutMs" INTEGER NOT NULL DEFAULT 5000;

-- CreateTable
CREATE TABLE "SchedulerLock" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitoredEndpoint_enabled_nextCheckAt_idx" ON "MonitoredEndpoint"("enabled", "nextCheckAt");
