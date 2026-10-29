"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api-client";

export function EndpointActions({ endpoint, canManage, canOperate }: { endpoint: { id: string; name: string; enabled: boolean }; canManage: boolean; canOperate: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"check" | "toggle" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(kind: "check" | "toggle" | "delete") {
    setPending(kind);
    setError(null);
    const result =
      kind === "check"
        ? await api(`/api/endpoints/${endpoint.id}/check`, "POST")
        : kind === "toggle"
          ? await api(`/api/endpoints/${endpoint.id}`, "PATCH", { enabled: !endpoint.enabled })
          : await api(`/api/endpoints/${endpoint.id}`, "DELETE");
    setPending(null);
    if (!result.ok) return setError(result.error);
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {canOperate && endpoint.enabled && (
        <Button size="sm" variant="ghost" loading={pending === "check"} loadingLabel="Checking" onClick={() => run("check")}>
          <RefreshCw className="size-3.5" /> Check now
        </Button>
      )}
      {canManage && (
        <Button size="sm" variant="ghost" loading={pending === "toggle"} loadingLabel={endpoint.enabled ? "Pausing" : "Resuming"} onClick={() => run("toggle")}>
          {endpoint.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {endpoint.enabled ? "Pause" : "Resume"}
        </Button>
      )}
      {canManage && (
        <Button size="sm" variant="ghost" className="text-crit hover:text-crit" onClick={() => setConfirmDelete(true)} aria-label={`Remove ${endpoint.name}`}>
          <Trash2 className="size-3.5" />
        </Button>
      )}
      {error && !confirmDelete && <p className="w-full text-2xs text-crit">{error}</p>}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Remove ${endpoint.name}?`}
        description="Its check history and certificate data are deleted. Pause it instead to keep the history."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" loading={pending === "delete"} loadingLabel="Removing" onClick={() => run("delete")}>Remove endpoint</Button>
          </>
        }
      >
        <FormError>{error}</FormError>
      </Dialog>
    </div>
  );
}
