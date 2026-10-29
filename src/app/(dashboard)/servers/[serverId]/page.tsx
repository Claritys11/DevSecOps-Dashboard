import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ServerRuntime } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/server/auth/guards";
import { serverHealth } from "@/lib/health";
import { cn, formatByteCount, formatBytes, formatUptime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { Status, Tag } from "@/components/ui/status";
import { RelativeTime } from "@/components/relative-time";
import { ServerMetricsChart, type MetricPoint } from "@/components/server-metrics-chart";
import { DeleteServerButton, EditServerButton, InstallAgentButton } from "@/components/servers/server-admin";

export const dynamic = "force-dynamic";

const ranges = { "1h": 3600_000, "6h": 6 * 3600_000, "24h": 24 * 3600_000, "7d": 7 * 24 * 3600_000 } as const;
const MAX_POINTS = 240;

const thresholds = {
  cpu: Number(process.env.ALERT_CPU_CRITICAL_PERCENT ?? 90),
  memory: Number(process.env.ALERT_MEMORY_CRITICAL_PERCENT ?? 90),
  disk: Number(process.env.ALERT_DISK_CRITICAL_PERCENT ?? 85)
};

export async function generateMetadata({ params }: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await params;
  const server = await prisma.server.findUnique({ where: { id: serverId }, select: { name: true } });
  return { title: server?.name ?? "Server" };
}

export default async function ServerDetailPage({ params, searchParams }: { params: Promise<{ serverId: string }>; searchParams: Promise<{ range?: string }> }) {
  const { serverId } = await params;
  const { range: rawRange } = await searchParams;
  const range = rawRange && rawRange in ranges ? (rawRange as keyof typeof ranges) : "6h";
  const requestTime = new Date();
  const since = new Date(requestTime.getTime() - ranges[range]);

  const [session, server] = await Promise.all([
    auth(),
    prisma.server.findUnique({
      where: { id: serverId },
      include: {
        agentCredential: { select: { agentId: true, lastUsedAt: true, revokedAt: true } },
        _count: { select: { containers: true, endpoints: true } }
      }
    })
  ]);
  if (!server) notFound();

  const metrics = await prisma.serverMetric.findMany({
    where: { serverId, collectedAt: { gte: since } },
    orderBy: { collectedAt: "asc" },
    select: {
      collectedAt: true,
      cpuUsagePercent: true,
      memoryUsagePercent: true,
      storageUsagePercent: true,
      loadAverage1: true,
      networkRxBytes: true,
      networkTxBytes: true
    }
  });
  const latest = await prisma.serverMetric.findFirst({ where: { serverId }, orderBy: { collectedAt: "desc" } });

  const canManage = hasRole(session?.user.role, "ADMIN");
  const health = serverHealth(server.lastHeartbeatAt);
  const connected = health.state !== "pending";

  // Downsample evenly so long ranges stay light to render.
  const step = Math.max(1, Math.ceil(metrics.length / MAX_POINTS));
  const chartData: MetricPoint[] = metrics
    .filter((_, index) => index % step === 0 || index === metrics.length - 1)
    .map((metric) => ({
      t: metric.collectedAt.getTime(),
      cpu: metric.cpuUsagePercent,
      memory: metric.memoryUsagePercent,
      disk: metric.storageUsagePercent,
      load: metric.loadAverage1
    }));

  // The agent reports cumulative byte counters; show the rate between the last two samples.
  const [previous, current] = metrics.slice(-2);
  const seconds = previous && current ? (current.collectedAt.getTime() - previous.collectedAt.getTime()) / 1000 : 0;
  const rate = (a?: bigint, b?: bigint) => (seconds > 0 && a != null && b != null && b >= a ? Number(b - a) / seconds : null);
  const rxRate = rate(previous?.networkRxBytes, current?.networkRxBytes);
  const txRate = rate(previous?.networkTxBytes, current?.networkTxBytes);

  const dockerAccess = server.dockerEndpoint ? "remote" : server.runtime === ServerRuntime.HOST || server.runtime === ServerRuntime.SYSTEMD_NSPAWN ? "local" : "none";

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link href="/servers" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> Servers
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {server.name}
            <Status tone={health.tone} label={health.label} className="text-sm" />
          </span>
        }
        description={
          connected ? (
            <>
              Last data <RelativeTime date={server.lastHeartbeatAt} /> from <span className="font-mono">{server.hostname}</span>
            </>
          ) : (
            "The agent has not reported yet. Install it on the machine to start collecting metrics."
          )
        }
        actions={
          canManage && (
            <>
              <InstallAgentButton server={server} connected={connected} />
              <EditServerButton
                server={{ id: server.id, name: server.name, environment: server.environment, description: server.description, dockerAccess, dockerEndpoint: server.dockerEndpoint }}
              />
              <DeleteServerButton server={server} />
            </>
          )
        }
      />

      {latest && (
        <section className="grid gap-4 rounded-md border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Meter label="CPU" value={latest.cpuUsagePercent} critical={thresholds.cpu} detail={`${latest.cpuCoreCount} cores, load ${latest.loadAverage1.toFixed(2)}`} />
          <Meter label="Memory" value={latest.memoryUsagePercent} critical={thresholds.memory} detail={`${formatBytes(latest.memoryUsedMb)} of ${formatBytes(latest.memoryTotalMb)}`} />
          <Meter label="Disk ( / )" value={latest.storageUsagePercent} critical={thresholds.disk} detail={`${latest.storageUsedGb.toFixed(1)} of ${latest.storageTotalGb.toFixed(1)} GB`} />
          <div className="text-xs">
            <p className="text-muted">Network</p>
            <p className="tabular mt-1 flex gap-4 font-mono">
              <span title="Received">↓ {rxRate == null ? "—" : `${formatByteCount(rxRate)}/s`}</span>
              <span title="Sent">↑ {txRate == null ? "—" : `${formatByteCount(txRate)}/s`}</span>
            </p>
            <p className="mt-1 text-2xs text-muted">Up {formatUptime(latest.uptimeSeconds)}</p>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Section
          title="History"
          description={`Dashed line marks the alert threshold. ${metrics.length} samples in range.`}
          action={
            <div className="flex rounded border p-0.5" role="tablist" aria-label="Time range">
              {Object.keys(ranges).map((item) => (
                <Link
                  key={item}
                  href={`/servers/${server.id}?range=${item}`}
                  role="tab"
                  aria-selected={item === range}
                  className={cn("rounded-sm px-2.5 py-1 text-xs font-medium", item === range ? "bg-raised text-fg" : "text-muted hover:text-fg")}
                >
                  {item}
                </Link>
              ))}
            </div>
          }
        >
          <ServerMetricsChart data={chartData} thresholds={thresholds} />
        </Section>

        <Section title="Details" flush>
          <dl className="divide-y text-xs">
            <Row label="Group" value={<Tag>{server.environment}</Tag>} />
            <Row label="Operating system" value={server.os ?? "—"} />
            <Row label="Kernel" value={server.kernel ?? "—"} mono />
            <Row label="Architecture" value={server.architecture ?? "—"} mono />
            <Row label="Agent version" value={server.agentVersion ?? "—"} mono />
            <Row label="Agent ID" value={server.agentCredential?.agentId ?? "Not enrolled"} mono />
            <Row
              label="Containers"
              value={
                dockerAccess === "none" ? (
                  "Not connected"
                ) : (
                  <Link href="/containers" className="text-accent hover:underline">
                    {server._count.containers} via {dockerAccess === "remote" ? "Docker API" : "local socket"}
                  </Link>
                )
              }
            />
            <Row label="Linked endpoints" value={String(server._count.endpoints)} />
            <Row label="Added" value={<RelativeTime date={server.createdAt} />} />
          </dl>
        </Section>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
