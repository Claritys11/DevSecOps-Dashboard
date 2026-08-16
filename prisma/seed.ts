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
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the initial admin user.");
  }

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
      name: "Primary Linux Host",
      hostname: "localhost",
      environment: "self-hosted",
      runtime: ServerRuntime.HOST,
      description: "Primary Linux host monitored by the dashboard agent."
    },
    create: {
      id: "local-homelab",
      name: "Primary Linux Host",
      hostname: "localhost",
      description: "Primary Linux host monitored by the dashboard agent.",
      environment: "self-hosted",
      runtime: ServerRuntime.HOST
    }
  });

  const useHomelabExamples = parseBoolean(process.env.SEED_HOMELAB_EXAMPLES);
  const ubuntuMachine = await prisma.server.upsert({
    where: { id: "ubuntu-nspawn" },
    update: {
      name: useHomelabExamples ? "Ubuntu nspawn" : "Secondary Linux Host",
      hostname: useHomelabExamples ? "ubuntu" : "secondary-linux",
      description: useHomelabExamples
        ? "Ubuntu systemd-nspawn machine. Docker Engine runs inside this machine."
        : "Optional secondary Linux host for agent enrollment examples.",
      environment: useHomelabExamples ? "homelab" : "self-hosted",
      runtime: useHomelabExamples ? ServerRuntime.SYSTEMD_NSPAWN : ServerRuntime.REMOTE,
      machinePath: useHomelabExamples ? "/var/lib/machines/ubuntu" : null,
      dockerEndpoint: process.env.UBUNTU_NSPAWN_DOCKER_ENDPOINT || null
    },
    create: {
      id: "ubuntu-nspawn",
      name: useHomelabExamples ? "Ubuntu nspawn" : "Secondary Linux Host",
      hostname: useHomelabExamples ? "ubuntu" : "secondary-linux",
      description: useHomelabExamples
        ? "Ubuntu systemd-nspawn machine. Docker Engine runs inside this machine."
        : "Optional secondary Linux host for agent enrollment examples.",
      environment: useHomelabExamples ? "homelab" : "self-hosted",
      runtime: useHomelabExamples ? ServerRuntime.SYSTEMD_NSPAWN : ServerRuntime.REMOTE,
      machinePath: useHomelabExamples ? "/var/lib/machines/ubuntu" : null,
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

  if (useHomelabExamples) {
    endpoints.push(
    { id: "portfolio-main", serverId: hostServer.id, name: "Portfolio", url: "http://host.docker.internal:3000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "portfolio-indevs", serverId: hostServer.id, name: "Portfolio Indevs", url: "http://host.docker.internal:3010", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "claritys-hub", serverId: hostServer.id, name: "Claritys Hub", url: "http://host.docker.internal:3005", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "automarket-frontend", serverId: ubuntuMachine.id, name: "Automarket Frontend", url: "http://host.docker.internal:1003", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "automarket-backend", serverId: ubuntuMachine.id, name: "Automarket Backend", url: "http://host.docker.internal:1004", expectedStatus: 404, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "library-frontend", serverId: ubuntuMachine.id, name: "Library Frontend", url: "http://host.docker.internal:1001", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "library-backend", serverId: ubuntuMachine.id, name: "Library Backend", url: "http://host.docker.internal:1002", expectedStatus: 404, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "coolify", serverId: ubuntuMachine.id, name: "Coolify", url: process.env.COOLIFY_STATUS_URL ?? "http://localhost:8000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "homelab-monitor", serverId: hostServer.id, name: "Homelab Monitor", url: "http://host.docker.internal:3020", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "shopnest", serverId: ubuntuMachine.id, name: "Shopnest", url: "http://host.docker.internal:1006", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "ktcg-app", serverId: ubuntuMachine.id, name: "KTCG App", url: "http://host.docker.internal:1000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "dist-gateway", serverId: ubuntuMachine.id, name: "Dist Gateway", url: "http://host.docker.internal:8443", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() },
    { id: "volweb-frontend", serverId: ubuntuMachine.id, name: "VolWeb Frontend", url: "http://host.docker.internal:4000", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, enabled: true, nextCheckAt: new Date() }
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
      agentId: process.env.PRIMARY_AGENT_ID ?? process.env.CACHYOS_AGENT_ID,
      token: process.env.PRIMARY_AGENT_TOKEN ?? process.env.CACHYOS_AGENT_TOKEN,
      serverId: hostServer.id,
      name: "Primary Linux host agent"
    },
    {
      agentId: process.env.SECONDARY_AGENT_ID ?? process.env.UBUNTU_NSPAWN_AGENT_ID,
      token: process.env.SECONDARY_AGENT_TOKEN ?? process.env.UBUNTU_NSPAWN_AGENT_TOKEN,
      serverId: ubuntuMachine.id,
      name: "Secondary Linux host agent"
    }
  ].filter((credential): credential is { agentId: string; token: string; serverId: string; name: string } =>
    Boolean(credential.agentId && credential.token)
  );

  if (agentCredentials.length === 0) {
    throw new Error("Set PRIMARY_AGENT_ID and PRIMARY_AGENT_TOKEN before running the seed.");
  }

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
