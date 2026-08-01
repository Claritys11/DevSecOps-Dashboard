import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { ContainerActions } from "@/components/container-actions";
import { ContainerProtectionControl } from "@/components/container-protection-control";
import { listContainers } from "@/server/services/docker-service";

export const dynamic = "force-dynamic";

export default async function ContainersPage() {
  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
  const results = await Promise.all(
    servers.map(async (server) => {
      try {
        return { server, source: "docker", containers: await listContainers(server.id), warning: null };
      } catch (error) {
        const cachedContainers = await prisma.containerRecord.findMany({ where: { serverId: server.id }, orderBy: { name: "asc" } });
        const containers = cachedContainers.map((container) => ({
          id: container.dockerId,
          name: container.name,
          image: container.image,
          state: container.state,
          status: container.status,
          protectionLevel: container.protectionLevel,
          protectionOverride: container.protectionOverride
        }));
        return { server, source: "cache", containers, warning: error instanceof Error ? error.message : "Docker unavailable" };
      }
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Containers</h1>
        <p className="text-sm text-muted-foreground">Inspect Docker state, open logs, and restart containers with audit tracking.</p>
      </div>
      {results.map((result) => (
        <Card key={result.server.id}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{result.server.name}</h2>
              <p className="text-sm text-muted-foreground">{result.source === "docker" ? "Live Docker data" : `Cached data: ${result.warning}`}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Image</th>
                  <th className="py-2 pr-3">State</th>
                  <th className="py-2 pr-3">Protection</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.containers.map((container) => (
                  <tr key={container.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-medium">{container.name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{container.image}</td>
                    <td className="py-3 pr-3"><StatusBadge status={container.state} /></td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-col gap-2">
                        <ProtectionBadge level={container.protectionLevel} />
                        <ContainerProtectionControl
                          serverId={result.server.id}
                          containerId={container.id}
                          containerName={container.name}
                          value={container.protectionLevel}
                          overridden={container.protectionOverride ?? false}
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{container.status}</td>
                    <td className="py-3 pr-3">
                      <ContainerActions
                        serverId={result.server.id}
                        containerId={container.id}
                        containerName={container.name}
                        protectionLevel={container.protectionLevel}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ProtectionBadge({ level }: { level: string }) {
  const tone = level === "PROTECTED" ? "bad" : level === "EPHEMERAL" ? "warn" : level === "MANAGED" ? "good" : "neutral";
  return <Badge tone={tone}>{level}</Badge>;
}
