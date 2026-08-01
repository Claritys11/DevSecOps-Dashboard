import { prisma } from "@/lib/prisma";
import { createDockerClient, normalizeContainerName } from "@/server/integrations/docker-client";
import { ContainerProtectionLevel, ServerRuntime, type Prisma } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { evaluateContainerAlert } from "@/server/services/alert-service";

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
  return logs.toString("utf8").replace(/\u0000|\u0001|\u0002|\u0003/g, "");
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
  return containers.map((container) => {
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
