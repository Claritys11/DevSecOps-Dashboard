import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { AGENT_PLATFORMS, agentBinaryPath, type AgentPlatform } from "@/server/services/agent-distribution-service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!AGENT_PLATFORMS.includes(platform as AgentPlatform)) {
    return NextResponse.json({ error: `Unsupported platform. Use one of: ${AGENT_PLATFORMS.join(", ")}` }, { status: 404 });
  }

  const file = agentBinaryPath(platform as AgentPlatform);
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return NextResponse.json(
      { error: "This build does not bundle the agent. Run `npm run agent:build`, or use the Docker image." },
      { status: 404 }
    );
  }

  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(size),
      "content-disposition": `attachment; filename="devsecops-agent-${platform}"`,
      "cache-control": "no-cache"
    }
  });
}
