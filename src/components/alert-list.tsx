import Link from "next/link";
import { ruleLabel, severityTone } from "@/lib/health";
import { cn } from "@/lib/utils";
import { StatusDot, Tag } from "@/components/ui/status";
import { RelativeTime } from "@/components/relative-time";
import { AcknowledgeAlertButton } from "@/components/alert-actions";

type AlertRow = {
  id: string;
  title: string;
  message: string;
  severity: string;
  ruleType: string;
  resourceType: string;
  resourceId: string;
  occurrenceCount: number;
  triggeredAt: Date;
  lastObservedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
};

export function alertHref(alert: Pick<AlertRow, "resourceType" | "resourceId">) {
  if (alert.resourceType === "SERVER") return `/servers/${alert.resourceId}`;
  if (alert.resourceType === "ENDPOINT" || alert.resourceType === "SSL_CERTIFICATE") return `/endpoints#${alert.resourceId}`;
  if (alert.resourceType === "CONTAINER") return "/containers";
  return null;
}

export function AlertList({ alerts, canAcknowledge, showResolved = false }: { alerts: AlertRow[]; canAcknowledge: boolean; showResolved?: boolean }) {
  return (
    <ul className="divide-y">
      {alerts.map((alert) => {
        const href = alertHref(alert);
        const tone = alert.resolvedAt ? "idle" : severityTone(alert.severity);
        return (
          <li key={alert.id} className={cn("flex items-start gap-3 px-4 py-3", alert.acknowledgedAt && !alert.resolvedAt && "opacity-70")}>
            <StatusDot tone={tone} pulse={!alert.acknowledgedAt && !alert.resolvedAt} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {href ? (
                  <Link href={href} className="font-medium hover:underline">{alert.title}</Link>
                ) : (
                  <span className="font-medium">{alert.title}</span>
                )}
                <Tag>{ruleLabel(alert.ruleType)}</Tag>
                {alert.acknowledgedAt && !alert.resolvedAt && <Tag>Acknowledged</Tag>}
              </div>
              <p className="mt-0.5 text-xs text-muted">{alert.message}</p>
              <p className="mt-1 text-2xs text-muted">
                {showResolved && alert.resolvedAt ? (
                  <>Resolved <RelativeTime date={alert.resolvedAt} /></>
                ) : (
                  <>Started <RelativeTime date={alert.triggeredAt} /></>
                )}
                {alert.occurrenceCount > 1 && <>, seen {alert.occurrenceCount} times</>}
              </p>
            </div>
            {canAcknowledge && !alert.acknowledgedAt && !alert.resolvedAt && <AcknowledgeAlertButton alertId={alert.id} />}
          </li>
        );
      })}
    </ul>
  );
}
