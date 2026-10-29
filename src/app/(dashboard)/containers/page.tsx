import Link from "next/link";
import { Boxes, Lock } from "lucide-react";
import { ServerRuntime } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/server/auth/guards";
import { containerTone } from "@/lib/health";
import { listContainers } from "@/server/services/docker-service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, Section } from "@/components/ui/card";
import { Status, Tag } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/empty-state";
import { ContainerActions } from "@/components/containers/container-actions";
import { protectionLabel } from "@/components/containers/protection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Containers" };

type Row = { id: string; name: string; image: string; state: string; status: string; protectionLevel: string; protectionOverride: boolean };

function explainDockerError(message: string) {
  if (/ENOENT|EACCES|docker\.sock/.test(message)) {
    return "The dashboard cannot reach the Docker socket. Re-run the installer with --with-docker, or add docker-compose.docker-socket.yml to COMPOSE_FILE in .env.";
  }
  if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/.test(message)) return "The Docker API did not answer. Check the address in this server's settings and that the port is reachable.";
  return message;
}

export default async function ContainersPage() {
  const session = await auth();
  const role = session?.user.role;
  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
  const connected = servers.filter((server) => server.dockerEndpoint || server.runtime === ServerRuntime.HOST || server.runtime === ServerRuntime.SYSTEMD_NSPAWN);
  const withoutDocker = servers.length - connected.length;

  const results = await Promise.all(
    connected.map(async (server) => {
      try {
        const containers = (await listContainers(server.id)).map((container) => ({ ...container, protectionOverride: container.protectionOverride ?? false })) as Row[];
        return { server, containers, live: true, warning: null as string | null };
      } catch (error) {
        const cached = await prisma.containerRecord.findMany({ where: { serverId: server.id }, orderBy: { name: "asc" } });
        return {
          server,
          containers: cached.map((record) => ({ id: record.dockerId, name: record.name, image: record.image, state: record.state, status: record.status, protectionLevel: record.protectionLevel, protectionOverride: record.protectionOverride })),
          live: false,
          warning: explainDockerError(error instanceof Error ? error.message : "Docker unavailable")
        };
      }
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Containers" description="Docker containers on servers with container access. Every restart, stop and delete asks for a reason and is written to the activity log." />

      {connected.length === 0 ? (
        <Card>
          <EmptyState icon={Boxes} title="No server has container access yet">
            Open a server, choose Edit, and pick how the dashboard reaches its Docker engine. For the machine running the dashboard, re-run the installer with{" "}
            <span className="font-mono">--with-docker</span>.
          </EmptyState>
        </Card>
      ) : (
        results.map((result) => {
          const running = result.containers.filter((container) => container.state === "running").length;
          return (
            <Section
              key={result.server.id}
              title={<Link href={`/servers/${result.server.id}`} className="hover:underline">{result.server.name}</Link>}
              description={result.live ? `${running} of ${result.containers.length} running` : "Showing the last known list"}
              flush
            >
              {result.warning && <p className="border-b bg-warn/10 px-4 py-2 text-xs text-warn">{result.warning}</p>}
              {result.containers.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">No containers found.</p>
              ) : (
                <ul className="divide-y">
                  {result.containers.map((container) => (
                    <li key={container.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_13rem] md:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{container.name}</p>
                          {container.protectionLevel === "PROTECTED" && (
                            <span title="Protected: read-only in the dashboard" className="text-muted">
                              <Lock className="size-3.5" />
                            </span>
                          )}
                        </div>
                        <p className="truncate font-mono text-2xs text-muted">{container.image}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Status tone={containerTone(container.state, container.status)} label={container.status || container.state} />
                        <Tag>{protectionLabel(container.protectionLevel)}{container.protectionOverride ? " (set manually)" : ""}</Tag>
                      </div>
                      <ContainerActions
                        serverId={result.server.id}
                        container={container}
                        canOperate={result.live && hasRole(role, "MAINTAINER")}
                        canDelete={result.live && hasRole(role, "ADMIN")}
                        canProtect={hasRole(role, "ADMIN")}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          );
        })
      )}

      {withoutDocker > 0 && connected.length > 0 && (
        <p className="text-xs text-muted">
          {withoutDocker} {withoutDocker === 1 ? "server has" : "servers have"} no container access. Enable it from the server&apos;s Edit dialog.
        </p>
      )}
    </div>
  );
}
