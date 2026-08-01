import { Prisma, type ContainerRecord, type Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/server/services/rate-limit-service";

export type ContainerAction = "restart" | "stop" | "delete";

const actionRequestSchema = z.object({
  reason: z.string().min(3).max(500),
  confirmName: z.string().optional(),
  idempotencyKey: z.string().min(8).max(120)
});

export async function getContainerRecord(serverId: string, containerId: string) {
  return prisma.containerRecord.findUnique({
    where: {
      serverId_dockerId: { serverId, dockerId: containerId }
    }
  });
}

export async function parseContainerActionRequest(request: Request, container: ContainerRecord, action: ContainerAction) {
  const parsed = actionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return { error: "Reason and idempotency key are required" };
  }

  if (action === "delete" && parsed.data.confirmName !== container.name) {
    return { error: "Container name confirmation does not match" };
  }

  return { data: parsed.data };
}

export function authorizeContainerAction(input: {
  role: Role;
  userId: string;
  action: ContainerAction;
  container: ContainerRecord;
}) {
  if (!checkRateLimit(`container-action:${input.userId}:${input.action}`, 10, 60_000)) {
    return "Too many container actions. Try again later.";
  }

  if (input.role === "VIEWER") {
    return "Forbidden";
  }

  if (input.container.protectionLevel === "PROTECTED") {
    return "Protected containers cannot be managed from the dashboard";
  }

  if (input.action === "delete" && input.role !== "ADMIN") {
    return "Only admins can delete containers";
  }

  return null;
}

export async function reserveContainerAction(input: {
  idempotencyKey: string;
  serverId: string;
  containerId: string;
  action: ContainerAction;
}) {
  try {
    await prisma.containerActionIdempotency.create({
      data: {
        key: input.idempotencyKey,
        serverId: input.serverId,
        containerId: input.containerId,
        action: input.action
      }
    });
    return null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "Duplicate container action request";
    }
    throw error;
  }
}
