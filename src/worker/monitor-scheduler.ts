import "dotenv/config";
import os from "node:os";
import { prisma } from "@/lib/prisma";
import { checkEndpoint, checkSslCertificate } from "@/server/services/monitoring-service";
import { acquireSchedulerLock, releaseSchedulerLock } from "@/server/services/scheduler-lock-service";
import { evaluateAgentFreshnessAlerts } from "@/server/services/alert-service";

const pollSeconds = Number(process.env.MONITOR_WORKER_POLL_SECONDS ?? 15);
const lockSeconds = Number(process.env.MONITOR_WORKER_LOCK_SECONDS ?? 45);
const batchSize = Number(process.env.MONITOR_WORKER_BATCH_SIZE ?? 10);
const runOnce = process.env.MONITOR_WORKER_RUN_ONCE === "true";
const owner = `${os.hostname()}-${process.pid}`;
const lockId = "monitor-scheduler";

async function runDueChecks() {
  const acquired = await acquireSchedulerLock(lockId, owner, lockSeconds);
  if (!acquired) {
    console.info("monitor scheduler lock held by another worker");
    return;
  }

  try {
    await evaluateAgentFreshnessAlerts();
    const now = new Date();
    const endpoints = await prisma.monitoredEndpoint.findMany({
      where: {
        enabled: true,
        OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }]
      },
      orderBy: [{ nextCheckAt: "asc" }, { updatedAt: "asc" }],
      take: batchSize
    });

    for (const endpoint of endpoints) {
      try {
        const [httpCheck, sslCheck] = await Promise.all([checkEndpoint(endpoint.id), checkSslCertificate(endpoint.id)]);
        console.info("monitor check completed", {
          endpointId: endpoint.id,
          name: endpoint.name,
          status: httpCheck.status,
          sslStatus: sslCheck.status
        });
      } catch (error) {
        console.error("monitor check failed", {
          endpointId: endpoint.id,
          name: endpoint.name,
          error: error instanceof Error ? error.message : "unknown"
        });
      }
    }
  } finally {
    await releaseSchedulerLock(lockId, owner);
  }
}

async function main() {
  console.info("monitor scheduler starting", { owner, pollSeconds, batchSize, runOnce });
  do {
    await runDueChecks();
    if (runOnce) break;
    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000));
  } while (true);
}

main()
  .catch((error) => {
    console.error("monitor scheduler crashed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
