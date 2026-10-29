import { randomBytes } from "node:crypto";
import { ServerRuntime } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/server/services/agent-auth-service";
import { slugify } from "@/lib/utils";

export type DockerAccess = "none" | "local" | "remote";

export function generateAgentToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Creates a server and its agent credential in one step.
 * The plain token is returned exactly once; only its hash is stored.
 */
export async function enrollServer(input: {
  name: string;
  environment?: string;
  description?: string;
  dockerAccess: DockerAccess;
  dockerEndpoint?: string;
}) {
  const token = generateAgentToken();
  const agentId = `${slugify(input.name, 32) || "server"}-${randomBytes(3).toString("hex")}`;

  const server = await prisma.server.create({
    data: {
      name: input.name,
      hostname: slugify(input.name, 63) || "pending",
      environment: input.environment || "homelab",
      description: input.description || null,
      runtime: input.dockerAccess === "local" ? ServerRuntime.HOST : ServerRuntime.REMOTE,
      dockerEndpoint: input.dockerAccess === "remote" ? input.dockerEndpoint || null : null,
      agentCredential: {
        create: { agentId, tokenHash: sha256Hex(token), name: `${input.name} agent` }
      }
    }
  });

  return { server, agentId, token };
}

export async function rotateAgentToken(serverId: string) {
  const token = generateAgentToken();
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId }, include: { agentCredential: true } });
  const agentId = server.agentCredential?.agentId ?? `${slugify(server.name, 32) || "server"}-${randomBytes(3).toString("hex")}`;

  await prisma.agentCredential.upsert({
    where: { serverId },
    update: { tokenHash: sha256Hex(token), revokedAt: null },
    create: { serverId, agentId, tokenHash: sha256Hex(token), name: `${server.name} agent` }
  });

  return { server, agentId, token };
}
