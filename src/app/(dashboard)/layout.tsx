import Link from "next/link";
import { redirect } from "next/navigation";
import { Container, Gauge, GlobeLock, LogOut, Server, ShieldCheck } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/containers", label: "Containers", icon: Container },
  { href: "/endpoints", label: "Endpoints", icon: GlobeLock }
];

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card p-4 lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold">DevSecOps</p>
            <p className="text-xs text-muted-foreground">Homelab dashboard</p>
          </div>
        </Link>
        <nav className="space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex h-10 items-center gap-3 rounded px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-medium">{session.user.email}</p>
            <p className="text-xs text-muted-foreground">{session.user.role}</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary"><LogOut className="size-4" /> Logout</Button>
          </form>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
