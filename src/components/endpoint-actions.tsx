"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Power, PowerOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EndpointActions({ endpointId, enabled }: { endpointId: string; enabled: boolean }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"check" | "toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = pendingAction !== null;

  async function runCheck() {
    setError(null);
    setPendingAction("check");
    try {
      const response = await fetch(`/api/endpoints/${endpointId}/check`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Unable to check endpoint");
        return;
      }
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleEnabled() {
    setError(null);
    setPendingAction("toggle");
    try {
      const response = await fetch("/api/endpoints", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: endpointId, data: { enabled: !enabled } })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Unable to update endpoint");
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
        <Button variant="secondary" disabled={pending} loading={pendingAction === "check"} loadingLabel="Checking..." onClick={runCheck}>
          <RefreshCw className="size-4" />
          Check
        </Button>
        <Button
          variant={enabled ? "secondary" : "primary"}
          disabled={pending}
          loading={pendingAction === "toggle"}
          loadingLabel={enabled ? "Disabling..." : "Enabling..."}
          onClick={toggleEnabled}
        >
          {enabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>
      {error && <p className="max-w-sm text-xs text-rose-700">{error}</p>}
    </div>
  );
}
