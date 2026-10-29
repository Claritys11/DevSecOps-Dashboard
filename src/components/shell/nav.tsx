"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Activity, BellRing, Boxes, Globe, LayoutGrid, Menu, Server, Settings, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/endpoints", label: "Endpoints", icon: Globe },
  { href: "/containers", label: "Containers", icon: Boxes },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;

export type NavCounts = { alerts: number; criticalAlerts: number };

function NavLinks({ counts, onNavigate }: { counts: NavCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const badge = item.href === "/alerts" && counts.alerts > 0 ? counts.alerts : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded px-2.5 text-sm transition-colors",
              active ? "bg-raised font-medium text-fg" : "text-muted hover:bg-raised/60 hover:text-fg"
            )}
          >
            <item.icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {badge != null && (
              <span className={cn("tabular rounded px-1.5 text-2xs font-semibold leading-5", counts.criticalAlerts > 0 ? "bg-crit text-white dark:text-bg" : "bg-warn text-white dark:text-bg")}>
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1">
      <span className="grid size-8 place-items-center rounded bg-fg text-bg">
        <ShieldCheck className="size-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">DevSecOps</span>
        <span className="block text-2xs text-muted">Self-hosted monitor</span>
      </span>
    </Link>
  );
}

export function Sidebar({ counts, footer }: { counts: NavCounts; footer: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-surface px-3 py-4 lg:flex">
      <Brand />
      <div className="mt-6 flex-1">
        <NavLinks counts={counts} />
      </div>
      {footer}
    </aside>
  );
}

export function MobileNav({ counts, footer }: { counts: NavCounts; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="relative rounded p-1.5 text-muted hover:bg-raised hover:text-fg" aria-label="Open menu">
        <Menu className="size-5" />
        {counts.alerts > 0 && <span className={cn("absolute right-1 top-1 size-2 rounded-full", counts.criticalAlerts > 0 ? "bg-crit" : "bg-warn")} />}
      </button>
      {/* Portal: the sticky header uses backdrop-filter, which would trap a fixed overlay inside it. */}
      {open && createPortal(
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r bg-surface px-3 py-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1.5 text-muted hover:bg-raised" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-6 flex-1">
              <NavLinks counts={counts} onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
