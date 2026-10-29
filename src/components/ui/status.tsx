import type { Tone } from "@/lib/health";
import { cn } from "@/lib/utils";

const dot: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  idle: "bg-idle"
};

const text: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  idle: "text-muted"
};

export const toneText = text;
export const toneBg = dot;

export function StatusDot({ tone, pulse = false, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden="true">
      {pulse && tone === "crit" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-crit opacity-60 motion-reduce:hidden" />}
      <span className={cn("relative inline-flex size-2 rounded-full", dot[tone])} />
    </span>
  );
}

/** Status shown as coloured dot + plain-language label, never colour alone. */
export function Status({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", text[tone], className)}>
      <StatusDot tone={tone} />
      {label}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-px text-2xs font-medium text-muted", className)}>{children}</span>;
}
