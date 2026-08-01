-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MAINTAINER';

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "agentVersion" TEXT,
ADD COLUMN     "architecture" TEXT,
ADD COLUMN     "kernel" TEXT,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "lastMetricAt" TIMESTAMP(3),
ADD COLUMN     "os" TEXT;

-- AlterTable
ALTER TABLE "ServerMetric" DROP COLUMN "networkRxKb",
DROP COLUMN "networkTxKb",
ADD COLUMN     "agentVersion" TEXT NOT NULL,
ADD COLUMN     "architecture" TEXT NOT NULL,
ADD COLUMN     "collectionId" TEXT NOT NULL,
ADD COLUMN     "cpuCoreCount" INTEGER NOT NULL,
ADD COLUMN     "hostname" TEXT NOT NULL,
ADD COLUMN     "kernel" TEXT NOT NULL,
ADD COLUMN     "loadAverage1" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "loadAverage15" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "loadAverage5" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "memoryUsagePercent" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "networkRxBytes" BIGINT NOT NULL,
ADD COLUMN     "networkTxBytes" BIGINT NOT NULL,
ADD COLUMN     "os" TEXT NOT NULL,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "storageUsagePercent" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "swapTotalMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "swapUsedMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "uptimeSeconds" BIGINT NOT NULL,
ALTER COLUMN "collectedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AgentCredential" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AgentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentNonce" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentCredential_agentId_key" ON "AgentCredential"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCredential_serverId_key" ON "AgentCredential"("serverId");

-- CreateIndex
CREATE INDEX "AgentNonce_createdAt_idx" ON "AgentNonce"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentNonce_credentialId_nonce_key" ON "AgentNonce"("credentialId", "nonce");

-- CreateIndex
CREATE INDEX "ServerMetric_collectedAt_idx" ON "ServerMetric"("collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServerMetric_serverId_collectionId_key" ON "ServerMetric"("serverId", "collectionId");

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentNonce" ADD CONSTRAINT "AgentNonce_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AgentCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
