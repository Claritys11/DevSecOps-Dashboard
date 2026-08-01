"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Power, PowerOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EndpointActions({ endpointId, enabled }: { endpointId: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runCheck() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/endpoints/${endpointId}/check`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Unable to check endpoint");
        return;
      }
      router.refresh();
    });
  }

  function toggleEnabled() {
    setError(null);
    startTransition(async () => {
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
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={runCheck}>
          <RefreshCw className="size-4" />
          Check
        </Button>
        <Button variant={enabled ? "secondary" : "primary"} disabled={pending} onClick={toggleEnabled}>
          {enabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>
      {error && <p className="max-w-sm text-xs text-rose-700">{error}</p>}
    </div>
  );
}
