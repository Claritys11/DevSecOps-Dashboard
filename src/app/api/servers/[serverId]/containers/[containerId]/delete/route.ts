import { handleContainerAction } from "@/server/services/container-action-handler";
import { deleteContainer } from "@/server/services/docker-service";

export async function DELETE(request: Request, { params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  return handleContainerAction(request, params, "delete", deleteContainer);
}
