import Link from "next/link";
import { BellOff } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/server/auth/guards";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertList } from "@/components/alert-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts" };

const tabs = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" }
] as const;

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view = rawView === "resolved" ? "resolved" : "open";
  const [session, alerts, openCount] = await Promise.all([
    auth(),
    prisma.alert.findMany({
      where: view === "open" ? { resolvedAt: null } : { resolvedAt: { not: null } },
      orderBy: view === "open" ? [{ acknowledgedAt: { sort: "asc", nulls: "first" } }, { severity: "desc" }, { lastObservedAt: "desc" }] : [{ resolvedAt: "desc" }],
      take: 100
    }),
    prisma.alert.count({ where: { resolvedAt: null } })
  ]);

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Alerts open on their own when a threshold is crossed and close on their own when things recover. Acknowledging tells others you are handling it."
      />
      <div className="mb-4 flex gap-1 border-b" role="tablist">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "open" ? "/alerts" : "/alerts?view=resolved"}
            role="tab"
            aria-selected={view === tab.key}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", view === tab.key ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {tab.label}
            {tab.key === "open" && <span className="tabular ml-1.5 text-xs text-muted">{openCount}</span>}
          </Link>
        ))}
      </div>
      <Card>
        {alerts.length === 0 ? (
          <EmptyState icon={BellOff} title={view === "open" ? "No open alerts" : "Nothing resolved yet"}>
            {view === "open" ? "Everything the dashboard watches is within its thresholds." : "Alerts move here after they recover."}
          </EmptyState>
        ) : (
          <AlertList alerts={alerts} canAcknowledge={hasRole(session?.user.role, "MAINTAINER")} showResolved={view === "resolved"} />
        )}
      </Card>
      <p className="mt-4 text-xs text-muted">
        Thresholds: CPU {process.env.ALERT_CPU_CRITICAL_PERCENT ?? 90}%, memory {process.env.ALERT_MEMORY_CRITICAL_PERCENT ?? 90}%, disk {process.env.ALERT_DISK_CRITICAL_PERCENT ?? 85}%,{" "}
        {process.env.ALERT_ENDPOINT_FAILURE_THRESHOLD ?? 3} failed checks in a row, certificates within {process.env.ALERT_SSL_EXPIRING_DAYS ?? 14} days. Change them in .env.
      </p>
    </div>
  );
}
