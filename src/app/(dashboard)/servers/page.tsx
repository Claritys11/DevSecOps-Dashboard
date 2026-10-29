import Link from "next/link";
import { Suspense } from "react";
import { Server } from "lucide-react";
import { auth } from "@/auth";
import { hasRole } from "@/server/auth/guards";
import { formatUptime } from "@/lib/utils";
import { getServersWithLatest } from "@/server/services/dashboard-service";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { Status, Tag } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/empty-state";
import { RelativeTime } from "@/components/relative-time";
import { AddServerButton } from "@/components/servers/add-server-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Servers" };

export default async function ServersPage() {
  const [session, servers] = await Promise.all([auth(), getServersWithLatest()]);
  const canManage = hasRole(session?.user.role, "ADMIN");

  return (
    <div>
      <PageHeader
        title="Servers"
        description="Every machine running the agent. Click one for history, system details and the agent install command."
        actions={canManage && <Suspense><AddServerButton autoOpen /></Suspense>}
      />

      {servers.length === 0 ? (
        <Card>
          <EmptyState icon={Server} title="No servers yet" action={canManage && <Suspense><AddServerButton /></Suspense>}>
            Add a server, then run the one-line command it gives you on that machine. Metrics appear within a minute.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {servers.map((server) => (
            <Link key={server.id} href={`/servers/${server.id}`} className="group rounded-md border bg-surface p-4 transition-colors hover:border-fg/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium group-hover:underline">{server.name}</p>
                  <p className="truncate font-mono text-2xs text-muted">{server.os ?? server.hostname}</p>
                </div>
                <Tag>{server.environment}</Tag>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <Status tone={server.health.tone} label={server.health.label} />
                {server.lastHeartbeatAt && (
                  <span>
                    last data <RelativeTime date={server.lastHeartbeatAt} />
                  </span>
                )}
              </div>
              {server.latest ? (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Meter label="CPU" value={server.latest.cpuUsagePercent} />
                    <Meter label="Memory" value={server.latest.memoryUsagePercent} />
                    <Meter label="Disk" value={server.latest.storageUsagePercent} critical={85} />
                  </div>
                  <p className="mt-3 text-2xs text-muted">
                    Up {formatUptime(server.latest.uptimeSeconds)}, {server.latest.cpuCoreCount} cores, {server._count.containers} containers
                  </p>
                </>
              ) : (
                <p className="mt-4 rounded border border-dashed px-3 py-2 text-xs text-muted">Waiting for the first report. Open this server to get the install command.</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
