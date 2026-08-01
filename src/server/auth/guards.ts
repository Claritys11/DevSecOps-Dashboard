import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdmin() {
  const result = await requireUser();
  if ("response" in result) return result;
  if (result.session.user.role !== "ADMIN") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
