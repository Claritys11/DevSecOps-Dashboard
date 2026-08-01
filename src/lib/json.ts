import { NextResponse } from "next/server";

export function jsonResponse(data: unknown, init?: ResponseInit) {
  return new NextResponse(
    JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...init?.headers
      }
    }
  );
}
