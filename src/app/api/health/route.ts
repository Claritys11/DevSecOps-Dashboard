import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "devsecops-dashboard",
    timestamp: new Date().toISOString()
  });
}
