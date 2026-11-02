import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/server/auth/guards";
import { auditLabel, containerTone } from "@/lib/health";
import { formatByteCount } from "@/lib/utils";
import { getContainerLogs, inspectContainer } from "@/server/services/docker-service";
import { parseComposeLabels, PROJECT_LOG_FILE, type ContainerDetails } from "@/server/services/container-details";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/card";
import { Status, Tag } from "@/components/ui/status";
import { CopyBlock } from "@/components/ui/copy-block";
import { RelativeTime } from "@/components/relative-time";
import { ContainerActions } from "@/components/containers/container-actions";
import { protectionLabel } from "@/components/containers/protection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Container" };

export default async function ContainerDetailPage({ params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  const { serverId, containerId: rawId } = await params;
  const containerId = decodeURIComponent(rawId);
  const [session, server, record] = await Promise.all([
    auth(),
    prisma.server.findUnique({ where: { id: serverId }, select: { id: true, name: true } }),
    prisma.containerRecord.findUnique({ where: { serverId_dockerId: { serverId, dockerId: containerId } } })
  ]);
  if (!server) notFound();

  let details: ContainerDetails | null = null;
  let logs = "";
  let error: string | null = null;
  try {
    [details, logs] = await Promise.all([inspectContainer(serverId, containerId), getContainerLogs(serverId, containerId)]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Docker did not respond";
  }
  if (!details && !record) notFound();

  const name = details?.name ?? record!.name;
  const compose = details?.compose ?? parseComposeLabels(record?.labels);
  const role = session?.user.role;

  // By name as well as id: Compose gives a recreated container a new id but keeps its name.
  const history = await prisma.auditLog.findMany({
    where: {
      targetType: { in: ["container", "container_protection"] },
      AND: [{ metadata: { path: ["serverId"], equals: serverId } }, { metadata: { path: ["containerName"], equals: name } }],
      NOT: { metadata: { path: ["phase"], equals: "before" } }
    },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link href="/containers" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> Containers
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            {details && <Status tone={containerTone(details.state, details.exitCode === 0 ? "exited (0)" : "")} label={stateLabel(details)} className="text-sm" />}
          </span>
        }
        description={
          <>
            On <Link href={`/servers/${server.id}`} className="hover:underline">{server.name}</Link>
            {record && <Tag className="ml-2">{protectionLabel(record.protectionLevel)}</Tag>}
          </>
        }
        actions={
          record && (
            <ContainerActions
              serverId={serverId}
              container={{ id: containerId, name, state: details?.state ?? record.state, protectionLevel: record.protectionLevel, protectionOverride: record.protectionOverride }}
              canOperate={Boolean(details) && hasRole(role, "MAINTAINER")}
              canDelete={Boolean(details) && hasRole(role, "ADMIN")}
              canProtect={hasRole(role, "ADMIN")}
              onDetailPage
            />
          )
        }
      />

      {error && <p className="rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">Showing saved information only. Docker said: {error}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Ports" description="How to reach it from outside the container" flush>
          {details?.ports.length ? (
            <ul className="divide-y">
              {details.ports.map((port) => (
                <li key={port} className="px-4 py-2.5 font-mono text-xs">{port}</li>
              ))}
            </ul>
          ) : (
            <Empty>{details ? "No ports are published or exposed." : "Unknown while Docker is unavailable."}</Empty>
          )}
        </Section>

        <Section title="Docker Compose" description="Where this container is defined" flush>
          {compose ? (
            <dl className="divide-y text-xs">
              <Row label="Project" value={compose.project ?? "—"} />
              <Row label="Service" value={compose.service ?? "—"} />
              <Row label="Folder" value={compose.workingDir ?? "—"} mono />
              {compose.configFiles.map((file, index) => (
                <Row key={file} label={index === 0 ? "Compose file" : "Also uses"} value={file} mono />
              ))}
            </dl>
          ) : (
            <Empty>Not started by Compose, so it has no project folder.</Empty>
          )}
        </Section>

        {details && (
          <Section title="Status" flush>
            <dl className="divide-y text-xs">
              <Row label="Image" value={details.image} mono />
              <Row label="Container ID" value={details.id.slice(0, 12)} mono />
              <Row label="Started" value={details.startedAt ? <RelativeTime date={details.startedAt} /> : "Never"} />
              {details.state !== "running" && details.finishedAt && <Row label="Stopped" value={<RelativeTime date={details.finishedAt} />} />}
              {details.state !== "running" && details.exitCode != null && <Row label="Exit code" value={String(details.exitCode)} mono />}
              {details.oomKilled && <Row label="Out of memory" value="Killed by the kernel" />}
              {details.error && <Row label="Error" value={details.error} />}
              <Row label="Restarts" value={String(details.restartCount)} />
              <Row label="Restart policy" value={details.restartPolicy} mono />
              <Row label="Memory limit" value={details.memoryLimitBytes ? formatByteCount(details.memoryLimitBytes) : "None"} />
              <Row label="CPU limit" value={details.cpuLimit ? `${details.cpuLimit} cores` : "None"} />
              {hasRole(role, "MAINTAINER") && details.command && <Row label="Command" value={details.command} mono />}
            </dl>
          </Section>
        )}

        {details && (
          <Section title="Storage and networks" flush>
            <dl className="divide-y text-xs">
              {details.mounts.map((mount) => (
                <Row key={mount.destination} label={mount.destination} labelMono value={`${mount.source}${mount.readOnly ? " (read-only)" : ""}`} mono />
              ))}
              {details.mounts.length === 0 && <Row label="Volumes" value="None" />}
              {details.networks.map((network) => (
                <Row key={network.name} label={`Network ${network.name}`} value={network.ip ?? "No address"} mono />
              ))}
            </dl>
          </Section>
        )}
      </div>

      {details && details.envNames.length > 0 && (
        <Section title="Environment variables" description="Names only. Values are hidden because they often contain passwords.">
          <ul className="flex flex-wrap gap-1.5">
            {details.envNames.map((env) => (
              <li key={env} className="rounded border px-1.5 py-0.5 font-mono text-2xs text-muted">{env}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Actions and reasons"
        description={compose?.workingDir ? <>Also written to <span className="break-all font-mono">{compose.workingDir.replace(/\/+$/, "")}/{PROJECT_LOG_FILE}</span></> : "Stored in the activity log."}
        flush
      >
        {history.length === 0 ? (
          <Empty>No one has acted on this container from the dashboard yet.</Empty>
        ) : (
          <ul className="divide-y">
            {history.map((log) => {
              const meta = (log.metadata ?? {}) as { reason?: string; phase?: string; error?: string; from?: string; to?: string; reasonFile?: { written: boolean; path?: string; reason?: string } };
              return (
                <li key={log.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span>
                      <span className="font-medium">{log.user?.name || log.user?.email || "System"}</span>{" "}
                      <span className="text-muted">
                        {log.targetType === "container_protection" ? `changed protection from ${meta.from} to ${meta.to}` : auditLabel(log.action).toLowerCase()}
                      </span>
                      {meta.phase === "failed" && <span className="text-crit"> (failed)</span>}
                    </span>
                    <RelativeTime date={log.createdAt} className="text-xs text-muted" />
                  </div>
                  {meta.reason && <p className="mt-1">{meta.reason}</p>}
                  {meta.error && <p className="mt-1 text-xs text-crit">{meta.error}</p>}
                  {meta.reasonFile && !meta.reasonFile.written && <p className="mt-1 text-2xs text-muted">Not written to the folder: {meta.reasonFile.reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {details && (
        <Section title="Logs" description="Last 200 lines, newest at the bottom">
          <pre className="max-h-[60vh] overflow-auto rounded border bg-[#0b0f14] p-4 font-mono text-xs leading-5 text-[#d6dde8]">{logs || "No log output."}</pre>
        </Section>
      )}

      {compose?.workingDir && (
        <Section title="Open it on the server" description="Run this on the machine that hosts the container.">
          <CopyBlock value={`cd ${compose.workingDir} && docker compose logs -f ${compose.service ?? ""}`.trimEnd()} />
        </Section>
      )}
    </div>
  );
}

function stateLabel(details: ContainerDetails) {
  const state = details.state.charAt(0).toUpperCase() + details.state.slice(1);
  if (details.health) return `${state}, ${details.health}`;
  if (details.state === "exited" && details.exitCode != null) return `${state} (${details.exitCode})`;
  return state;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-muted">{children}</p>;
}

function Row({ label, value, mono = false, labelMono = false }: { label: string; value: React.ReactNode; mono?: boolean; labelMono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className={`min-w-0 shrink-0 break-all text-muted sm:max-w-[45%] ${labelMono ? "font-mono" : ""}`}>{label}</dt>
      <dd className={`min-w-0 break-all text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
