/**
 * Idempotent first-run bootstrap. Safe to run on every container start:
 * it only creates what is missing and never overwrites data edited in the UI.
 *
 * - Creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist
 *   (set ADMIN_RESET_PASSWORD=true to force the password back to ADMIN_PASSWORD).
 * - Registers agents pre-provisioned through .env (PRIMARY_AGENT_*, SECONDARY_AGENT_*),
 *   which is how the one-line installer enrolls the machine it runs on.
 * - Optionally adds endpoints from SEED_ENDPOINTS_JSON.
 */
import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient, Role, ServerRuntime } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

const env = process.env;
const isTrue = (value: string | undefined) => value === "true" || value === "1" || value === "yes";
const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

async function ensureAdmin() {
  const email = env.ADMIN_EMAIL?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("bootstrap: ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping admin account");
    return;
  }

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const hash = () => argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  if (!existing) {
    await prisma.user.create({ data: { email, name: "Admin", passwordHash: await hash(), role: Role.ADMIN } });
    console.log(`bootstrap: created admin ${email}`);
  } else if (isTrue(env.ADMIN_RESET_PASSWORD)) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: await hash(), role: Role.ADMIN } });
    console.log(`bootstrap: reset password for ${email}`);
  }
}

async function ensureAgent(input: {
  serverId: string;
  serverName: string;
  agentId?: string;
  token?: string;
  runtime: ServerRuntime;
  dockerEndpoint?: string | null;
}) {
  if (!input.agentId || !input.token) return;

  await prisma.server.upsert({
    where: { id: input.serverId },
    update: {},
    create: {
      id: input.serverId,
      name: input.serverName,
      hostname: slug(input.serverName) || "pending",
      environment: "self-hosted",
      runtime: input.runtime,
      dockerEndpoint: input.dockerEndpoint || null
    }
  });

  const existingCredential = await prisma.agentCredential.findUnique({ where: { agentId: input.agentId } });
  if (existingCredential && existingCredential.serverId !== input.serverId) {
    console.log(`bootstrap: agent ${input.agentId} already belongs to another server, leaving it unchanged`);
    return;
  }

  await prisma.agentCredential.upsert({
    where: { serverId: input.serverId },
    update: { agentId: input.agentId, tokenHash: sha256Hex(input.token), revokedAt: null },
    create: { serverId: input.serverId, agentId: input.agentId, tokenHash: sha256Hex(input.token), name: `${input.serverName} agent` }
  });
}

async function ensureSeedEndpoints() {
  if (!env.SEED_ENDPOINTS_JSON) return;
  const parsed: unknown = JSON.parse(env.SEED_ENDPOINTS_JSON);
  if (!Array.isArray(parsed)) throw new Error("SEED_ENDPOINTS_JSON must be a JSON array");

  for (const [index, endpoint] of parsed.entries()) {
    if (!endpoint || typeof endpoint.name !== "string" || typeof endpoint.url !== "string") {
      throw new Error(`Invalid endpoint at SEED_ENDPOINTS_JSON[${index}]`);
    }
    const id = typeof endpoint.id === "string" ? endpoint.id : `custom-${slug(endpoint.name) || index}`;
    await prisma.monitoredEndpoint.upsert({
      where: { id },
      update: {},
      create: {
        id,
        serverId: typeof endpoint.serverId === "string" ? endpoint.serverId : null,
        name: endpoint.name,
        url: endpoint.url,
        expectedStatus: typeof endpoint.expectedStatus === "number" ? endpoint.expectedStatus : 200,
        intervalSeconds: typeof endpoint.intervalSeconds === "number" ? endpoint.intervalSeconds : 60,
        timeoutMs: typeof endpoint.timeoutMs === "number" ? endpoint.timeoutMs : 5000,
        enabled: typeof endpoint.enabled === "boolean" ? endpoint.enabled : true,
        nextCheckAt: new Date()
      }
    });
  }
}

async function main() {
  await ensureAdmin();

  // Server ids are kept from earlier releases so existing installs keep their history.
  await ensureAgent({
    serverId: "local-homelab",
    serverName: env.PRIMARY_SERVER_NAME || "This server",
    agentId: env.PRIMARY_AGENT_ID || env.CACHYOS_AGENT_ID,
    token: env.PRIMARY_AGENT_TOKEN || env.CACHYOS_AGENT_TOKEN,
    runtime: ServerRuntime.HOST
  });
  await ensureAgent({
    serverId: "ubuntu-nspawn",
    serverName: env.SECONDARY_SERVER_NAME || "Secondary server",
    agentId: env.SECONDARY_AGENT_ID || env.UBUNTU_NSPAWN_AGENT_ID,
    token: env.SECONDARY_AGENT_TOKEN || env.UBUNTU_NSPAWN_AGENT_TOKEN,
    runtime: ServerRuntime.REMOTE,
    dockerEndpoint: env.UBUNTU_NSPAWN_DOCKER_ENDPOINT
  });

  await ensureSeedEndpoints();
  console.log("bootstrap: done");
}

main()
  .catch((error) => {
    console.error("bootstrap failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
