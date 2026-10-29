"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";

const roles = [
  { value: "VIEWER", label: "Viewer", body: "Can see everything, change nothing." },
  { value: "MAINTAINER", label: "Maintainer", body: "Can also acknowledge alerts, run checks, restart and stop containers." },
  { value: "ADMIN", label: "Admin", body: "Full access, including servers, endpoints and users." }
];

export function AddUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await api("/api/users", "POST", form);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setForm({ name: "", email: "", password: "", role: "VIEWER" });
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5" /> Add user
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a user"
        description="Share the password with them yourself. They can change it after signing in."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="add-user" loading={pending} loadingLabel="Adding">Add user</Button>
          </>
        }
      >
        <form id="add-user" onSubmit={submit} className="space-y-4">
          <Field label="Name (optional)">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </Field>
          <Field label="Temporary password" hint="At least 12 characters.">
            <Input type="text" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={12} required autoComplete="off" />
          </Field>
          <Field label="Role" hint={roles.find((role) => role.value === form.role)?.body}>
            <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </Select>
          </Field>
          <FormError>{error}</FormError>
        </form>
      </Dialog>
    </>
  );
}

export function RemoveUserButton({ user }: { user: { id: string; email: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    const result = await api(`/api/users/${user.id}`, "DELETE");
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="icon" variant="ghost" className="text-crit hover:text-crit" onClick={() => setOpen(true)} aria-label={`Remove ${user.email}`}>
        <Trash2 className="size-3.5" />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Remove ${user.email}?`}
        description="They are signed out the next time their session is checked. Their past activity stays in the log."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={pending} loadingLabel="Removing" onClick={remove}>Remove user</Button>
          </>
        }
      >
        <FormError>{error}</FormError>
      </Dialog>
    </>
  );
}

export function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (form.newPassword !== form.confirm) return setError("The new passwords do not match");
    setPending(true);
    setError(null);
    const result = await api("/api/account/password", "POST", { currentPassword: form.currentPassword, newPassword: form.newPassword });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setForm({ currentPassword: "", newPassword: "", confirm: "" });
    setSaved(true);
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4">
      <Field label="Current password">
        <Input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 12 characters.">
        <Input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} autoComplete="new-password" minLength={12} required />
      </Field>
      <Field label="Repeat new password">
        <Input type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} autoComplete="new-password" required />
      </Field>
      <FormError>{error}</FormError>
      {saved && <p className="text-xs text-ok">Password changed.</p>}
      <Button type="submit" variant="primary" loading={pending} loadingLabel="Saving">Change password</Button>
    </form>
  );
}
