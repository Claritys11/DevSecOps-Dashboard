"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function AcknowledgeAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setError(null);
    setPending(true);
    const result = await api(`/api/alerts/${alertId}/ack`, "POST");
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="shrink-0 text-right">
      <Button size="sm" loading={pending} loadingLabel="Saving" onClick={acknowledge} title="Mark as seen. It stays listed until the problem is resolved.">
        Acknowledge
      </Button>
      {error && <p className="mt-1 max-w-48 text-2xs text-crit">{error}</p>}
    </div>
  );
}
