"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { AgentInstallCommand } from "@/components/servers/agent-install-command";
import { DockerAccessFields, type DockerAccess } from "@/components/servers/docker-access-fields";

type ServerInfo = { id: string; name: string; environment: string; description: string | null; dockerAccess: DockerAccess; dockerEndpoint: string | null };

export function InstallAgentButton({ server, connected }: { server: Pick<ServerInfo, "id" | "name">; connected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ agentId: string; token: string } | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const result = await api<{ agentId: string; token: string }>(`/api/servers/${server.id}/token`, "POST");
    setPending(false);
    if (!result.ok) return setError(result.error);
    setCredentials(result.data);
    setConfirming(false);
    router.refresh();
  }

  function close() {
    setOpen(false);
    setTimeout(() => {
      setCredentials(null);
      setConfirming(false);
      setError(null);
    }, 150);
  }

  return (
    <>
      <Button variant={connected ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        <KeyRound className="size-4" /> {connected ? "Reinstall agent" : "Install agent"}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        size={credentials ? "lg" : "md"}
        title={credentials ? `Install the agent on ${server.name}` : connected ? "Generate a new agent token?" : "Get the install command"}
        description={credentials ? "Copy this command and run it on that machine." : undefined}
        footer={
          credentials ? (
            <Button variant="primary" onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button variant={connected && !confirming ? "danger" : "primary"} loading={pending} loadingLabel="Generating" onClick={connected && !confirming ? () => setConfirming(true) : generate}>
                {connected && !confirming ? "Replace token" : "Generate command"}
              </Button>
            </>
          )
        }
      >
        {credentials ? (
          <AgentInstallCommand agentId={credentials.agentId} token={credentials.token} serverName={server.name} />
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              {connected
                ? "This creates a new token and immediately disconnects the agent that is running now. Run the new command on the server to reconnect it."
                : "Tokens are stored hashed, so the dashboard creates a fresh one each time you ask for the command."}
            </p>
            {confirming && <p className="font-medium text-crit">Click Generate command to confirm. The current agent stops reporting right away.</p>}
            <FormError>{error}</FormError>
          </div>
        )}
      </Dialog>
    </>
  );
}

export function EditServerButton({ server }: { server: ServerInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(server.name);
  const [environment, setEnvironment] = useState(server.environment);
  const [dockerAccess, setDockerAccess] = useState<DockerAccess>(server.dockerAccess);
  const [dockerEndpoint, setDockerEndpoint] = useState(server.dockerEndpoint ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await api(`/api/servers/${server.id}`, "PATCH", { name, environment, description: server.description ?? undefined, dockerAccess, dockerEndpoint: dockerEndpoint || undefined });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit server"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="edit-server" loading={pending} loadingLabel="Saving">Save changes</Button>
          </>
        }
      >
        <form id="edit-server" onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} />
          </Field>
          <Field label="Group">
            <Input value={environment} onChange={(event) => setEnvironment(event.target.value)} maxLength={40} />
          </Field>
          <DockerAccessFields value={dockerAccess} endpoint={dockerEndpoint} onChange={setDockerAccess} onEndpointChange={setDockerEndpoint} />
          <FormError>{error}</FormError>
        </form>
      </Dialog>
    </>
  );
}

export function DeleteServerButton({ server }: { server: Pick<ServerInfo, "id" | "name"> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const result = await api(`/api/servers/${server.id}`, "DELETE");
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push("/servers");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" className="text-crit hover:text-crit" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Remove
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Remove ${server.name}?`}
        description="Its metrics history and container list are deleted. Linked endpoints are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={typed !== server.name} loading={pending} loadingLabel="Removing" onClick={remove}>Remove server</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={`Type ${server.name} to confirm`}>
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </Field>
          <p className="text-xs text-muted">
            To stop the agent on that machine as well, run <span className="font-mono">curl -fsSL {"<dashboard>"}/api/agents/install | sudo sh -s -- --uninstall</span>
          </p>
          <FormError>{error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
