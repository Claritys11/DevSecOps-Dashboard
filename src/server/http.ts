import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { z } from "zod";

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Parses a JSON body against a schema and turns Zod issues into one readable sentence. */
export async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T) {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return { response: badRequest(field ? `${field}: ${issue.message}` : issue?.message ?? "Invalid request") };
  }
  return { data: parsed.data as z.infer<T> };
}

export function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
