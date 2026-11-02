"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Info, MoreHorizontal, RotateCcw, ShieldCheck, Square, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { PROTECTION_LEVELS } from "@/components/containers/protection";

type Action = "restart" | "stop" | "delete" | "protection";
type ReasonFile = { written: true; path: string } | { written: false; reason: string };

const copy: Record<Exclude<Action, "protection">, { title: string; verb: string; pending: string; body: string }> = {
  restart: { title: "Restart", verb: "Restart container", pending: "Restarting", body: "The container stops and starts again. Expect a few seconds of downtime." },
  stop: { title: "Stop", verb: "Stop container", pending: "Stopping", body: "The container stays stopped until something starts it again." },
  delete: { title: "Delete", verb: "Delete container", pending: "Deleting", body: "The container is removed. Its image and named volumes are kept. It must be stopped first." }
};

export function ContainerActions({
  serverId,
  container,
  canOperate,
  canDelete,
  canProtect,
  onDetailPage = false
}: {
  serverId: string;
  container: { id: string; name: string; state: string; protectionLevel: string; protectionOverride: boolean };
  canOperate: boolean;
  canDelete: boolean;
  canProtect: boolean;
  onDetailPage?: boolean;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [menu, setMenu] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [level, setLevel] = useState(container.protectionLevel);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ReasonFile | null>(null);
  const isProtected = container.protectionLevel === "PROTECTED";
  const base = `/api/servers/${serverId}/containers/${encodeURIComponent(container.id)}`;

  function open(next: Action) {
    setMenu(false);
    setReason("");
    setConfirmName("");
    setLevel(container.protectionLevel);
    setError(null);
    setSaved(null);
    setAction(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!action) return;
    setPending(true);
    setError(null);
    const result =
      action === "protection"
        ? await api<{ reasonFile?: ReasonFile }>(`${base}/protection`, "PATCH", { protectionLevel: level, reason })
        : await api<{ reasonFile?: ReasonFile }>(`${base}/${action}`, action === "delete" ? "DELETE" : "POST", { reason, confirmName: action === "delete" ? confirmName : undefined, idempotencyKey: crypto.randomUUID() });
    setPending(false);
    if (!result.ok) return setError(result.error);
    if (result.data.reasonFile) setSaved(result.data.reasonFile);
    else finish();
  }

  function finish() {
    const deleted = action === "delete";
    setAction(null);
    setSaved(null);
    if (deleted && onDetailPage) router.push("/containers");
    router.refresh();
  }

  const details = action && action !== "protection" ? copy[action] : null;
  const canSubmit = reason.trim().length >= 3 && (action !== "delete" || confirmName === container.name);

  return (
    <div className="relative flex items-center justify-end gap-1">
      {!onDetailPage && (
        <Link href={`/containers/${serverId}/${encodeURIComponent(container.id)}`} className={buttonClass({ variant: "ghost", size: "sm" })}>
          Details
        </Link>
      )}
      {canOperate && !isProtected && (
        <Button size="sm" variant="ghost" onClick={() => open("restart")}>
          <RotateCcw className="size-3.5" /> Restart
        </Button>
      )}
      {(canOperate || canProtect) && (
        <Button size="icon" variant="ghost" onClick={() => setMenu((value) => !value)} aria-label={`More actions for ${container.name}`} aria-expanded={menu}>
          <MoreHorizontal className="size-4" />
        </Button>
      )}
      {menu && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setMenu(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 rounded-md border bg-surface p-1 shadow-lg" role="menu">
            {canOperate && !isProtected && (
              <MenuItem icon={Square} onClick={() => open("stop")} disabled={container.state !== "running"}>Stop</MenuItem>
            )}
            {canDelete && !isProtected && (
              <MenuItem icon={Trash2} onClick={() => open("delete")} danger>Delete</MenuItem>
            )}
            {canProtect && <MenuItem icon={ShieldCheck} onClick={() => open("protection")}>Change protection</MenuItem>}
            {isProtected && !canProtect && <p className="px-2 py-1.5 text-2xs text-muted">Protected. Ask an admin to change this.</p>}
          </div>
        </>
      )}

      <Dialog
        open={action !== null}
        onClose={saved ? finish : () => setAction(null)}
        title={saved ? "Done" : action === "protection" ? `Protection for ${container.name}` : `${details?.title} ${container.name}?`}
        description={saved ? undefined : action === "protection" ? "Protected containers cannot be restarted, stopped or deleted from the dashboard." : details?.body}
        footer={
          saved ? (
            <Button variant="primary" onClick={finish}>Close</Button>
          ) : (
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button
              type="submit"
              form={`container-action-${container.id}`}
              variant={action === "delete" || action === "stop" ? "danger" : "primary"}
              disabled={!canSubmit}
              loading={pending}
              loadingLabel={action === "protection" ? "Saving" : details?.pending}
            >
              {action === "protection" ? "Save protection" : details?.verb}
            </Button>
          </>
          )
        }
      >
        {saved ? (
          <div className="flex gap-2.5 text-sm">
            {saved.written ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <Info className="mt-0.5 size-4 shrink-0 text-muted" />}
            {saved.written ? (
              <p>
                The reason is saved in the activity log and in <span className="break-all font-mono text-xs">{saved.path}</span>
              </p>
            ) : (
              <p>
                The reason is saved in the activity log only. <span className="text-muted">{saved.reason}</span>
              </p>
            )}
          </div>
        ) : (
        <form id={`container-action-${container.id}`} onSubmit={submit} className="space-y-4">
          {action === "protection" && (
            <Field label="Protection level" hint={PROTECTION_LEVELS.find((item) => item.value === level)?.description}>
              <Select value={level} onChange={(event) => setLevel(event.target.value)}>
                {PROTECTION_LEVELS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Reason" hint="Saved with your name in the activity log and in the container's Compose folder.">
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={action === "restart" ? "Picking up new config" : "Why are you doing this?"} required minLength={3} maxLength={500} autoFocus />
          </Field>
          {action === "delete" && (
            <Field label={`Type ${container.name} to confirm`}>
              <Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoComplete="off" spellCheck={false} />
            </Field>
          )}
          <FormError>{error}</FormError>
        </form>
        )}
      </Dialog>
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger = false, disabled = false }: { icon: typeof Square; children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-raised disabled:opacity-40 ${danger ? "text-crit" : ""}`}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}
