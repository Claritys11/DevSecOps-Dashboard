import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/server/auth/guards";
import { availableAgentPlatforms } from "@/server/services/agent-distribution-service";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/card";
import { Tag } from "@/components/ui/status";
import { RelativeTime } from "@/components/relative-time";
import { AddUserButton, ChangePasswordForm, RemoveUserButton } from "@/components/settings/user-admin";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const roleLabel: Record<string, string> = { ADMIN: "Admin", MAINTAINER: "Maintainer", VIEWER: "Viewer" };

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = hasRole(session?.user.role, "ADMIN");
  const users = isAdmin ? await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" } }) : [];

  const config = [
    { label: "Version", value: packageJson.version },
    { label: "Monitor private networks", value: process.env.MONITOR_ALLOW_PRIVATE_NETWORKS === "true" ? "Allowed" : "Blocked" },
    { label: "Docker on this host", value: process.env.ENABLE_DOCKER_SOCKET === "true" ? "Connected" : "Not connected" },
    { label: "Metrics kept for", value: `${process.env.METRICS_RETENTION_DAYS ?? 30} days` },
    { label: "Agent offline after", value: `${process.env.SERVER_OFFLINE_AFTER_MINUTES ?? 10} minutes without data` },
    { label: "Agent builds bundled", value: availableAgentPlatforms().join(", ") || "None (development build)" }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account, who can sign in, and how this install is configured." />

      <Section title="Your password">
        <ChangePasswordForm />
      </Section>

      {isAdmin && (
        <Section title="Users" description="Viewers can look, maintainers can operate, admins can change everything." action={<AddUserButton />} flush>
          <ul className="divide-y">
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {user.name || user.email}
                    {user.id === session?.user.id && <span className="text-xs font-normal text-muted"> (you)</span>}
                  </p>
                  {user.name && <p className="truncate text-xs text-muted">{user.email}</p>}
                </div>
                <Tag>{roleLabel[user.role]}</Tag>
                <span className="hidden text-xs text-muted sm:inline">
                  added <RelativeTime date={user.createdAt} />
                </span>
                {user.id !== session?.user.id ? <RemoveUserButton user={user} /> : <span className="size-8" />}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="This install" description="Change these in .env, then run docker compose up -d." flush>
        <dl className="divide-y text-sm">
          {config.map((item) => (
            <div key={item.label} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted">{item.label}</dt>
              <dd className="text-right">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
