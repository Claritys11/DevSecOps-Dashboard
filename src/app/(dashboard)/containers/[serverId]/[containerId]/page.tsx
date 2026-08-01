import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getContainerLogs } from "@/server/services/docker-service";

export const dynamic = "force-dynamic";

export default async function ContainerLogsPage({ params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  const { serverId, containerId } = await params;
  let logs = "";
  let error: string | null = null;

  try {
    logs = await getContainerLogs(serverId, containerId);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to read container logs";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/containers"><Button variant="secondary"><ArrowLeft className="size-4" /> Back</Button></Link>
        <div>
          <h1 className="text-2xl font-semibold">Container Logs</h1>
          <p className="break-all text-sm text-muted-foreground">{containerId}</p>
        </div>
      </div>
      <Card>
        {error ? (
          <p className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>
        ) : (
          <pre className="max-h-[70vh] overflow-auto rounded bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{logs || "No logs returned."}</pre>
        )}
      </Card>
    </div>
  );
}
