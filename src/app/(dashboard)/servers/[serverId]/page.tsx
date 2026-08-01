/* eslint-disable react-hooks/purity */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity, Cpu, HardDrive, MemoryStick, Network, Timer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ServerMetricsChart } from "@/components/server-metrics-chart";
import { formatBytes, formatUptime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ranges = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000
};

export default async function ServerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { serverId } = await params;
  const { range: rawRange } = await searchParams;
  const range = rawRange && rawRange in ranges ? (rawRange as keyof typeof ranges) : "1h";
  const since = new Date(Date.now() - ranges[range]);

  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: {
      metrics: {
        where: { collectedAt: { gte: since } },
        orderBy: { collectedAt: "asc" },
        take: 360
      },
      agentCredential: { select: { agentId: true, lastUsedAt: true, revokedAt: true } }
    }
  });

  if (!server) notFound();

  const latest = server.metrics.at(-1);
  const lastHeartbeat = server.lastHeartbeatAt;
  const staleMinutes = Number(process.env.AGENT_STALE_AFTER_MINUTES ?? 2);
  const isStale = lastHeartbeat ? Date.now() - lastHeartbeat.getTime() > staleMinutes * 60 * 1000 : true;
  const heartbeatState = !lastHeartbeat ? "OFFLINE" : isStale ? "DEGRADED" : "ONLINE";

  const chartData = server.metrics.map((metric) => ({
    collectedAt: metric.collectedAt.toISOString(),
    cpuUsagePercent: metric.cpuUsagePercent,
    memoryUsagePercent: metric.memoryUsagePercent,
    storageUsagePercent: metric.storageUsagePercent,
    loadAverage1: metric.loadAverage1
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/servers"><Button variant="secondary"><ArrowLeft className="size-4" /> Back</Button></Link>
        <div>
          <h1 className="text-2xl font-semibold">{server.name}</h1>
          <p className="text-sm text-muted-foreground">{server.hostname} · {server.runtime.replace("_", "-").toLowerCase()}</p>
        </div>
        <StatusBadge status={heartbeatState} />
      </div>

      {!latest && (
        <Card>
          <h2 className="font-semibold">Agent Not Reporting</h2>
          <p className="mt-2 text-sm text-muted-foreground">Install and start the DevSecOps agent for this server. No metrics have been ingested in the selected range.</p>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Cpu} label="CPU" value={latest ? `${latest.cpuUsagePercent.toFixed(1)}%` : "No data"} detail={latest ? `${latest.cpuCoreCount} cores` : "Waiting for agent"} />
        <MetricCard icon={MemoryStick} label="RAM" value={latest ? `${latest.memoryUsagePercent.toFixed(1)}%` : "No data"} detail={latest ? `${formatBytes(latest.memoryUsedMb)} / ${formatBytes(latest.memoryTotalMb)}` : "Waiting for agent"} />
        <MetricCard icon={HardDrive} label="Disk" value={latest ? `${latest.storageUsagePercent.toFixed(1)}%` : "No data"} detail={latest ? `${latest.storageUsedGb.toFixed(1)} / ${latest.storageTotalGb.toFixed(1)} GB` : "Waiting for agent"} />
        <MetricCard icon={Timer} label="Uptime" value={formatUptime(latest?.uptimeSeconds)} detail={server.agentVersion ?? "No heartbeat"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Historical Metrics</h2>
              <p className="text-sm text-muted-foreground">Range-limited query, capped at 360 points.</p>
            </div>
            <div className="flex gap-2">
              {Object.keys(ranges).map((item) => (
                <Link key={item} href={`/servers/${server.id}?range=${item}`}>
                  <Button variant={item === range ? "primary" : "secondary"}>{item}</Button>
                </Link>
              ))}
            </div>
          </div>
          <ServerMetricsChart data={chartData} />
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Agent & System</h2>
          <div className="space-y-3 text-sm">
            <Info label="Last heartbeat" value={lastHeartbeat ? lastHeartbeat.toLocaleString() : "Never"} />
            <Info label="Agent ID" value={server.agentCredential?.agentId ?? "No credential"} />
            <Info label="OS" value={server.os ?? latest?.os ?? "Unknown"} />
            <Info label="Kernel" value={server.kernel ?? latest?.kernel ?? "Unknown"} />
            <Info label="Architecture" value={server.architecture ?? latest?.architecture ?? "Unknown"} />
            <Info label="Load average" value={latest ? `${latest.loadAverage1.toFixed(2)}, ${latest.loadAverage5.toFixed(2)}, ${latest.loadAverage15.toFixed(2)}` : "No data"} />
            <Info label="Network RX/TX" value={latest ? `${Number(latest.networkRxBytes)} / ${Number(latest.networkTxBytes)} bytes` : "No data"} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: React.ReactNode; detail: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="grid size-10 place-items-center rounded bg-muted">
          <Icon className="size-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium">{value}</p>
    </div>
  );
}
