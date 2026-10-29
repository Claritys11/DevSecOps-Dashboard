"use client";

import { useNow } from "@/lib/client-hooks";
import { formatDateTime, formatRelative } from "@/lib/utils";

/** "12s ago" that keeps ticking; the absolute time is in the tooltip. */
export function RelativeTime({ date, className }: { date: Date | string | null | undefined; className?: string }) {
  const now = useNow();
  if (!date) return <span className={className}>never</span>;
  return (
    <time dateTime={new Date(date).toISOString()} title={formatDateTime(date)} className={className} suppressHydrationWarning>
      {formatRelative(date, now ?? undefined)}
    </time>
  );
}
