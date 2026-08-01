-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('SERVER_OFFLINE', 'AGENT_STALE', 'ENDPOINT_DOWN', 'CONTAINER_EXITED', 'HIGH_CPU', 'HIGH_MEMORY', 'HIGH_DISK', 'SSL_EXPIRING');

-- CreateEnum
CREATE TYPE "AlertResourceType" AS ENUM ('SERVER', 'ENDPOINT', 'CONTAINER', 'SSL_CERTIFICATE');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedById" TEXT,
ADD COLUMN     "fingerprint" TEXT NOT NULL,
ADD COLUMN     "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "observedValue" TEXT,
ADD COLUMN     "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resourceId" TEXT NOT NULL,
ADD COLUMN     "resourceType" "AlertResourceType" NOT NULL,
ADD COLUMN     "ruleType" "AlertRuleType" NOT NULL,
ADD COLUMN     "thresholdValue" TEXT,
ADD COLUMN     "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Alert_fingerprint_key" ON "Alert"("fingerprint");

-- CreateIndex
CREATE INDEX "Alert_resolvedAt_severity_idx" ON "Alert"("resolvedAt", "severity");

-- CreateIndex
CREATE INDEX "Alert_ruleType_resourceType_resourceId_idx" ON "Alert"("ruleType", "resourceType", "resourceId");
