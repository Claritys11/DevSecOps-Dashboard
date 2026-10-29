import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getContainerLogs } from "@/server/services/docker-service";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Container logs" };

export default async function ContainerLogsPage({ params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  const { serverId, containerId: rawId } = await params;
  const containerId = decodeURIComponent(rawId);
  const record = await prisma.containerRecord.findUnique({ where: { serverId_dockerId: { serverId, dockerId: containerId } }, include: { server: { select: { name: true } } } });

  let logs = "";
  let error: string | null = null;
  try {
    logs = await getContainerLogs(serverId, containerId);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to read container logs";
  }

  return (
    <div>
      <PageHeader
        back={
          <Link href="/containers" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> Containers
          </Link>
        }
        title={record?.name ?? "Container logs"}
        description={<>Last 200 lines{record?.server ? <> from {record.server.name}</> : null}. Newest at the bottom.</>}
      />
      {error ? (
        <p className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p>
      ) : (
        <pre className="max-h-[75vh] overflow-auto rounded-md border bg-[#0b0f14] p-4 font-mono text-xs leading-5 text-[#d6dde8]">{logs || "No log output."}</pre>
      )}
    </div>
  );
}
