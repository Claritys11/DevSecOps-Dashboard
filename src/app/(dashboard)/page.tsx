import Link from "next/link";
import { Check, Globe, Server } from "lucide-react";
import { auth } from "@/auth";
import { hasRole } from "@/server/auth/guards";
import { auditLabel, overallHealth } from "@/lib/health";
import { cn, formatDuration, formatPercent } from "@/lib/utils";
import { getDashboardOverview } from "@/server/services/dashboard-service";
import { Section } from "@/components/ui/card";
import { Status, StatusDot, toneText } from "@/components/ui/status";
import { Meter } from "@/components/ui/meter";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusStrip } from "@/components/status-strip";
import { CheckHistory } from "@/components/check-history";
import { AlertList } from "@/components/alert-list";
import { RelativeTime } from "@/components/relative-time";
import { AuditTarget } from "@/components/audit-target";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const cpuCritical = Number(process.env.ALERT_CPU_CRITICAL_PERCENT ?? 90);
const memoryCritical = Number(process.env.ALERT_MEMORY_CRITICAL_PERCENT ?? 90);
const diskCritical = Number(process.env.ALERT_DISK_CRITICAL_PERCENT ?? 85);

export default async function OverviewPage() {
  const [session, overview] = await Promise.all([auth(), getDashboardOverview()]);
  const role = session?.user.role;
  const { servers, endpoints, openAlerts, critical, warnings, strip, containers, soonestCertificate } = overview;
  const health = overallHealth({ issues: critical, warnings, total: strip.length });
  const enabledEndpoints = endpoints.filter((endpoint) => endpoint.enabled);
  const connectedServers = servers.filter((server) => server.health.state !== "pending").length;

  return (
    <div className="space-y-6">
      <section aria-labelledby="health-headline" className="space-y-4">
        <div className="flex items-start gap-3">
          <StatusDot tone={health.tone} pulse className="mt-3 size-3 [&>span]:size-3" />
          <div>
            <h1 id="health-headline" className={cn("text-2xl font-semibold sm:text-3xl", health.tone === "crit" && toneText.crit)}>
              {health.headline}
            </h1>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
              <Stat label="Servers online" value={`${servers.filter((server) => server.health.state === "online").length} of ${servers.length}`} />
              <Stat label="Endpoints up" value={`${enabledEndpoints.filter((endpoint) => endpoint.status === "HEALTHY").length} of ${enabledEndpoints.length}`} />
              {containers.total > 0 && <Stat label="Containers running" value={`${containers.running} of ${containers.total}`} />}
              {soonestCertificate?.ssl?.daysUntilExpiry != null && (
                <Stat label="Next certificate expiry" value={`${soonestCertificate.ssl.daysUntilExpiry} days`} />
              )}
            </dl>
          </div>
        </div>
        {strip.length > 0 && <StatusStrip items={strip} />}
      </section>

      {(connectedServers === 0 || endpoints.length === 0) && (
        <GettingStarted hasServer={connectedServers > 0} hasAnyServer={servers.length > 0} hasEndpoint={endpoints.length > 0} canManage={hasRole(role, "ADMIN")} />
      )}

      {openAlerts.length > 0 && (
        <Section
          title="Needs attention"
          description="Open alerts, most severe first. Acknowledge one to show you are on it."
          action={<Link href="/alerts" className="text-xs font-medium text-accent hover:underline">All alerts</Link>}
          flush
        >
          <AlertList alerts={openAlerts.slice(0, 5)} canAcknowledge={hasRole(role, "MAINTAINER")} />
          {openAlerts.length > 5 && (
            <p className="border-t px-4 py-2 text-xs text-muted">
              And {openAlerts.length - 5} more. <Link href="/alerts" className="text-accent hover:underline">See all</Link>
            </p>
          )}
        </Section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Servers" description="Live resource usage from each agent" action={<Link href="/servers" className="text-xs font-medium text-accent hover:underline">Manage</Link>} flush>
          {servers.length === 0 ? (
            <EmptyState icon={Server} title="No servers yet">Connect a server to see CPU, memory and disk here.</EmptyState>
          ) : (
            <ul className="divide-y">
              {servers.map((server) => (
                <li key={server.id}>
                  <Link href={`/servers/${server.id}`} className="grid gap-3 px-4 py-3 hover:bg-raised/50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{server.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <Status tone={server.health.tone} label={server.health.label} />
                        {server.lastHeartbeatAt && <RelativeTime date={server.lastHeartbeatAt} />}
                      </div>
                    </div>
                    {server.latest ? (
                      <div className="grid grid-cols-3 gap-3">
                        <Meter label="CPU" value={server.latest.cpuUsagePercent} critical={cpuCritical} />
                        <Meter label="Memory" value={server.latest.memoryUsagePercent} critical={memoryCritical} />
                        <Meter label="Disk" value={server.latest.storageUsagePercent} critical={diskCritical} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted">No metrics yet. Install the agent to start collecting.</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Endpoints" description="Last 30 checks and 24-hour uptime" action={<Link href="/endpoints" className="text-xs font-medium text-accent hover:underline">Manage</Link>} flush>
          {endpoints.length === 0 ? (
            <EmptyState icon={Globe} title="No endpoints yet">Add a URL and the dashboard checks it every minute.</EmptyState>
          ) : (
            <ul className="divide-y">
              {endpoints.map((endpoint) => (
                <li key={endpoint.id}>
                  <Link href={`/endpoints#${endpoint.id}`} className="grid gap-2 px-4 py-3 hover:bg-raised/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusDot tone={endpoint.tone} />
                        <p className="truncate font-medium">{endpoint.name}</p>
                      </div>
                      <p className="mt-0.5 truncate pl-4 font-mono text-2xs text-muted">{endpoint.url}</p>
                    </div>
                    <div className="flex items-center gap-4 pl-4 sm:pl-0 [&>:first-child]:flex-1 sm:[&>:first-child]:flex-none">
                      <CheckHistory checks={endpoint.history} className="w-32 sm:w-40" />
                      <div className="w-16 text-right text-xs">
                        <p className="tabular font-mono">{formatPercent(endpoint.uptime24h, endpoint.uptime24h === 100 ? 0 : 1)}</p>
                        <p className="tabular font-mono text-2xs text-muted">{formatDuration(endpoint.latest?.responseTimeMs)}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {overview.activity.length > 0 && (
        <Section title="Recent activity" action={<Link href="/activity" className="text-xs font-medium text-accent hover:underline">Full log</Link>} flush>
          <ul className="divide-y text-sm">
            {overview.activity.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
                <span>
                  <span className="font-medium">{log.user?.name || log.user?.email || "System"}</span>{" "}
                  <span className="text-muted">{auditLabel(log.action).toLowerCase()}</span>{" "}
                  <AuditTarget metadata={log.metadata} />
                </span>
                <RelativeTime date={log.createdAt} className="text-xs text-muted" />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd className="tabular font-medium text-fg">{value}</dd>
    </div>
  );
}

function GettingStarted({ hasServer, hasAnyServer, hasEndpoint, canManage }: { hasServer: boolean; hasAnyServer: boolean; hasEndpoint: boolean; canManage: boolean }) {
  const steps = [
    {
      done: hasServer,
      title: "Connect a server",
      body: hasAnyServer ? "A server is added but its agent has not reported yet. Open it to copy the install command." : "Add a server and run one command on it to start sending CPU, memory and disk usage.",
      href: hasAnyServer ? "/servers" : "/servers?add=1",
      cta: hasAnyServer ? "Open servers" : "Add server"
    },
    {
      done: hasEndpoint,
      title: "Watch a website or API",
      body: "Add any URL. It is checked every minute, and its TLS certificate is tracked for expiry.",
      href: "/endpoints?add=1",
      cta: "Add endpoint"
    }
  ];

  return (
    <Section title="Get set up" description="Two steps and the dashboard is useful.">
      <ol className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", step.done && "border-ok bg-ok text-white dark:text-bg")}>
              {step.done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div className="space-y-2">
              <p className={cn("font-medium", step.done && "text-muted line-through")}>{step.title}</p>
              {!step.done && <p className="text-sm text-muted">{step.body}</p>}
              {!step.done && canManage && (
                <Link href={step.href} className={buttonClass({ variant: "primary", size: "sm" })}>{step.cta}</Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
