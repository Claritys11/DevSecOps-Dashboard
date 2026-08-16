"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw, ScrollText, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ContainerAction = "restart" | "stop" | "delete";

export function ContainerActions({
  serverId,
  containerId,
  containerName,
  protectionLevel
}: {
  serverId: string;
  containerId: string;
  containerName: string;
  protectionLevel: string;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ContainerAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isProtected = protectionLevel === "PROTECTED";
  const pending = pendingAction !== null;

  async function runAction(path: ContainerAction, method: "POST" | "DELETE") {
    if (isProtected) {
      setError("Protected containers cannot be managed from the dashboard");
      return;
    }

    const reason = window.prompt(`Reason for ${path} on ${containerName}`);
    if (!reason) return;

    let confirmName: string | undefined;
    if (path === "delete") {
      confirmName = window.prompt(`Type the container name to delete: ${containerName}`) ?? undefined;
      if (confirmName !== containerName) {
        setError("Container name confirmation does not match");
        return;
      }
    }

    setError(null);
    setPendingAction(path);
    try {
      const response = await fetch(`/api/servers/${serverId}/containers/${containerId}/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason,
          confirmName,
          idempotencyKey: crypto.randomUUID()
        })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Unable to ${path} container`);
        return;
      }
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link href={`/containers/${serverId}/${containerId}`}>
          <Button type="button" variant="secondary"><ScrollText className="size-4" /> Logs</Button>
        </Link>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || isProtected}
          loading={pendingAction === "stop"}
          loadingLabel="Stopping..."
          onClick={() => runAction("stop", "POST")}
        >
          <Square className="size-4" />
          Stop
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={pending || isProtected}
          loading={pendingAction === "restart"}
          loadingLabel="Restarting..."
          onClick={() => runAction("restart", "POST")}
        >
          <RotateCcw className="size-4" />
          Restart
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={pending || isProtected}
          loading={pendingAction === "delete"}
          loadingLabel="Deleting..."
          onClick={() => runAction("delete", "DELETE")}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
      {error && <p className="max-w-sm text-xs text-rose-700">{error}</p>}
    </div>
  );
}
