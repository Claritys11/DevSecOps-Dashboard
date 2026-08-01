import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const maxClockSkewSeconds = Number(process.env.AGENT_MAX_CLOCK_SKEW_SECONDS ?? 300);
const nonceRetentionMinutes = Number(process.env.AGENT_NONCE_RETENTION_MINUTES ?? 30);

export function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function authenticateAgent(request: Request, rawBody: string) {
  const agentId = request.headers.get("x-agent-id");
  const token = request.headers.get("x-agent-token");
  const timestampHeader = request.headers.get("x-agent-timestamp");
  const nonce = request.headers.get("x-agent-nonce");
  const bodyHash = request.headers.get("x-body-sha256");

  if (!agentId || !token || !timestampHeader || !nonce || !bodyHash) {
    return { response: NextResponse.json({ error: "Invalid agent authentication" }, { status: 401 }) };
  }

  const expectedBodyHash = sha256Hex(rawBody);
  if (!safeEqualHex(expectedBodyHash, bodyHash)) {
    return { response: NextResponse.json({ error: "Invalid agent authentication" }, { status: 401 }) };
  }

  const timestamp = new Date(timestampHeader);
  if (Number.isNaN(timestamp.getTime())) {
    return { response: NextResponse.json({ error: "Invalid agent authentication" }, { status: 401 }) };
  }

  const skewSeconds = Math.abs(Date.now() - timestamp.getTime()) / 1000;
  if (skewSeconds > maxClockSkewSeconds) {
    return { response: NextResponse.json({ error: "Invalid agent authentication" }, { status: 401 }) };
  }

  const credential = await prisma.agentCredential.findUnique({
    where: { agentId },
    include: { server: true }
  });

  if (!credential?.server || credential.revokedAt) {
    return { response: NextResponse.json({ error: "Invalid agent authentication" }, { status: 401 }) };
  }

  if (!safeEqualHex(credential.tokenHash, sha256Hex(token))) {
    return { response: NextResponse.json({ error: "Invalid agent authentication" }, { status: 401 }) };
  }

  try {
    await prisma.agentNonce.create({
      data: {
        credentialId: credential.id,
        nonce,
        timestamp
      }
    });
  } catch {
    return { response: NextResponse.json({ error: "Invalid agent authentication" }, { status: 401 }) };
  }

  const cutoff = new Date(Date.now() - nonceRetentionMinutes * 60 * 1000);
  await prisma.agentNonce.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });

  await prisma.agentCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() }
  });

  return { credential };
}
