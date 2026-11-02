import { prisma } from "@/lib/prisma";
import { createDockerClient, normalizeContainerName } from "@/server/integrations/docker-client";
import { ContainerProtectionLevel, ServerRuntime, type Prisma } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { evaluateContainerAlert } from "@/server/services/alert-service";
import { demuxDockerLogs, formatActionLogLine, isSafeProjectDir, parseComposeLabels, PROJECT_LOG_FILE, toContainerDetails } from "@/server/services/container-details";

const execFileAsync = promisify(execFile);

type ContainerSummary = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports?: unknown;
  labels?: unknown;
  protectionLevel: ContainerProtectionLevel;
  protectionOverride?: boolean;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export async function listContainers(serverId: string) {
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  const containers = server.runtime === ServerRuntime.SYSTEMD_NSPAWN && !server.dockerEndpoint
    ? await listNspawnContainers(getMachineName(server.machinePath, server.hostname))
    : await listDockerodeContainers(server.dockerEndpoint, server.runtime);
  const existingRecords = await prisma.containerRecord.findMany({ where: { serverId } });
  const existingByDockerId = new Map(existingRecords.map((record) => [record.dockerId, record]));

  await Promise.all(
    containers.map(async (container) => {
      const existing = existingByDockerId.get(container.id);
      const protectionLevel = existing?.protectionOverride ? existing.protectionLevel : container.protectionLevel;
      const record = await prisma.containerRecord.upsert({
        where: {
          serverId_dockerId: {
            serverId,
            dockerId: container.id
          }
        },
        update: {
          name: container.name,
          image: container.image,
          state: container.state,
          status: container.status,
          ports: toJson(container.ports),
          labels: toJson(container.labels),
          protectionLevel,
          lastSeenAt: new Date()
        },
        create: {
          serverId,
          dockerId: container.id,
          name: container.name,
          image: container.image,
          state: container.state,
          status: container.status,
          ports: toJson(container.ports),
          labels: toJson(container.labels),
          protectionLevel
        }
      });
      await evaluateContainerAlert(record);
    })
  );

  await prisma.containerRecord.deleteMany({
    where: {
      serverId,
      dockerId: { notIn: containers.map((container) => container.id) }
    }
  });

  return containers.map((container) => {
    const existing = existingByDockerId.get(container.id);
    return {
      ...container,
      protectionLevel: existing?.protectionOverride ? existing.protectionLevel : container.protectionLevel,
      protectionOverride: existing?.protectionOverride ?? false
    };
  });
}

export async function inspectContainer(serverId: string, containerId: string) {
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  if (server.runtime === ServerRuntime.SYSTEMD_NSPAWN && !server.dockerEndpoint) {
    if (!/^[a-zA-Z0-9][\w.-]*$/.test(containerId)) throw new Error("Invalid container id");
    const output = await runNspawnDocker(getMachineName(server.machinePath, server.hostname), ["inspect", containerId]);
    return toContainerDetails(JSON.parse(output)[0]);
  }
  return toContainerDetails(await createDockerClient(server.dockerEndpoint).getContainer(containerId).inspect());
}

export async function getContainerLogs(serverId: string, containerId: string) {
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  if (server.runtime === ServerRuntime.SYSTEMD_NSPAWN && !server.dockerEndpoint) {
    return runNspawnDocker(getMachineName(server.machinePath, server.hostname), ["logs", "--tail", "200", "--timestamps", containerId]);
  }
  const docker = createDockerClient(server.dockerEndpoint);
  const container = docker.getContainer(containerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail: 200,
    timestamps: true
  });
  return demuxDockerLogs(logs);
}

export type ReasonFileResult = { written: true; path: string } | { written: false; reason: string };

const HELPER_IMAGE = "busybox:1.37";
const HELPER_LABEL = "devsecops-dashboard.helper";
// Runs inside the helper, where /project is the only host path visible, so a symlink in the folder cannot reach further.
const APPEND_SCRIPT = `printf '%s\\n' "$LINE" >> "/project/${PROJECT_LOG_FILE}" && chown "$(stat -c %u:%g /project)" "/project/${PROJECT_LOG_FILE}" && chmod 640 "/project/${PROJECT_LOG_FILE}"`;

async function appendThroughHelper(endpoint: string | null, dir: string, line: string) {
  const docker = createDockerClient(endpoint);
  await docker.getImage(HELPER_IMAGE).inspect().catch(async () => {
    const stream = await docker.pull(HELPER_IMAGE);
    await new Promise<void>((resolve, reject) => docker.modem.followProgress(stream, (error) => (error ? reject(error) : resolve())));
  });

  const helper = await docker.createContainer({
    Image: HELPER_IMAGE,
    Cmd: ["sh", "-c", APPEND_SCRIPT],
    Env: [`LINE=${line}`],
    User: "0",
    NetworkDisabled: true,
    Labels: { [HELPER_LABEL]: "true" },
    HostConfig: {
      // Mounts, unlike Binds, fails on a missing folder instead of creating it.
      Mounts: [{ Type: "bind", Source: dir, Target: "/project" }],
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
      CapAdd: ["CHOWN", "DAC_OVERRIDE", "FOWNER"],
      SecurityOpt: ["no-new-privileges"]
    }
  });
  try {
    await helper.start();
    const { StatusCode } = await helper.wait();
    if (StatusCode !== 0) throw new Error(`could not write to the folder (exit ${StatusCode})`);
  } finally {
    await helper.remove({ force: true }).catch(() => {});
  }
}

/**
 * Appends an action to the log file in the container's Compose folder. The audit log stays the
 * source of truth, so this never throws: a failed write must not fail the action it describes.
 */
export async function recordActionInProject(input: { serverId: string; containerName: string; labels: unknown; action: string; user: string; reason: string }): Promise<ReasonFileResult> {
  if (process.env.CONTAINER_ACTION_LOG_IN_PROJECT === "false") return { written: false, reason: "Writing to project folders is turned off." };

  const dir = parseComposeLabels(input.labels)?.workingDir;
  if (!dir) return { written: false, reason: "This container is not part of a Compose project, so it has no folder." };
  if (!isSafeProjectDir(dir)) return { written: false, reason: `Skipped the unusual folder path ${dir}.` };

  try {
    const server = await prisma.server.findUniqueOrThrow({ where: { id: input.serverId } });
    if (server.runtime === ServerRuntime.SYSTEMD_NSPAWN && !server.dockerEndpoint) {
      return { written: false, reason: "Writing to project folders is not supported on systemd-nspawn servers." };
    }
    const line = formatActionLogLine({ at: new Date(), action: input.action, containerName: input.containerName, user: input.user, reason: input.reason });
    await appendThroughHelper(server.dockerEndpoint, dir, line);
    return { written: true, path: `${dir.replace(/\/+$/, "")}/${PROJECT_LOG_FILE}` };
  } catch (error) {
    return { written: false, reason: `Could not write to ${dir}: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

export async function restartContainer(serverId: string, containerId: string) {
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  if (server.runtime === ServerRuntime.SYSTEMD_NSPAWN && !server.dockerEndpoint) {
    await runNspawnDocker(getMachineName(server.machinePath, server.hostname), ["restart", containerId]);
    return;
  }
  const docker = createDockerClient(server.dockerEndpoint);
  await docker.getContainer(containerId).restart({ t: 10 });
}

export async function stopContainer(serverId: string, containerId: string) {
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  if (server.runtime === ServerRuntime.SYSTEMD_NSPAWN && !server.dockerEndpoint) {
    await runNspawnDocker(getMachineName(server.machinePath, server.hostname), ["stop", "--time", "10", containerId]);
    return;
  }
  const docker = createDockerClient(server.dockerEndpoint);
  await docker.getContainer(containerId).stop({ t: 10 });
}

export async function deleteContainer(serverId: string, containerId: string) {
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  if (server.runtime === ServerRuntime.SYSTEMD_NSPAWN && !server.dockerEndpoint) {
    await runNspawnDocker(getMachineName(server.machinePath, server.hostname), ["rm", containerId]);
    await prisma.containerRecord.deleteMany({ where: { serverId, dockerId: containerId } });
    return;
  }
  const docker = createDockerClient(server.dockerEndpoint);
  await docker.getContainer(containerId).remove({ force: false });
  await prisma.containerRecord.deleteMany({
    where: {
      serverId,
      dockerId: containerId
    }
  });
}

async function listDockerodeContainers(endpoint: string | null, runtime: ServerRuntime): Promise<ContainerSummary[]> {
  if (!endpoint && runtime !== ServerRuntime.HOST) {
    throw new Error("Docker endpoint is not configured for this server");
  }

  const docker = createDockerClient(endpoint);
  const containers = await docker.listContainers({ all: true });
  return containers.filter((container) => !container.Labels?.[HELPER_LABEL]).map((container) => {
    const name = normalizeContainerName(container.Names);
    return {
      id: container.Id,
      name,
      image: container.Image,
      state: container.State,
      status: container.Status,
      ports: container.Ports,
      labels: container.Labels,
      protectionLevel: classifyProtection(name, container.Image, container.Labels)
    };
  });
}

async function listNspawnContainers(machineName: string): Promise<ContainerSummary[]> {
  const output = await runNspawnDocker(machineName, ["ps", "-a", "--no-trunc", "--format", "{{json .}}"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"))
    .map((line) => JSON.parse(line) as { ID: string; Names: string; Image: string; State: string; Status: string; Ports?: string; Labels?: string })
    .map((container) => ({
      id: container.ID,
      name: container.Names,
      image: container.Image,
      state: container.State,
      status: container.Status,
      ports: container.Ports,
      labels: container.Labels,
      protectionLevel: classifyProtection(container.Names, container.Image, container.Labels)
    }));
}

async function runNspawnDocker(machineName: string, dockerArgs: string[]) {
  const { stdout, stderr } = await execFileAsync("machinectl", ["shell", machineName, "/usr/bin/docker", ...dockerArgs], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
  const output = `${stdout}\n${stderr}`;
  return output
    .split("\n")
    .filter((line) => !line.startsWith("Connected to machine") && !line.startsWith("Connection to machine"))
    .join("\n")
    .trim();
}

function classifyProtection(name: string, image: string, labels?: unknown): ContainerProtectionLevel {
  const nameImage = `${name} ${image}`.toLowerCase();
  const labelText = JSON.stringify(labels ?? {}).toLowerCase();
  if (/(postgres|redis|coolify-proxy|coolify-sentinel|cloudflare|cloudflared|traefik|nginx|caddy|devsecops|dashboard|proxy|gateway)/.test(nameImage)) {
    return ContainerProtectionLevel.PROTECTED;
  }
  if (/cloudflare|cloudflared|reverse-proxy/.test(labelText)) {
    return ContainerProtectionLevel.PROTECTED;
  }
  if (/(worker|job|cron|reporter)/.test(nameImage)) {
    return ContainerProtectionLevel.EPHEMERAL;
  }
  return ContainerProtectionLevel.MANAGED;
}

function getMachineName(machinePath: string | null, hostname: string) {
  return machinePath?.split("/").filter(Boolean).at(-1) ?? hostname;
}
