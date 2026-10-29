import Link from "next/link";
import type { Tone } from "@/lib/health";
import { cn } from "@/lib/utils";

const cell: Record<Tone, string> = {
  ok: "bg-ok/80 hover:bg-ok",
  warn: "bg-warn/85 hover:bg-warn",
  crit: "bg-crit hover:bg-crit",
  idle: "bg-idle/40 hover:bg-idle/70"
};

export type StripItem = { id: string; href: string; name: string; kind: string; tone: Tone; label: string };

/** One cell per monitored thing. Problems sort first so they are never off-screen. */
export function StatusStrip({ items }: { items: StripItem[] }) {
  const order: Record<Tone, number> = { crit: 0, warn: 1, idle: 2, ok: 3 };
  const sorted = [...items].sort((a, b) => order[a.tone] - order[b.tone] || a.name.localeCompare(b.name));
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Status of every monitored server and endpoint">
      {sorted.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <Link
            href={item.href}
            className={cn("block h-7 w-4 rounded-sm transition-colors sm:w-5", cell[item.tone])}
            title={`${item.kind}: ${item.name} — ${item.label}`}
            aria-label={`${item.kind} ${item.name}: ${item.label}`}
          />
        </li>
      ))}
    </ul>
  );
}
