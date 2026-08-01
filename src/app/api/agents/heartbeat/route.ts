import { NextResponse } from "next/server";
import { authenticateAgent } from "@/server/services/agent-auth-service";
import { recordAgentHeartbeat } from "@/server/services/agent-service";
import { checkRateLimit } from "@/server/services/rate-limit-service";
import { heartbeatSchema } from "@/server/validators/agent-metrics";

export const runtime = "nodejs";
const maxBodyBytes = Number(process.env.AGENT_MAX_BODY_BYTES ?? 16_384);

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > maxBodyBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const authResult = await authenticateAgent(request, rawBody);
  if ("response" in authResult) return authResult.response;

  if (!checkRateLimit(`agent:${authResult.credential.agentId}:heartbeat`, 30, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = heartbeatSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await recordAgentHeartbeat(authResult.credential.serverId, parsed.data);
  console.info("agent heartbeat accepted", {
    agentId: authResult.credential.agentId,
    serverId: authResult.credential.serverId,
    hostname: parsed.data.hostname
  });

  return NextResponse.json({ ok: true });
}
