import Link from "next/link";
import { Server } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const servers = await prisma.server.findMany({
    include: {
      metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
      _count: { select: { containers: true, endpoints: true } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Servers</h1>
        <p className="text-sm text-muted-foreground">Manage homelab nodes and remote environments.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {servers.map((server) => {
          const metric = server.metrics[0];
          const runtime = server.runtime?.replace("_", "-").toLowerCase() ?? "unknown";
          return (
            <Card key={server.id}>
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded bg-muted">
                    <Server className="size-5 text-primary" />
                  </div>
                  <div>
                    <Link href={`/servers/${server.id}`} className="font-semibold hover:text-primary">{server.name}</Link>
                    <p className="text-sm text-muted-foreground">{server.hostname}</p>
                  </div>
                </div>
                <StatusBadge status={server.status} />
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Metric label="Environment" value={server.environment} />
                <Metric label="Runtime" value={runtime} />
                <Metric label="Machine path" value={server.machinePath ?? "n/a"} />
                <Metric label="Containers" value={server._count.containers} />
                <Metric label="Endpoints" value={server._count.endpoints} />
                <Metric label="CPU" value={metric ? `${metric.cpuUsagePercent.toFixed(1)}%` : "No data"} />
                <Metric label="Memory" value={metric ? `${metric.memoryUsagePercent.toFixed(1)}%` : "No data"} />
                <Metric label="Storage" value={metric ? `${metric.storageUsagePercent.toFixed(1)}%` : "No data"} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
