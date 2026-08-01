import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EndpointActions } from "@/components/endpoint-actions";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EndpointsPage() {
  const endpoints = await prisma.monitoredEndpoint.findMany({
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 5 },
      sslChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
      server: true
    },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Endpoints & SSL</h1>
        <p className="text-sm text-muted-foreground">Monitor application uptime, response time, status code, and TLS certificate expiry.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {endpoints.map((endpoint) => {
          const latest = endpoint.checks[0];
          const ssl = endpoint.sslChecks[0];
          const sslValue = ssl?.daysUntilExpiry != null ? `${ssl.daysUntilExpiry} days` : ssl?.error === "Endpoint is not HTTPS" ? "Not HTTPS" : ssl?.error ?? "No data";
          const nextCheck = !endpoint.enabled ? "Paused" : endpoint.nextCheckAt ? endpoint.nextCheckAt.toLocaleString() : "Due now";
          return (
            <Card key={endpoint.id}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{endpoint.name}</h2>
                  <p className="break-all text-sm text-muted-foreground">{endpoint.url}</p>
                </div>
                <StatusBadge status={endpoint.status} />
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <Info label="Status code" value={latest?.statusCode ?? "No data"} />
                <Info label="Response" value={formatDuration(latest?.responseTimeMs)} />
                <Info label="SSL expiry" value={sslValue} />
                <Info label="Interval" value={`${endpoint.intervalSeconds}s`} />
                <Info label="Failures" value={String(endpoint.consecutiveFailures)} />
                <Info label="Next check" value={nextCheck} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {endpoint.server?.name ?? "No server linked"} · Last success {endpoint.lastSuccessAt?.toLocaleString() ?? "never"}
                </p>
                <EndpointActions endpointId={endpoint.id} enabled={endpoint.enabled} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
