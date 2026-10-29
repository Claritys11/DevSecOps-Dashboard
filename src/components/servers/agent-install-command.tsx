"use client";

import { TriangleAlert } from "lucide-react";
import { CopyBlock } from "@/components/ui/copy-block";
import { useOrigin } from "@/lib/client-hooks";

function shellQuote(value: string) {
  return /^[A-Za-z0-9._:/@-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

export function AgentInstallCommand({ agentId, token, serverName }: { agentId: string; token: string; serverName?: string }) {
  const origin = useOrigin();
  if (!origin) return null;

  const isLocal = /^(localhost|127\.|\[::1\])/.test(new URL(origin).hostname);
  const command = [
    `curl -fsSL ${origin}/api/agents/install | sudo sh -s --`,
    `--url ${origin}`,
    `--id ${agentId}`,
    `--token ${token}`,
    serverName ? `--name ${shellQuote(serverName)}` : null
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-3">
      <CopyBlock value={command} secret />
      <ul className="space-y-1.5 text-xs text-muted">
        <li>Run it on the Linux machine you want to monitor. It installs a small agent as a systemd service.</li>
        <li>The token is shown only now. If you lose it, generate a new one from the server page.</li>
      </ul>
      {isLocal && (
        <p className="flex gap-2 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          <span>
            This command points at <span className="font-mono">{origin}</span>, which only works on this machine. To install on another machine, open the dashboard
            by its network address (for example <span className="font-mono">http://192.168.1.10:{new URL(origin).port || 80}</span>) and copy the command from there.
          </span>
        </p>
      )}
    </div>
  );
}
