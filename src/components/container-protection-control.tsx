"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const levels = ["PROTECTED", "MANAGED", "UNMANAGED", "EPHEMERAL"] as const;

export function ContainerProtectionControl({
  serverId,
  containerId,
  containerName,
  value,
  overridden
}: {
  serverId: string;
  containerId: string;
  containerName: string;
  value: string;
  overridden: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateProtection(protectionLevel: string) {
    if (protectionLevel === value) return;
    const reason = window.prompt(`Reason for changing protection on ${containerName}`);
    if (!reason) return;

    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/servers/${serverId}/containers/${containerId}/protection`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protectionLevel, reason })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Unable to update protection");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <select
        className="h-9 rounded border bg-background px-2 text-sm"
        value={value}
        disabled={pending}
        onChange={(event) => updateProtection(event.target.value)}
      >
        {levels.map((level) => (
          <option key={level} value={level}>{level}</option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{pending ? "Saving..." : overridden ? "Manual" : "Auto"}</p>
      {error && <p className="max-w-40 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
