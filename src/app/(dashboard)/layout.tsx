import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { MobileNav, Sidebar, type NavCounts } from "@/components/shell/nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

const roleLabel = { ADMIN: "Admin", MAINTAINER: "Maintainer", VIEWER: "Viewer" } as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [alerts, criticalAlerts] = await Promise.all([
    prisma.alert.count({ where: { resolvedAt: null, acknowledgedAt: null } }),
    prisma.alert.count({ where: { resolvedAt: null, acknowledgedAt: null, severity: "CRITICAL" } })
  ]);
  const counts: NavCounts = { alerts, criticalAlerts };

  const account = (
    <div className="flex items-center gap-2 border-t px-1 pt-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{session.user.email}</p>
        <p className="text-2xs text-muted">{roleLabel[session.user.role] ?? session.user.role}</p>
      </div>
      <ThemeToggle />
      <form action={logoutAction}>
        <button type="submit" className="rounded p-1.5 text-muted hover:bg-raised hover:text-fg" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Sidebar counts={counts} footer={account} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b bg-bg/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <MobileNav counts={counts} footer={account} />
            <span className="text-sm font-semibold lg:hidden">DevSecOps</span>
          </div>
          <AutoRefresh />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
