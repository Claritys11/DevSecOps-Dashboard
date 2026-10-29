import Link from "next/link";
import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auditLabel } from "@/lib/health";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RelativeTime } from "@/components/relative-time";
import { auditTargetName } from "@/components/audit-target";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

const PAGE_SIZE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ include: { user: { select: { email: true, name: true } } }, orderBy: { createdAt: "desc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    prisma.auditLog.count()
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Activity" description="Who changed what. Every management action and container operation is recorded with its reason." />
      <Card>
        {logs.length === 0 ? (
          <EmptyState icon={History} title="No activity yet">Actions like adding servers or restarting containers show up here.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Who</th>
                  <th className="px-4 py-2 font-medium">What</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => {
                  const metadata = (log.metadata ?? {}) as Record<string, unknown>;
                  const target = auditTargetName(metadata);
                  return (
                    <tr key={log.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted" title={formatDateTime(log.createdAt)}>
                        <RelativeTime date={log.createdAt} />
                      </td>
                      <td className="px-4 py-2.5">{log.user?.name || log.user?.email || "System"}</td>
                      <td className="px-4 py-2.5">
                        {auditLabel(log.action)}
                        {target && <span className="font-medium"> {target}</span>}
                        {typeof metadata.phase === "string" && metadata.phase === "before" && <span className="text-xs text-muted"> (requested)</span>}
                      </td>
                      <td className="max-w-xs px-4 py-2.5 text-xs text-muted">{typeof metadata.reason === "string" ? metadata.reason : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-xs text-muted" aria-label="Pagination">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && <Link className={buttonClass({ size: "sm" })} href={`/activity?page=${page - 1}`}>Newer</Link>}
            {page < pages && <Link className={buttonClass({ size: "sm" })} href={`/activity?page=${page + 1}`}>Older</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
