"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { AgentInstallCommand } from "@/components/servers/agent-install-command";
import { DockerAccessFields, type DockerAccess } from "@/components/servers/docker-access-fields";

type Created = { server: { id: string; name: string }; agentId: string; token: string };

export function AddServerButton({ autoOpen = false }: { autoOpen?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(() => autoOpen && params.get("add") === "1");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("");
  const [dockerAccess, setDockerAccess] = useState<DockerAccess>("none");
  const [dockerEndpoint, setDockerEndpoint] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  function close() {
    setOpen(false);
    if (params.get("add")) router.replace("/servers");
    if (created) router.push(`/servers/${created.server.id}`);
    setTimeout(() => {
      setName("");
      setEnvironment("");
      setDockerAccess("none");
      setDockerEndpoint("");
      setCreated(null);
      setError(null);
    }, 150);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await api<Created>("/api/servers", "POST", { name, environment: environment || undefined, dockerAccess, dockerEndpoint: dockerEndpoint || undefined });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setCreated(result.data);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add server
      </Button>
      <Dialog
        open={open}
        onClose={close}
        size={created ? "lg" : "md"}
        title={created ? `Install the agent on ${created.server.name}` : "Add a server"}
        description={created ? "Copy this command and run it on that machine." : "You get a one-line install command for the agent next."}
        footer={
          created ? (
            <Button variant="primary" onClick={close}>Done, open server</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button variant="primary" type="submit" form="add-server" loading={pending} loadingLabel="Adding">Add server</Button>
            </>
          )
        }
      >
        {created ? (
          <AgentInstallCommand agentId={created.agentId} token={created.token} serverName={created.server.name} />
        ) : (
          <form id="add-server" onSubmit={submit} className="space-y-4">
            <Field label="Name" hint="How it appears in the dashboard, for example nas or proxmox-01.">
              <Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoFocus />
            </Field>
            <Field label="Group (optional)" hint="Used to tell environments apart, for example homelab or production.">
              <Input value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="homelab" maxLength={40} />
            </Field>
            <DockerAccessFields value={dockerAccess} endpoint={dockerEndpoint} onChange={setDockerAccess} onEndpointChange={setDockerEndpoint} />
            <FormError>{error}</FormError>
          </form>
        )}
      </Dialog>
    </>
  );
}
