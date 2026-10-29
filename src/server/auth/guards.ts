import { NextResponse } from "next/server";
import { auth } from "@/auth";

export type AppRole = "ADMIN" | "MAINTAINER" | "VIEWER";

const roleRank: Record<AppRole, number> = { VIEWER: 0, MAINTAINER: 1, ADMIN: 2 };

export function hasRole(role: AppRole | undefined, minimum: AppRole) {
  return role ? roleRank[role] >= roleRank[minimum] : false;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    return { response: NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 }) };
  }
  return { session };
}

export async function requireRole(minimum: AppRole) {
  const result = await requireUser();
  if ("response" in result) return result;
  if (!hasRole(result.session.user.role, minimum)) {
    const needed = minimum === "ADMIN" ? "an admin" : "a maintainer or admin";
    return { response: NextResponse.json({ error: `This action needs ${needed} account.` }, { status: 403 }) };
  }
  return result;
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}
