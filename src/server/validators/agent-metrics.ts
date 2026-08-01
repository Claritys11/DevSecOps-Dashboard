import { z } from "zod";

export const heartbeatSchema = z.object({
  agentVersion: z.string().min(1).max(80),
  hostname: z.string().min(1).max(255),
  os: z.string().min(1).max(255),
  kernel: z.string().min(1).max(255),
  architecture: z.string().min(1).max(80),
  collectedAt: z.string().datetime()
});

export const metricsSchema = heartbeatSchema.extend({
  collectionId: z.string().min(8).max(160),
  uptimeSeconds: z.number().int().nonnegative(),
  cpuUsagePercent: z.number().min(0).max(100),
  cpuCoreCount: z.number().int().positive(),
  memoryTotalMb: z.number().nonnegative(),
  memoryUsedMb: z.number().nonnegative(),
  memoryUsagePercent: z.number().min(0).max(100),
  swapTotalMb: z.number().nonnegative(),
  swapUsedMb: z.number().nonnegative(),
  storageTotalGb: z.number().nonnegative(),
  storageUsedGb: z.number().nonnegative(),
  storageUsagePercent: z.number().min(0).max(100),
  loadAverage1: z.number().nonnegative(),
  loadAverage5: z.number().nonnegative(),
  loadAverage15: z.number().nonnegative(),
  networkRxBytes: z.number().int().nonnegative(),
  networkTxBytes: z.number().int().nonnegative()
});

export type HeartbeatPayload = z.infer<typeof heartbeatSchema>;
export type MetricsPayload = z.infer<typeof metricsSchema>;
