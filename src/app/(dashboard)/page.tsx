import { Activity, AlertTriangle, Box, GlobeLock, Server } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ResponseTimeChart } from "@/components/response-time-chart";
import { StatusBadge } from "@/components/status-badge";
import { EndpointActions } from "@/components/endpoint-actions";
import { AcknowledgeAlertButton } from "@/components/alert-actions";
import { getDashboardOverview } from "@/server/services/dashboard-service";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const overview = await getDashboardOverview();
  const containers = overview.servers.flatMap((server) => server.containers.map((container) => ({ ...container, serverName: server.name })));
  const healthyEndpoints = overview.endpoints.filter((endpoint) => endpoint.status === "HEALTHY").length;
  const responseChecks = overview.latestChecks.map((check) => ({ checkedAt: check.checkedAt, responseTimeMs: check.responseTimeMs }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Operational Overview</h1>
        <p className="text-sm text-muted-foreground">Servers, containers, endpoint health, SSL, alerts, and sensitive activity in one place.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Server} label="Servers" value={overview.servers.length} />
        <Kpi icon={Box} label="Containers" value={containers.length} />
        <Kpi icon={GlobeLock} label="Healthy endpoints" value={`${healthyEndpoints}/${overview.endpoints.length}`} />
        <Kpi icon={AlertTriangle} label="Active alerts" value={overview.alerts.length} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Response Time</h2>
              <p className="text-sm text-muted-foreground">Latest endpoint checks across monitored services.</p>
            </div>
            <Activity className="size-5 text-primary" />
          </div>
          <ResponseTimeChart data={responseChecks} />
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Endpoint Status</h2>
          <div className="space-y-3">
            {overview.endpoints.map((endpoint) => {
              const latest = endpoint.checks[0];
              const ssl = endpoint.sslChecks[0];
              const sslLabel = ssl?.daysUntilExpiry != null ? `SSL ${ssl.daysUntilExpiry} days` : ssl?.error === "Endpoint is not HTTPS" ? "Not HTTPS" : "SSL no data";
              return (
                <div key={endpoint.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{endpoint.name}</p>
                      <p className="break-all text-xs text-muted-foreground">{endpoint.url}</p>
                    </div>
                    <StatusBadge status={endpoint.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{formatDuration(latest?.responseTimeMs)}</span>
                    <span>{sslLabel}</span>
                    <EndpointActions endpointId={endpoint.id} enabled={endpoint.enabled} />
                  </div>
                </div>
              );
            })}
            {overview.endpoints.length === 0 && <p className="text-sm text-muted-foreground">No endpoints configured.</p>}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Active Alerts</h2>
          <div className="space-y-3">
            {overview.alerts.map((alert) => (
              <div key={alert.id} className="rounded border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-1 text-muted-foreground">{alert.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {alert.ruleType} · {alert.severity} · seen {alert.occurrenceCount}x
                      {alert.acknowledgedAt ? ` · acknowledged ${new Date(alert.acknowledgedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  {!alert.acknowledgedAt && <AcknowledgeAlertButton alertId={alert.id} />}
                </div>
              </div>
            ))}
            {overview.alerts.length === 0 && <p className="text-sm text-muted-foreground">No active alerts.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Servers</h2>
          <div className="space-y-3">
            {overview.servers.map((server) => (
              <div key={server.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{server.name}</p>
                  <p className="text-sm text-muted-foreground">{server.hostname} · {server.environment}</p>
                </div>
                <StatusBadge status={server.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Recent Audit Logs</h2>
          <div className="space-y-3">
            {overview.auditLogs.map((log) => (
              <div key={log.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{log.action}</p>
                  <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-muted-foreground">{log.targetType} {log.targetId ?? ""}</p>
              </div>
            ))}
            {overview.auditLogs.length === 0 && <p className="text-sm text-muted-foreground">No sensitive activity recorded yet.</p>}
          </div>
        </Card>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <div className="grid size-10 place-items-center rounded bg-muted">
          <Icon className="size-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}
