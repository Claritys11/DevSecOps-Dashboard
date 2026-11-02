import { handleContainerAction } from "@/server/services/container-action-handler";
import { stopContainer } from "@/server/services/docker-service";

export async function POST(request: Request, { params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  return handleContainerAction(request, params, "stop", stopContainer);
}
