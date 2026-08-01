import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { authenticateAgent } from "@/server/services/agent-auth-service";
import { recordServerMetric } from "@/server/services/agent-service";
import { checkRateLimit } from "@/server/services/rate-limit-service";
import { metricsSchema } from "@/server/validators/agent-metrics";

export const runtime = "nodejs";
const maxBodyBytes = Number(process.env.AGENT_MAX_BODY_BYTES ?? 16_384);

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > maxBodyBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const authResult = await authenticateAgent(request, rawBody);
  if ("response" in authResult) return authResult.response;

  if (!checkRateLimit(`agent:${authResult.credential.agentId}:metrics`, 120, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = metricsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const metric = await recordServerMetric(authResult.credential.serverId, parsed.data);
    console.info("agent metric accepted", {
      agentId: authResult.credential.agentId,
      serverId: authResult.credential.serverId,
      collectionId: parsed.data.collectionId
    });

    return NextResponse.json({
      ok: true,
      metricId: metric.id,
      collectedAt: metric.collectedAt
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Duplicate metric" }, { status: 409 });
    }
    console.error("agent metric ingest failed", error);
    return NextResponse.json({ error: "Unable to ingest metric" }, { status: 500 });
  }
}
