import { renderInstallScript, requestOrigin } from "@/server/services/agent-distribution-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return new Response(renderInstallScript(requestOrigin(request)), {
    headers: { "content-type": "text/x-shellscript; charset=utf-8", "cache-control": "no-store" }
  });
}
