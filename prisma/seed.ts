import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient, Role, ServerRuntime } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

type SeedEndpoint = {
  id?: string;
  serverId?: string;
  name: string;
  url: string;
  expectedStatus?: number;
  intervalSeconds?: number;
  timeoutMs?: number;
  enabled?: boolean;
  nextCheckAt?: Date;
};

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseBoolean(value: string | undefined) {
  return value === "true" || value === "1" || value === "yes";
}

function parseCustomEndpoints(serverId: string): SeedEndpoint[] {
  if (!process.env.SEED_ENDPOINTS_JSON) return [];

  const parsed = JSON.parse(process.env.SEED_ENDPOINTS_JSON);
  if (!Array.isArray(parsed)) {
    throw new Error("SEED_ENDPOINTS_JSON must be a JSON array");
  }

  return parsed.map((endpoint, index) => {
    if (!endpoint || typeof endpoint.name !== "string" || typeof endpoint.url !== "string") {
      throw new Error(`Invalid endpoint at SEED_ENDPOINTS_JSON[${index}]`);
    }

    return {
      id: typeof endpoint.id === "string" ? endpoint.id : `custom-${slug(endpoint.name) || index}`,
      serverId: typeof endpoint.serverId === "string" ? endpoint.serverId : serverId,
      name: endpoint.name,
      url: endpoint.url,
      expectedStatus: typeof endpoint.expectedStatus === "number" ? endpoint.expectedStatus : 200,
      intervalSeconds: typeof endpoint.intervalSeconds === "number" ? endpoint.intervalSeconds : 60,
      timeoutMs: typeof endpoint.timeoutMs === "number" ? endpoint.timeoutMs : 5000,
      enabled: typeof endpoint.enabled === "boolean" ? endpoint.enabled : true
    };
  });
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "change-me-now";

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      email,
      name: "Homelab Admin",
      passwordHash,
      role: Role.ADMIN
    }
  });

  const hostServer = await prisma.server.upsert({
    where: { id: "local-homelab" },
    update: {
      name: "CachyOS Host",
      hostname: "localhost",
      environment: "homelab",
      runtime: ServerRuntime.HOST,
      description: "CachyOS host running the dashboard and exposing homelab services."
    },
    create: {
      id: "local-homelab",
      name: "CachyOS Host",
      hostname: "localhost",
      description: "CachyOS host running the dashboard and exposing homelab services.",
      environment: "homelab",
      runtime: ServerRuntime.HOST
    }
  });

  const ubuntuMachine = await prisma.server.upsert({
    where: { id: "ubuntu-nspawn" },
    update: {
      name: "Ubuntu nspawn",
      hostname: "ubuntu",
      description: "Ubuntu 24.04 systemd-nspawn machine stored at /var/lib/machines/ubuntu. Docker Engine runs inside this machine.",
      environment: "homelab",
      runtime: ServerRuntime.SYSTEMD_NSPAWN,
      machinePath: "/var/lib/machines/ubuntu",
      dockerEndpoint: process.env.UBUNTU_NSPAWN_DOCKER_ENDPOINT || null
    },
    create: {
      id: "ubuntu-nspawn",
      name: "Ubuntu nspawn",
      hostname: "ubuntu",
      description: "Ubuntu 24.04 systemd-nspawn machine stored at /var/lib/machines/ubuntu. Docker Engine runs inside this machine.",
      environment: "homelab",
      runtime: ServerRuntime.SYSTEMD_NSPAWN,
      machinePath: "/var/lib/machines/ubuntu",
      dockerEndpoint: process.env.UBUNTU_NSPAWN_DOCKER_ENDPOINT || null
    }
  });

  const endpoints: SeedEndpoint[] = [
    {
      id: "dashboard-local",
      serverId: hostServer.id,
      name: "DevSecOps Dashboard",
      url: process.env.DASHBOARD_HEALTH_URL ?? "http://localhost:3003/api/health",
      expectedStatus: 200,
      intervalSeconds: 60,
      timeoutMs: 5000,
      enabled: true,
      nextCheckAt: new Date()
    }
  ];

  if (parseBoolean(process.env.SEED_HOMELAB_EXAMPLES)) {
    endpoints.push(
    { id: "portfolio-main", serverId: hostServer.id, name: "Portfolio", url: "http://localhost:3000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "portfolio-indevs", serverId: hostServer.id, name: "Portfolio Indevs", url: "http://localhost:3010", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "claritys-hub", serverId: hostServer.id, name: "Claritys Hub", url: "http://localhost:3005", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "automarket-frontend", serverId: ubuntuMachine.id, name: "Automarket Frontend", url: "http://localhost:1003", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "automarket-backend", serverId: ubuntuMachine.id, name: "Automarket Backend", url: "http://localhost:1004", expectedStatus: 404, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "library-frontend", serverId: ubuntuMachine.id, name: "Library Frontend", url: "http://localhost:1001", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "library-backend", serverId: ubuntuMachine.id, name: "Library Backend", url: "http://localhost:1002", expectedStatus: 404, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "coolify", serverId: ubuntuMachine.id, name: "Coolify", url: process.env.COOLIFY_STATUS_URL ?? "http://localhost:8000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "homelab-monitor", serverId: hostServer.id, name: "Homelab Monitor", url: "http://localhost:3020", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "shopnest", serverId: ubuntuMachine.id, name: "Shopnest", url: "http://localhost:1006", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "ktcg-app", serverId: ubuntuMachine.id, name: "KTCG App", url: "http://localhost:1000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "dist-gateway", serverId: ubuntuMachine.id, name: "Dist Gateway", url: "http://localhost:8443", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "volweb-frontend", serverId: ubuntuMachine.id, name: "VolWeb Frontend", url: "http://localhost:4000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() }
    );
  }

  endpoints.push(...parseCustomEndpoints(hostServer.id));

  for (const endpoint of endpoints) {
    await prisma.monitoredEndpoint.upsert({
      where: { id: endpoint.id ?? `endpoint-${slug(endpoint.name)}` },
      update: {
        serverId: endpoint.serverId,
        name: endpoint.name,
        url: endpoint.url,
        expectedStatus: endpoint.expectedStatus ?? 200,
        intervalSeconds: endpoint.intervalSeconds ?? 60,
        timeoutMs: endpoint.timeoutMs ?? 5000,
        enabled: endpoint.enabled ?? true,
        nextCheckAt: new Date()
      },
      create: {
        id: endpoint.id ?? `endpoint-${slug(endpoint.name)}`,
        serverId: endpoint.serverId,
        name: endpoint.name,
        url: endpoint.url,
        expectedStatus: endpoint.expectedStatus ?? 200,
        intervalSeconds: endpoint.intervalSeconds ?? 60,
        timeoutMs: endpoint.timeoutMs ?? 5000,
        enabled: endpoint.enabled ?? true,
        nextCheckAt: new Date()
      }
    });
  }

  const agentCredentials = [
    {
      agentId: process.env.CACHYOS_AGENT_ID ?? "cachyos-host-agent",
      token: process.env.CACHYOS_AGENT_TOKEN ?? "change-me-cachyos-agent-token",
      serverId: hostServer.id,
      name: "CachyOS host agent"
    },
    {
      agentId: process.env.UBUNTU_NSPAWN_AGENT_ID ?? "ubuntu-nspawn-agent",
      token: process.env.UBUNTU_NSPAWN_AGENT_TOKEN ?? "change-me-ubuntu-nspawn-agent-token",
      serverId: ubuntuMachine.id,
      name: "Ubuntu nspawn agent"
    }
  ];

  for (const credential of agentCredentials) {
    await prisma.agentCredential.upsert({
      where: { agentId: credential.agentId },
      update: {
        serverId: credential.serverId,
        tokenHash: sha256Hex(credential.token),
        name: credential.name,
        revokedAt: null
      },
      create: {
        agentId: credential.agentId,
        serverId: credential.serverId,
        tokenHash: sha256Hex(credential.token),
        name: credential.name
      }
    });
  }

  console.log(`Seeded admin user ${email}`);
  console.log(`Seeded ${endpoints.length} monitored endpoints`);
  console.log(`Seeded ${agentCredentials.length} agent credentials`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
