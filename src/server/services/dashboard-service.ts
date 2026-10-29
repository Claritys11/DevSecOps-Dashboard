import { prisma } from "@/lib/prisma";
import { endpointLabel, endpointTone, serverHealth, type Tone } from "@/lib/health";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LENGTH = 30;

export async function getEndpointUptime(endpointIds: string[], since = new Date(Date.now() - DAY_MS)) {
  if (endpointIds.length === 0) return new Map<string, number | null>();
  const groups = await prisma.endpointCheck.groupBy({
    by: ["endpointId", "status"],
    where: { endpointId: { in: endpointIds }, checkedAt: { gte: since } },
    _count: { _all: true }
  });

  const totals = new Map<string, { up: number; all: number }>();
  for (const group of groups) {
    const entry = totals.get(group.endpointId) ?? { up: 0, all: 0 };
    entry.all += group._count._all;
    if (group.status === "HEALTHY") entry.up += group._count._all;
    totals.set(group.endpointId, entry);
  }

  return new Map(endpointIds.map((id) => {
    const entry = totals.get(id);
    return [id, entry && entry.all > 0 ? (entry.up / entry.all) * 100 : null];
  }));
}

export async function getEndpointsWithHistory() {
  const endpoints = await prisma.monitoredEndpoint.findMany({
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: HISTORY_LENGTH, select: { status: true, statusCode: true, responseTimeMs: true, checkedAt: true, error: true } },
      sslChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
      server: { select: { id: true, name: true } }
    },
    orderBy: [{ enabled: "desc" }, { name: "asc" }]
  });
  const uptime = await getEndpointUptime(endpoints.map((endpoint) => endpoint.id));

  const toneOrder: Record<Tone, number> = { crit: 0, warn: 1, ok: 2, idle: 3 };
  return endpoints
    .map((endpoint) => ({
    ...endpoint,
    tone: endpointTone(endpoint.status, endpoint.enabled),
    label: endpointLabel(endpoint.status, endpoint.enabled),
    history: [...endpoint.checks].reverse(),
    latest: endpoint.checks[0] ?? null,
    ssl: endpoint.sslChecks[0] ?? null,
    uptime24h: uptime.get(endpoint.id) ?? null
    }))
    // Problems first, paused last, then alphabetical.
    .sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone] || a.name.localeCompare(b.name));
}

export async function getServersWithLatest() {
  const servers = await prisma.server.findMany({
    include: {
      metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
      agentCredential: { select: { agentId: true, lastUsedAt: true } },
      _count: { select: { containers: true, endpoints: true } }
    },
    orderBy: { name: "asc" }
  });

  return servers.map((server) => ({
    ...server,
    health: serverHealth(server.lastHeartbeatAt),
    latest: server.metrics[0] ?? null
  }));
}

export async function getDashboardOverview() {
  const [servers, endpoints, alerts, activity, containerStates] = await Promise.all([
    getServersWithLatest(),
    getEndpointsWithHistory(),
    prisma.alert.findMany({ where: { resolvedAt: null }, orderBy: [{ severity: "desc" }, { lastObservedAt: "desc" }], take: 50 }),
    prisma.auditLog.findMany({ include: { user: { select: { email: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.containerRecord.groupBy({ by: ["state"], _count: { _all: true } })
  ]);

  const openAlerts = alerts.filter((alert) => !alert.acknowledgedAt);
  const critical = openAlerts.filter((alert) => alert.severity === "CRITICAL").length;
  const warnings = openAlerts.length - critical;

  const strip: Array<{ id: string; href: string; name: string; kind: "Server" | "Endpoint"; tone: Tone; label: string }> = [
    ...servers.map((server) => ({ id: server.id, href: `/servers/${server.id}`, name: server.name, kind: "Server" as const, tone: server.health.tone, label: server.health.label })),
    ...endpoints.filter((endpoint) => endpoint.enabled).map((endpoint) => ({ id: endpoint.id, href: `/endpoints#${endpoint.id}`, name: endpoint.name, kind: "Endpoint" as const, tone: endpoint.tone, label: endpoint.label }))
  ];

  const containers = {
    total: containerStates.reduce((sum, group) => sum + group._count._all, 0),
    running: containerStates.find((group) => group.state.toLowerCase() === "running")?._count._all ?? 0
  };

  const soonestCertificate = endpoints
    .filter((endpoint) => endpoint.ssl?.daysUntilExpiry != null)
    .sort((a, b) => (a.ssl!.daysUntilExpiry ?? 0) - (b.ssl!.daysUntilExpiry ?? 0))[0];

  return { servers, endpoints, alerts, openAlerts, critical, warnings, activity, strip, containers, soonestCertificate };
}
