// Pure helpers shared by server components and client components.
// The stored Server.status is only ever written as ONLINE by agent ingestion,
// so the UI derives liveness from lastHeartbeatAt instead of trusting it.

export type Tone = "ok" | "warn" | "crit" | "idle";

export type ServerHealth = {
  state: "online" | "stale" | "offline" | "pending";
  tone: Tone;
  label: string;
};

export function serverHealth(
  lastHeartbeatAt: Date | string | null | undefined,
  options: { staleMinutes?: number; offlineMinutes?: number; now?: number } = {}
): ServerHealth {
  const staleMinutes = options.staleMinutes ?? Number(process.env.AGENT_STALE_AFTER_MINUTES ?? 2);
  const offlineMinutes = options.offlineMinutes ?? Number(process.env.SERVER_OFFLINE_AFTER_MINUTES ?? 10);
  if (!lastHeartbeatAt) return { state: "pending", tone: "idle", label: "Waiting for agent" };

  const ageMinutes = ((options.now ?? Date.now()) - new Date(lastHeartbeatAt).getTime()) / 60_000;
  if (ageMinutes >= offlineMinutes) return { state: "offline", tone: "crit", label: "Offline" };
  if (ageMinutes >= staleMinutes) return { state: "stale", tone: "warn", label: "Not reporting" };
  return { state: "online", tone: "ok", label: "Online" };
}

export function endpointTone(status: string, enabled = true): Tone {
  if (!enabled) return "idle";
  if (status === "HEALTHY") return "ok";
  if (status === "DEGRADED") return "warn";
  if (status === "DOWN") return "crit";
  return "idle";
}

export function endpointLabel(status: string, enabled = true) {
  if (!enabled) return "Paused";
  return { HEALTHY: "Up", DEGRADED: "Unexpected status", DOWN: "Down", UNKNOWN: "Not checked yet" }[status] ?? status;
}

export function containerTone(state: string, status = ""): Tone {
  const normalized = state.toLowerCase();
  if (normalized === "running") return "ok";
  if (normalized === "restarting" || normalized === "paused") return "warn";
  if (normalized === "dead") return "crit";
  // Exit code 0 is a deliberate stop; anything else is a crash.
  if (normalized === "exited") return /exited \(0\)/i.test(status) ? "idle" : "crit";
  return "idle";
}

export function usageTone(percent: number | null | undefined, critical = 90): Tone {
  if (percent == null) return "idle";
  if (percent >= critical) return "crit";
  if (percent >= critical - 15) return "warn";
  return "ok";
}

export function severityTone(severity: string): Tone {
  if (severity === "CRITICAL") return "crit";
  if (severity === "WARNING") return "warn";
  return "idle";
}

const ruleLabels: Record<string, string> = {
  SERVER_OFFLINE: "Server offline",
  AGENT_STALE: "Agent not reporting",
  ENDPOINT_DOWN: "Endpoint down",
  CONTAINER_EXITED: "Container crashed",
  HIGH_CPU: "High CPU",
  HIGH_MEMORY: "High memory",
  HIGH_DISK: "Disk almost full",
  SSL_EXPIRING: "Certificate expiring"
};

export function ruleLabel(ruleType: string) {
  return ruleLabels[ruleType] ?? humanize(ruleType);
}

const auditLabels: Record<string, string> = {
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  CONTAINER_RESTART: "Restarted container",
  CONTAINER_STOP: "Stopped container",
  CONTAINER_DELETE: "Deleted container",
  ENDPOINT_CHECK: "Ran endpoint check",
  SSL_CHECK: "Ran certificate check",
  SETTINGS_UPDATE: "Changed settings",
  SERVER_CREATE: "Added server",
  SERVER_DELETE: "Removed server",
  AGENT_TOKEN_ROTATE: "Rotated agent token",
  ENDPOINT_CREATE: "Added endpoint",
  ENDPOINT_UPDATE: "Edited endpoint",
  ENDPOINT_DELETE: "Removed endpoint",
  ALERT_ACK: "Acknowledged alert",
  USER_CREATE: "Added user",
  USER_DELETE: "Removed user",
  PASSWORD_CHANGE: "Changed password"
};

export function auditLabel(action: string) {
  return auditLabels[action] ?? humanize(action);
}

export function humanize(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Collapses everything the dashboard watches into one headline.
 * `issues` are things that are actively wrong (down, offline, critical alerts);
 * `warnings` are degraded-but-working signals.
 */
export function overallHealth(input: { issues: number; warnings: number; total: number }) {
  if (input.total === 0) return { tone: "idle" as Tone, headline: "Nothing is being monitored yet" };
  if (input.issues > 0) {
    return { tone: "crit" as Tone, headline: `${input.issues} ${input.issues === 1 ? "problem needs" : "problems need"} attention` };
  }
  if (input.warnings > 0) {
    return { tone: "warn" as Tone, headline: `Running, with ${input.warnings} ${input.warnings === 1 ? "warning" : "warnings"}` };
  }
  return { tone: "ok" as Tone, headline: `All ${input.total} monitored ${input.total === 1 ? "service is" : "services are"} healthy` };
}
