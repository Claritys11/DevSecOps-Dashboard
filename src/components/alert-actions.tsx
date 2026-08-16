"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AcknowledgeAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/alerts/${alertId}/ack`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Unable to acknowledge alert");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        loading={pending}
        loadingLabel="Ack..."
        onClick={acknowledge}
      >
        <CheckCircle2 className="size-4" />
        Ack
      </Button>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
