import { prisma } from "@/lib/prisma";

export async function getDashboardOverview() {
  const [servers, endpoints, alerts, auditLogs, latestChecks] = await Promise.all([
    prisma.server.findMany({
      include: {
        metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
        containers: { orderBy: { lastSeenAt: "desc" }, take: 20 }
      },
      orderBy: { name: "asc" }
    }),
    prisma.monitoredEndpoint.findMany({
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 12 },
        sslChecks: { orderBy: { checkedAt: "desc" }, take: 1 }
      },
      orderBy: { name: "asc" }
    }),
    prisma.alert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.endpointCheck.findMany({ orderBy: { checkedAt: "desc" }, take: 30 })
  ]);

  return { servers, endpoints, alerts, auditLogs, latestChecks };
}
