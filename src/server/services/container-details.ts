import path from "node:path";

// Pure helpers for container details: no Docker or database access, so they stay easy to test.

export const PROJECT_LOG_FILE = ".devsecops-actions.log";

export type ComposeInfo = { project: string | null; service: string | null; workingDir: string | null; configFiles: string[] };

function labelMap(labels: unknown): Record<string, string> {
  if (labels && typeof labels === "object") return labels as Record<string, string>;
  // `docker ps --format json` (systemd-nspawn servers) reports labels as "a=b,c=d".
  if (typeof labels === "string") {
    return Object.fromEntries(
      labels
        .split(",")
        .map((pair) => pair.split("=", 2))
        .filter((pair) => pair.length === 2)
    );
  }
  return {};
}

export function parseComposeLabels(labels: unknown): ComposeInfo | null {
  const map = labelMap(labels);
  const project = map["com.docker.compose.project"] ?? null;
  const workingDir = map["com.docker.compose.project.working_dir"] ?? null;
  if (!project && !workingDir) return null;
  return {
    project,
    service: map["com.docker.compose.service"] ?? null,
    workingDir,
    configFiles: (map["com.docker.compose.project.config_files"] ?? "").split(",").map((file) => file.trim()).filter(Boolean)
  };
}

type ListedPort = { IP?: string; PrivatePort?: number; PublicPort?: number; Type?: string };

/** Formats the `Ports` value of a container listing, merging the IPv4 and IPv6 entries of one binding. */
export function formatPorts(ports: unknown): string[] {
  if (typeof ports === "string") return ports.split(",").map((port) => port.trim()).filter(Boolean);
  if (!Array.isArray(ports)) return [];

  const merged = new Map<string, ListedPort>();
  for (const port of ports as ListedPort[]) {
    const key = `${port.PublicPort ?? ""}:${port.PrivatePort ?? ""}/${port.Type ?? "tcp"}`;
    const existing = merged.get(key);
    if (!existing || existing.IP?.includes(":")) merged.set(key, port);
  }
  return [...merged.values()]
    .sort((a, b) => Number(b.PublicPort != null) - Number(a.PublicPort != null) || (a.PublicPort ?? a.PrivatePort ?? 0) - (b.PublicPort ?? b.PrivatePort ?? 0))
    .map((port) => {
      const target = `${port.PrivatePort}/${port.Type ?? "tcp"}`;
      if (port.PublicPort == null) return `${target} (internal)`;
      const local = port.IP && !["0.0.0.0", "::"].includes(port.IP);
      return `${local ? `${port.IP}:` : ""}${port.PublicPort} → ${target}`;
    });
}

type InspectInfo = {
  Id: string;
  Name?: string;
  Created?: string;
  Path?: string;
  Args?: string[];
  RestartCount?: number;
  State?: { Status?: string; ExitCode?: number; StartedAt?: string; FinishedAt?: string; Error?: string; OOMKilled?: boolean; Health?: { Status?: string } };
  Config?: { Image?: string; Env?: string[] | null; Labels?: Record<string, string> | null; Entrypoint?: string[] | string | null; Cmd?: string[] | string | null };
  HostConfig?: { RestartPolicy?: { Name?: string }; Memory?: number; NanoCpus?: number };
  NetworkSettings?: {
    Ports?: Record<string, Array<{ HostIp?: string; HostPort?: string }> | null> | null;
    Networks?: Record<string, { IPAddress?: string; Aliases?: string[] | null }> | null;
  };
  Mounts?: Array<{ Type?: string; Name?: string; Source?: string; Destination?: string; RW?: boolean }> | null;
};

const asList = (value: string[] | string | null | undefined) => (Array.isArray(value) ? value : value ? [value] : []);

/** Docker's zero time means "never" for StartedAt and FinishedAt. */
const realDate = (value: string | undefined) => (value && !value.startsWith("0001-") ? value : null);

export function toContainerDetails(info: InspectInfo) {
  const ports = Object.entries(info.NetworkSettings?.Ports ?? {}).flatMap(([target, bindings]) => {
    const [privatePort, type] = target.split("/");
    const base = { PrivatePort: Number(privatePort), Type: type };
    return bindings?.length ? bindings.map((binding) => ({ ...base, IP: binding.HostIp, PublicPort: Number(binding.HostPort) })) : [base];
  });

  return {
    id: info.Id,
    name: (info.Name ?? "").replace(/^\//, "") || info.Id.slice(0, 12),
    image: info.Config?.Image ?? "",
    state: info.State?.Status ?? "unknown",
    health: info.State?.Health?.Status ?? null,
    exitCode: info.State?.ExitCode ?? null,
    error: info.State?.Error || null,
    oomKilled: info.State?.OOMKilled ?? false,
    createdAt: realDate(info.Created),
    startedAt: realDate(info.State?.StartedAt),
    finishedAt: realDate(info.State?.FinishedAt),
    restartCount: info.RestartCount ?? 0,
    restartPolicy: info.HostConfig?.RestartPolicy?.Name || "no",
    memoryLimitBytes: info.HostConfig?.Memory || null,
    cpuLimit: info.HostConfig?.NanoCpus ? info.HostConfig.NanoCpus / 1e9 : null,
    command: [...asList(info.Config?.Entrypoint), ...asList(info.Config?.Cmd)].join(" "),
    ports: formatPorts(ports),
    networks: Object.entries(info.NetworkSettings?.Networks ?? {}).map(([name, network]) => ({ name, ip: network.IPAddress || null })),
    mounts: (info.Mounts ?? []).map((mount) => ({
      type: mount.Type ?? "volume",
      source: mount.Type === "volume" && mount.Name ? mount.Name : mount.Source ?? "",
      destination: mount.Destination ?? "",
      readOnly: mount.RW === false
    })),
    // Names only: values often hold passwords, and every signed-in role can open this page.
    envNames: (info.Config?.Env ?? []).map((entry) => entry.split("=", 1)[0]).sort(),
    compose: parseComposeLabels(info.Config?.Labels)
  };
}

export type ContainerDetails = ReturnType<typeof toContainerDetails>;

/** Only an absolute, normalized path below the root can be mounted for the action log. */
export function isSafeProjectDir(dir: string | null | undefined): dir is string {
  return Boolean(dir) && path.posix.isAbsolute(dir!) && path.posix.normalize(dir!).replace(/\/$/, "") === dir!.replace(/\/$/, "") && dir!.replace(/\/+$/, "") !== "";
}

/** One tab-separated line. Control characters are flattened so a reason cannot forge extra entries. */
export function formatActionLogLine(entry: { at: Date; action: string; containerName: string; user: string; reason: string }) {
  const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return [entry.at.toISOString(), entry.action, entry.containerName, entry.user, entry.reason].map(clean).join("\t");
}

/** Removes Docker's 8-byte stream headers from non-TTY logs. TTY logs have none and pass through. */
export function demuxDockerLogs(buffer: Buffer) {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const isHeader = buffer[offset] <= 2 && buffer[offset + 1] === 0 && buffer[offset + 2] === 0 && buffer[offset + 3] === 0;
    if (!isHeader) return buffer.toString("utf8");
    const size = buffer.readUInt32BE(offset + 4);
    chunks.push(buffer.subarray(offset + 8, offset + 8 + size));
    offset += 8 + size;
  }
  return offset === 0 ? buffer.toString("utf8") : Buffer.concat(chunks).toString("utf8");
}
