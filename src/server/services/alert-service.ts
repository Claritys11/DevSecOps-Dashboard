import { AlertResourceType, AlertRuleType, AlertSeverity, ServerStatus, ServiceStatus, type ContainerRecord, type EndpointCheck, type ServerMetric, type SslCertificateCheck } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const cpuCritical = Number(process.env.ALERT_CPU_CRITICAL_PERCENT ?? 90);
const memoryCritical = Number(process.env.ALERT_MEMORY_CRITICAL_PERCENT ?? 90);
const diskCritical = Number(process.env.ALERT_DISK_CRITICAL_PERCENT ?? 85);
const sslExpiryDays = Number(process.env.ALERT_SSL_EXPIRING_DAYS ?? 14);
const endpointFailureThreshold = Number(process.env.ALERT_ENDPOINT_FAILURE_THRESHOLD ?? 3);
const agentStaleMinutes = Number(process.env.AGENT_STALE_AFTER_MINUTES ?? 2);
const serverOfflineMinutes = Number(process.env.SERVER_OFFLINE_AFTER_MINUTES ?? 10);

type AlertInput = {
  ruleType: AlertRuleType;
  resourceType: AlertResourceType;
  resourceId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  observedValue?: string;
  thresholdValue?: string;
};

function fingerprint(input: Pick<AlertInput, "ruleType" | "resourceType" | "resourceId">) {
  return `${input.ruleType}:${input.resourceType}:${input.resourceId}`;
}

export async function triggerAlert(input: AlertInput) {
  const key = fingerprint(input);
  const now = new Date();
  return prisma.alert.upsert({
    where: { fingerprint: key },
    update: {
      title: input.title,
      message: input.message,
      severity: input.severity,
      observedValue: input.observedValue,
      thresholdValue: input.thresholdValue,
      occurrenceCount: { increment: 1 },
      lastObservedAt: now,
      resolvedAt: null
    },
    create: {
      fingerprint: key,
      ruleType: input.ruleType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      title: input.title,
      message: input.message,
      severity: input.severity,
      observedValue: input.observedValue,
      thresholdValue: input.thresholdValue,
      triggeredAt: now,
      lastObservedAt: now
    }
  });
}

export async function resolveAlert(ruleType: AlertRuleType, resourceType: AlertResourceType, resourceId: string) {
  await prisma.alert.updateMany({
    where: {
      fingerprint: fingerprint({ ruleType, resourceType, resourceId }),
      resolvedAt: null
    },
    data: { resolvedAt: new Date() }
  });
}

export async function evaluateMetricAlerts(metric: ServerMetric) {
  await evaluateThreshold({
    ruleType: AlertRuleType.HIGH_CPU,
    value: metric.cpuUsagePercent,
    threshold: cpuCritical,
    title: "High CPU usage",
    unit: "%",
    resourceId: metric.serverId,
    host: metric.hostname
  });

  await evaluateThreshold({
    ruleType: AlertRuleType.HIGH_MEMORY,
    value: metric.memoryUsagePercent,
    threshold: memoryCritical,
    title: "High memory usage",
    unit: "%",
    resourceId: metric.serverId,
    host: metric.hostname
  });

  await evaluateThreshold({
    ruleType: AlertRuleType.HIGH_DISK,
    value: metric.storageUsagePercent,
    threshold: diskCritical,
    title: "High disk usage",
    unit: "%",
    resourceId: metric.serverId,
    host: metric.hostname
  });

  await resolveAlert(AlertRuleType.AGENT_STALE, AlertResourceType.SERVER, metric.serverId);
  await resolveAlert(AlertRuleType.SERVER_OFFLINE, AlertResourceType.SERVER, metric.serverId);
}

async function evaluateThreshold(input: {
  ruleType: AlertRuleType;
  value: number;
  threshold: number;
  title: string;
  unit: string;
  resourceId: string;
  host: string;
}) {
  if (input.value >= input.threshold) {
    await triggerAlert({
      ruleType: input.ruleType,
      resourceType: AlertResourceType.SERVER,
      resourceId: input.resourceId,
      title: `${input.title} on ${input.host}`,
      message: `${input.value.toFixed(1)}${input.unit} used (alert at ${input.threshold}${input.unit})`,
      severity: AlertSeverity.WARNING,
      observedValue: input.value.toFixed(1),
      thresholdValue: input.threshold.toString()
    });
  } else {
    await resolveAlert(input.ruleType, AlertResourceType.SERVER, input.resourceId);
  }
}

export async function evaluateEndpointAlert(endpointId: string, check: EndpointCheck) {
  const endpoint = await prisma.monitoredEndpoint.findUnique({ where: { id: endpointId } });
  if (!endpoint) return;

  const shouldAlert = check.status !== ServiceStatus.HEALTHY && endpoint.consecutiveFailures >= endpointFailureThreshold;
  if (shouldAlert) {
    await triggerAlert({
      ruleType: AlertRuleType.ENDPOINT_DOWN,
      resourceType: AlertResourceType.ENDPOINT,
      resourceId: endpointId,
      title: `${endpoint.name} is down`,
      message: check.error
        ? `${check.error} (${endpoint.consecutiveFailures} failed checks in a row)`
        : `Returned ${check.statusCode ?? "no response"}, expected ${endpoint.expectedStatus} (${endpoint.consecutiveFailures} failed checks in a row)`,
      severity: AlertSeverity.CRITICAL,
      observedValue: check.status,
      thresholdValue: `${endpointFailureThreshold} consecutive failures`
    });
    return;
  }

  await resolveAlert(AlertRuleType.ENDPOINT_DOWN, AlertResourceType.ENDPOINT, endpointId);
}

export async function evaluateSslAlert(endpointId: string, check: SslCertificateCheck) {
  if (check.daysUntilExpiry != null && check.daysUntilExpiry <= sslExpiryDays) {
    const endpoint = await prisma.monitoredEndpoint.findUnique({ where: { id: endpointId }, select: { name: true } });
    await triggerAlert({
      ruleType: AlertRuleType.SSL_EXPIRING,
      resourceType: AlertResourceType.SSL_CERTIFICATE,
      resourceId: endpointId,
      title: `Certificate for ${endpoint?.name ?? "endpoint"} expires soon`,
      message: `Expires in ${check.daysUntilExpiry} day(s). Renew it before then.`,
      severity: check.daysUntilExpiry <= 3 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      observedValue: check.daysUntilExpiry.toString(),
      thresholdValue: sslExpiryDays.toString()
    });
    return;
  }

  if (check.status === ServiceStatus.HEALTHY || check.error === "Endpoint is not HTTPS") {
    await resolveAlert(AlertRuleType.SSL_EXPIRING, AlertResourceType.SSL_CERTIFICATE, endpointId);
  }
}

/**
 * A container stopped with exit code 0 was usually stopped on purpose, so only
 * non-zero exits and dead containers count as problems.
 */
export function containerCrashed(state: string, status: string) {
  const normalizedState = state.toLowerCase();
  if (normalizedState === "dead") return true;
  if (normalizedState !== "exited" && !status.toLowerCase().startsWith("exited")) return false;
  const code = status.match(/exited \((-?\d+)\)/i)?.[1];
  return code == null || Number(code) !== 0;
}

export async function evaluateContainerAlert(container: ContainerRecord) {
  if (containerCrashed(container.state, container.status)) {
    await triggerAlert({
      ruleType: AlertRuleType.CONTAINER_EXITED,
      resourceType: AlertResourceType.CONTAINER,
      resourceId: `${container.serverId}:${container.dockerId}`,
      title: `Container ${container.name} crashed`,
      message: container.status,
      severity: container.protectionLevel === "PROTECTED" ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      observedValue: container.status,
      thresholdValue: "running"
    });
    return;
  }

  await resolveAlert(AlertRuleType.CONTAINER_EXITED, AlertResourceType.CONTAINER, `${container.serverId}:${container.dockerId}`);
}

export async function evaluateAgentFreshnessAlerts() {
  const now = Date.now();
  const servers = await prisma.server.findMany();

  for (const server of servers) {
    const ageForStatus = server.lastHeartbeatAt ? (now - server.lastHeartbeatAt.getTime()) / 60_000 : null;
    const status =
      ageForStatus == null ? ServerStatus.UNKNOWN
      : ageForStatus >= serverOfflineMinutes ? ServerStatus.OFFLINE
      : ageForStatus >= agentStaleMinutes ? ServerStatus.DEGRADED
      : ServerStatus.ONLINE;
    if (status !== server.status) {
      await prisma.server.update({ where: { id: server.id }, data: { status } });
    }

    // A server that was added but never connected is shown as "waiting for agent", not as an outage.
    if (!server.lastHeartbeatAt) {
      await resolveAlert(AlertRuleType.SERVER_OFFLINE, AlertResourceType.SERVER, server.id);
      continue;
    }

    const ageMinutes = (now - server.lastHeartbeatAt.getTime()) / 60_000;
    if (ageMinutes >= serverOfflineMinutes) {
      await triggerAlert({
        ruleType: AlertRuleType.SERVER_OFFLINE,
        resourceType: AlertResourceType.SERVER,
        resourceId: server.id,
        title: `${server.name} is offline`,
        message: `No data from the agent for ${Math.round(ageMinutes)} minutes`,
        severity: AlertSeverity.CRITICAL,
        observedValue: ageMinutes.toFixed(1),
        thresholdValue: serverOfflineMinutes.toString()
      });
      continue;
    }

    await resolveAlert(AlertRuleType.SERVER_OFFLINE, AlertResourceType.SERVER, server.id);

    if (ageMinutes >= agentStaleMinutes) {
      await triggerAlert({
        ruleType: AlertRuleType.AGENT_STALE,
        resourceType: AlertResourceType.SERVER,
        resourceId: server.id,
        title: `${server.name} stopped reporting`,
        message: `Last data arrived ${Math.round(ageMinutes)} minutes ago`,
        severity: AlertSeverity.WARNING,
        observedValue: ageMinutes.toFixed(1),
        thresholdValue: agentStaleMinutes.toString()
      });
    } else {
      await resolveAlert(AlertRuleType.AGENT_STALE, AlertResourceType.SERVER, server.id);
    }
  }
}
