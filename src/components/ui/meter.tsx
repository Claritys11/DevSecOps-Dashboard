import { usageTone } from "@/lib/health";
import { cn, formatPercent } from "@/lib/utils";
import { toneBg } from "@/components/ui/status";

export function Meter({ label, value, critical = 90, detail, className }: { label: string; value: number | null | undefined; critical?: number; detail?: string; className?: string }) {
  const tone = usageTone(value, critical);
  const width = value == null ? 0 : Math.min(100, Math.max(2, value));
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("tabular font-mono", tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-fg")}>{formatPercent(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised" role="meter" aria-label={label} aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", value == null ? "bg-transparent" : toneBg[tone])} style={{ width: `${width}%` }} />
      </div>
      {detail && <p className="mt-1 truncate text-2xs text-muted">{detail}</p>}
    </div>
  );
}
