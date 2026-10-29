"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";

export type EndpointValues = { id?: string; name: string; url: string; expectedStatus: number; intervalSeconds: number; timeoutMs: number; serverId: string | null };

const blank: EndpointValues = { name: "", url: "", expectedStatus: 200, intervalSeconds: 60, timeoutMs: 5000, serverId: null };

const intervals = [
  { value: 30, label: "Every 30 seconds" },
  { value: 60, label: "Every minute" },
  { value: 300, label: "Every 5 minutes" },
  { value: 900, label: "Every 15 minutes" },
  { value: 3600, label: "Every hour" }
];

export function EndpointFormButton({ endpoint, servers, autoOpen = false }: { endpoint?: EndpointValues; servers: Array<{ id: string; name: string }>; autoOpen?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const editing = Boolean(endpoint?.id);
  const [open, setOpen] = useState(() => autoOpen && params.get("add") === "1");
  const [values, setValues] = useState<EndpointValues>(endpoint ?? blank);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof EndpointValues>(key: K, value: EndpointValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function onUrlBlur() {
    // Suggest a name from the hostname so the common case is just "paste URL, save".
    if (values.name || !values.url) return;
    try {
      set("name", new URL(values.url).hostname.replace(/^www\./, ""));
    } catch {}
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { id, ...body } = values;
    const result = editing ? await api(`/api/endpoints/${id}`, "PATCH", body) : await api("/api/endpoints", "POST", body);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    if (!editing) setValues(blank);
    if (params.get("add")) router.replace("/endpoints");
    router.refresh();
  }

  return (
    <>
      {editing ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Edit ${endpoint?.name}`}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add endpoint
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${endpoint?.name}` : "Add an endpoint"}
        description={editing ? undefined : "The first check runs within a few seconds of saving."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form={`endpoint-form-${endpoint?.id ?? "new"}`} loading={pending} loadingLabel="Saving">
              {editing ? "Save changes" : "Add endpoint"}
            </Button>
          </>
        }
      >
        <form id={`endpoint-form-${endpoint?.id ?? "new"}`} onSubmit={submit} className="space-y-4">
          <Field label="URL" hint="HTTPS endpoints also get their certificate expiry tracked.">
            <Input type="url" value={values.url} onChange={(event) => set("url", event.target.value)} onBlur={onUrlBlur} placeholder="https://example.com/health" required autoFocus={!editing} />
          </Field>
          <Field label="Name">
            <Input value={values.name} onChange={(event) => set("name", event.target.value)} required minLength={2} maxLength={80} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Check">
              <Select value={values.intervalSeconds} onChange={(event) => set("intervalSeconds", Number(event.target.value))}>
                {intervals.map((interval) => (
                  <option key={interval.value} value={interval.value}>{interval.label}</option>
                ))}
                {!intervals.some((interval) => interval.value === values.intervalSeconds) && <option value={values.intervalSeconds}>Every {values.intervalSeconds}s</option>}
              </Select>
            </Field>
            <Field label="Runs on (optional)">
              <Select value={values.serverId ?? ""} onChange={(event) => set("serverId", event.target.value || null)}>
                <option value="">Not linked</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>{server.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          {showAdvanced ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expected status code" hint="Anything else counts as a failure.">
                <Input type="number" min={100} max={599} value={values.expectedStatus} onChange={(event) => set("expectedStatus", Number(event.target.value))} />
              </Field>
              <Field label="Timeout (ms)">
                <Input type="number" min={500} max={30000} step={500} value={values.timeoutMs} onChange={(event) => set("timeoutMs", Number(event.target.value))} />
              </Field>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdvanced(true)} className="text-xs font-medium text-accent hover:underline">
              Expected status {values.expectedStatus}, timeout {values.timeoutMs / 1000}s. Change
            </button>
          )}
          <FormError>{error}</FormError>
        </form>
      </Dialog>
    </>
  );
}
