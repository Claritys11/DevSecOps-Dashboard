import { AlertResourceType, AlertRuleType, AlertSeverity, ServiceStatus, type ContainerRecord, type EndpointCheck, type ServerMetric, type SslCertificateCheck } from "@prisma/client";
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
    resourceId: metric.serverId
  });

  await evaluateThreshold({
    ruleType: AlertRuleType.HIGH_MEMORY,
    value: metric.memoryUsagePercent,
    threshold: memoryCritical,
    title: "High memory usage",
    unit: "%",
    resourceId: metric.serverId
  });

  await evaluateThreshold({
    ruleType: AlertRuleType.HIGH_DISK,
    value: metric.storageUsagePercent,
    threshold: diskCritical,
    title: "High disk usage",
    unit: "%",
    resourceId: metric.serverId
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
}) {
  if (input.value >= input.threshold) {
    await triggerAlert({
      ruleType: input.ruleType,
      resourceType: AlertResourceType.SERVER,
      resourceId: input.resourceId,
      title: input.title,
      message: `${input.title}: ${input.value.toFixed(1)}${input.unit}`,
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

  const shouldAlert = check.status === ServiceStatus.DOWN || endpoint.consecutiveFailures >= endpointFailureThreshold;
  if (shouldAlert) {
    await triggerAlert({
      ruleType: AlertRuleType.ENDPOINT_DOWN,
      resourceType: AlertResourceType.ENDPOINT,
      resourceId: endpointId,
      title: "Endpoint down",
      message: `${endpoint.name} is unhealthy after ${endpoint.consecutiveFailures} failure(s)`,
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
    await triggerAlert({
      ruleType: AlertRuleType.SSL_EXPIRING,
      resourceType: AlertResourceType.SSL_CERTIFICATE,
      resourceId: endpointId,
      title: "SSL certificate expiring",
      message: `SSL certificate expires in ${check.daysUntilExpiry} day(s)`,
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

export async function evaluateContainerAlert(container: ContainerRecord) {
  const exited = container.state.toLowerCase() === "exited" || container.status.toLowerCase().startsWith("exited");
  if (exited) {
    await triggerAlert({
      ruleType: AlertRuleType.CONTAINER_EXITED,
      resourceType: AlertResourceType.CONTAINER,
      resourceId: `${container.serverId}:${container.dockerId}`,
      title: "Container exited",
      message: `${container.name} is ${container.status}`,
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
    if (!server.lastHeartbeatAt) {
      await triggerAlert({
        ruleType: AlertRuleType.SERVER_OFFLINE,
        resourceType: AlertResourceType.SERVER,
        resourceId: server.id,
        title: "Server offline",
        message: `${server.name} has never reported a heartbeat`,
        severity: AlertSeverity.CRITICAL,
        observedValue: "no heartbeat",
        thresholdValue: `${serverOfflineMinutes} minutes`
      });
      continue;
    }

    const ageMinutes = (now - server.lastHeartbeatAt.getTime()) / 60_000;
    if (ageMinutes >= serverOfflineMinutes) {
      await triggerAlert({
        ruleType: AlertRuleType.SERVER_OFFLINE,
        resourceType: AlertResourceType.SERVER,
        resourceId: server.id,
        title: "Server offline",
        message: `${server.name} heartbeat is ${ageMinutes.toFixed(1)} minutes old`,
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
        title: "Agent stale",
        message: `${server.name} heartbeat is ${ageMinutes.toFixed(1)} minutes old`,
        severity: AlertSeverity.WARNING,
        observedValue: ageMinutes.toFixed(1),
        thresholdValue: agentStaleMinutes.toString()
      });
    } else {
      await resolveAlert(AlertRuleType.AGENT_STALE, AlertResourceType.SERVER, server.id);
    }
  }
}
