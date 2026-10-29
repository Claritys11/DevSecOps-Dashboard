import { Suspense } from "react";
import { Globe, LockKeyhole } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/server/auth/guards";
import { cn, formatDuration, formatPercent } from "@/lib/utils";
import { getEndpointsWithHistory } from "@/server/services/dashboard-service";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Status, Tag, toneText } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckHistory } from "@/components/check-history";
import { RelativeTime } from "@/components/relative-time";
import { EndpointFormButton } from "@/components/endpoints/endpoint-form";
import { EndpointActions } from "@/components/endpoints/endpoint-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Endpoints" };

const sslWarnDays = Number(process.env.ALERT_SSL_EXPIRING_DAYS ?? 14);

export default async function EndpointsPage() {
  const [session, endpoints, servers] = await Promise.all([
    auth(),
    getEndpointsWithHistory(),
    prisma.server.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);
  const canManage = hasRole(session?.user.role, "ADMIN");
  const canOperate = hasRole(session?.user.role, "MAINTAINER");
  const privateAllowed = process.env.MONITOR_ALLOW_PRIVATE_NETWORKS === "true";

  return (
    <div>
      <PageHeader
        title="Endpoints"
        description="Websites and APIs checked from the dashboard. A check fails when the status code differs from what you expect or the request times out."
        actions={canManage && <Suspense><EndpointFormButton servers={servers} autoOpen /></Suspense>}
      />

      {!privateAllowed && (
        <p className="mb-4 rounded border px-3 py-2 text-xs text-muted">
          Private and local addresses (192.168.x.x, 10.x.x.x, localhost) are blocked. Set <span className="font-mono">MONITOR_ALLOW_PRIVATE_NETWORKS=true</span> in .env to monitor homelab services.
        </p>
      )}

      {endpoints.length === 0 ? (
        <Card>
          <EmptyState icon={Globe} title="No endpoints yet" action={canManage && <Suspense><EndpointFormButton servers={servers} /></Suspense>}>
            Paste a URL and the dashboard checks it on a schedule, records response time, and warns you before its certificate expires.
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y">
          {endpoints.map((endpoint) => {
            const ssl = endpoint.ssl;
            const sslDays = ssl?.daysUntilExpiry;
            return (
              <article key={endpoint.id} id={endpoint.id} className={cn("scroll-mt-20 px-4 py-4 target:bg-accent/5", !endpoint.enabled && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{endpoint.name}</h2>
                      <Status tone={endpoint.tone} label={endpoint.label} />
                      {endpoint.server && <Tag>{endpoint.server.name}</Tag>}
                    </div>
                    <a href={endpoint.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate font-mono text-2xs text-muted hover:text-fg">
                      {endpoint.url}
                    </a>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <EndpointFormButton
                        servers={servers}
                        endpoint={{ id: endpoint.id, name: endpoint.name, url: endpoint.url, expectedStatus: endpoint.expectedStatus, intervalSeconds: endpoint.intervalSeconds, timeoutMs: endpoint.timeoutMs, serverId: endpoint.serverId }}
                      />
                    )}
                    <EndpointActions endpoint={endpoint} canManage={canManage} canOperate={canOperate} />
                  </div>
                </div>

                <div className="mt-3 grid gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end">
                  <CheckHistory checks={endpoint.history} />
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                    <Metric label="Uptime 24h" value={formatPercent(endpoint.uptime24h, endpoint.uptime24h === 100 ? 0 : 1)} />
                    <Metric label="Response" value={formatDuration(endpoint.latest?.responseTimeMs)} />
                    <Metric
                      label="Status code"
                      value={endpoint.latest?.statusCode ? String(endpoint.latest.statusCode) : "—"}
                      tone={endpoint.latest?.statusCode && endpoint.latest.statusCode !== endpoint.expectedStatus ? "warn" : undefined}
                    />
                    <Metric
                      label="Certificate"
                      value={sslDays != null ? `${sslDays} days left` : ssl?.error === "Endpoint is not HTTPS" ? "No TLS" : ssl?.error ? "Check failed" : "—"}
                      tone={sslDays != null && sslDays <= sslWarnDays ? (sslDays <= 3 ? "crit" : "warn") : undefined}
                      icon={sslDays != null}
                    />
                  </dl>
                </div>

                {endpoint.latest?.error && endpoint.enabled && endpoint.status !== "HEALTHY" && (
                  <p className="mt-3 rounded bg-crit/10 px-3 py-2 font-mono text-2xs text-crit">{endpoint.latest.error}</p>
                )}
                <p className="mt-2 text-2xs text-muted">
                  {endpoint.enabled ? (
                    <>
                      Checked <RelativeTime date={endpoint.lastCheckedAt} />, every {endpoint.intervalSeconds >= 60 ? `${endpoint.intervalSeconds / 60} min` : `${endpoint.intervalSeconds}s`}, expects {endpoint.expectedStatus}.
                      {endpoint.lastSuccessAt && endpoint.status !== "HEALTHY" && (
                        <> Last success <RelativeTime date={endpoint.lastSuccessAt} />.</>
                      )}
                    </>
                  ) : (
                    "Paused. No checks run until you resume it."
                  )}
                </p>
              </article>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, tone, icon = false }: { label: string; value: string; tone?: "warn" | "crit"; icon?: boolean }) {
  return (
    <div>
      <dt className="text-2xs text-muted">{label}</dt>
      <dd className={cn("tabular flex items-center gap-1 whitespace-nowrap font-mono", tone && toneText[tone])}>
        {icon && <LockKeyhole className="size-3" />}
        {value}
      </dd>
    </div>
  );
}
