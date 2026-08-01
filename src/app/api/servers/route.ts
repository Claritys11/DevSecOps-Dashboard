import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/server/auth/guards";

const serverSchema = z.object({
  name: z.string().min(2),
  hostname: z.string().min(2),
  description: z.string().optional(),
  environment: z.string().default("homelab"),
  dockerEndpoint: z.string().optional()
});

export async function GET() {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;

  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(servers);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;

  const parsed = serverSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const server = await prisma.server.create({ data: parsed.data });
  return NextResponse.json(server, { status: 201 });
}
