"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";
import { useNow, useStoredValue } from "@/lib/client-hooks";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 15_000;

/** Re-renders server components on a timer while the tab is visible. */
export function AutoRefresh() {
  const router = useRouter();
  const [stored, setStored] = useStoredValue("auto-refresh");
  const paused = stored === "off";
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const now = useNow();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (paused) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setUpdatedAt(Date.now());
      startTransition(() => router.refresh());
    };
    const timer = setInterval(refresh, INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [paused, router]);

  const seconds = now == null ? 0 : Math.max(0, Math.round((now - updatedAt) / 1000));

  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      <button
        type="button"
        onClick={() => {
          setUpdatedAt(Date.now());
          startTransition(() => router.refresh());
        }}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-raised hover:text-fg"
        title="Refresh now"
      >
        <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
        <span className="tabular hidden sm:inline" suppressHydrationWarning>
          {paused ? "Live updates paused" : seconds < 3 ? "Updated just now" : `Updated ${seconds}s ago`}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setStored(paused ? "on" : "off")}
        className="rounded p-1 hover:bg-raised hover:text-fg"
        title={paused ? "Resume live updates" : "Pause live updates"}
        aria-label={paused ? "Resume live updates" : "Pause live updates"}
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </button>
    </div>
  );
}
