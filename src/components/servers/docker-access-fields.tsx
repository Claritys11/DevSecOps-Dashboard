"use client";

import { useId } from "react";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type DockerAccess = "none" | "local" | "remote";

const options: Array<{ value: DockerAccess; title: string; body: string }> = [
  { value: "none", title: "Metrics only", body: "CPU, memory, disk and network from the agent." },
  { value: "local", title: "Same machine as the dashboard", body: "Use the Docker socket mounted into the dashboard." },
  { value: "remote", title: "Remote Docker API", body: "Connect to tcp://host:2375 on a trusted network." }
];

export function DockerAccessFields({ value, endpoint, onChange, onEndpointChange }: { value: DockerAccess; endpoint: string; onChange: (value: DockerAccess) => void; onEndpointChange: (value: string) => void }) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-xs font-medium">Containers</legend>
      {options.map((option) => (
        <label key={option.value} className={cn("flex cursor-pointer gap-3 rounded border p-3 transition-colors", value === option.value ? "border-accent bg-accent/5" : "hover:bg-raised/60")}>
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="mt-0.5 accent-[rgb(var(--accent))]" />
          <span>
            <span className="block text-sm font-medium">{option.title}</span>
            <span className="block text-xs text-muted">{option.body}</span>
          </span>
        </label>
      ))}
      {value === "remote" && (
        <Field label="Docker API address" hint="Only expose the Docker API on a private network you trust.">
          <Input value={endpoint} onChange={(event) => onEndpointChange(event.target.value)} placeholder="tcp://192.168.1.20:2375" required />
        </Field>
      )}
    </fieldset>
  );
}
