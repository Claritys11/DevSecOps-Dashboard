import { ServerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { HeartbeatPayload, MetricsPayload } from "@/server/validators/agent-metrics";
import { evaluateMetricAlerts, resolveAlert } from "@/server/services/alert-service";
import { AlertResourceType, AlertRuleType } from "@prisma/client";

const metricRetentionDays = Number(process.env.METRICS_RETENTION_DAYS ?? 30);

export async function recordAgentHeartbeat(serverId: string, payload: HeartbeatPayload) {
  const server = await prisma.server.update({
    where: { id: serverId },
    data: {
      hostname: payload.hostname,
      os: payload.os,
      kernel: payload.kernel,
      architecture: payload.architecture,
      agentVersion: payload.agentVersion,
      lastHeartbeatAt: new Date(payload.collectedAt),
      status: ServerStatus.ONLINE
    }
  });
  await resolveAlert(AlertRuleType.AGENT_STALE, AlertResourceType.SERVER, serverId);
  await resolveAlert(AlertRuleType.SERVER_OFFLINE, AlertResourceType.SERVER, serverId);
  return server;
}

export async function recordServerMetric(serverId: string, payload: MetricsPayload) {
  await cleanupOldMetrics();

  const metric = await prisma.serverMetric.create({
    data: {
      serverId,
      collectionId: payload.collectionId,
      hostname: payload.hostname,
      os: payload.os,
      kernel: payload.kernel,
      architecture: payload.architecture,
      uptimeSeconds: BigInt(payload.uptimeSeconds),
      cpuUsagePercent: payload.cpuUsagePercent,
      cpuCoreCount: payload.cpuCoreCount,
      memoryUsedMb: payload.memoryUsedMb,
      memoryTotalMb: payload.memoryTotalMb,
      memoryUsagePercent: payload.memoryUsagePercent,
      swapUsedMb: payload.swapUsedMb,
      swapTotalMb: payload.swapTotalMb,
      storageUsedGb: payload.storageUsedGb,
      storageTotalGb: payload.storageTotalGb,
      storageUsagePercent: payload.storageUsagePercent,
      loadAverage1: payload.loadAverage1,
      loadAverage5: payload.loadAverage5,
      loadAverage15: payload.loadAverage15,
      networkRxBytes: BigInt(payload.networkRxBytes),
      networkTxBytes: BigInt(payload.networkTxBytes),
      agentVersion: payload.agentVersion,
      collectedAt: new Date(payload.collectedAt)
    }
  });

  await prisma.server.update({
    where: { id: serverId },
    data: {
      hostname: payload.hostname,
      os: payload.os,
      kernel: payload.kernel,
      architecture: payload.architecture,
      agentVersion: payload.agentVersion,
      lastHeartbeatAt: new Date(payload.collectedAt),
      lastMetricAt: new Date(payload.collectedAt),
      status: ServerStatus.ONLINE
    }
  });

  await evaluateMetricAlerts(metric);
  return metric;
}

export async function cleanupOldMetrics() {
  if (!Number.isFinite(metricRetentionDays) || metricRetentionDays <= 0) return;
  const cutoff = new Date(Date.now() - metricRetentionDays * 24 * 60 * 60 * 1000);
  await prisma.serverMetric.deleteMany({
    where: { collectedAt: { lt: cutoff } }
  });
}
