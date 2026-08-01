import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/server/auth/guards";

const endpointSchema = z.object({
  serverId: z.string().optional(),
  name: z.string().min(2),
  url: z.string().url(),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  enabled: z.boolean().default(true),
  intervalSeconds: z.number().int().min(15).max(86400).default(60),
  timeoutMs: z.number().int().min(500).max(30000).default(5000)
});

const endpointUpdateSchema = endpointSchema.partial();

export async function GET() {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;

  const endpoints = await prisma.monitoredEndpoint.findMany({
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 10 },
      sslChecks: { orderBy: { checkedAt: "desc" }, take: 1 }
    },
    orderBy: { name: "asc" }
  });
  return NextResponse.json(endpoints);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;

  const parsed = endpointSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const endpoint = await prisma.monitoredEndpoint.create({ data: parsed.data });
  return NextResponse.json(endpoint, { status: 201 });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;

  const body = await request.json();
  const parsed = z.object({ id: z.string().min(1), data: endpointUpdateSchema }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const endpoint = await prisma.monitoredEndpoint.update({
    where: { id: parsed.data.id },
    data: {
      ...parsed.data.data,
      nextCheckAt: parsed.data.data.enabled === true ? new Date() : undefined
    }
  });

  return NextResponse.json(endpoint);
}
