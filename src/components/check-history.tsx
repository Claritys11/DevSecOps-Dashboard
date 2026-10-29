import { endpointTone } from "@/lib/health";
import { cn, formatDateTime, formatDuration } from "@/lib/utils";
import { toneBg } from "@/components/ui/status";

type Check = { status: string; statusCode: number | null; responseTimeMs: number | null; checkedAt: Date; error?: string | null };

/** Last N checks as bars, oldest on the left. Empty slots show how much history is missing. */
export function CheckHistory({ checks, slots = 30, className }: { checks: Check[]; slots?: number; className?: string }) {
  const padded: Array<Check | null> = [...Array.from({ length: Math.max(0, slots - checks.length) }, () => null), ...checks.slice(-slots)];
  return (
    <div className={cn("flex h-5 items-stretch gap-px", className)} aria-label={`Last ${checks.length} checks`}>
      {padded.map((check, index) => (
        <span
          key={index}
          className={cn("w-1 flex-1 rounded-[1px]", check ? toneBg[endpointTone(check.status)] : "bg-raised")}
          title={check ? `${formatDateTime(check.checkedAt)} · ${check.statusCode ?? check.error ?? check.status} · ${formatDuration(check.responseTimeMs)}` : "No check yet"}
        />
      ))}
    </div>
  );
}
