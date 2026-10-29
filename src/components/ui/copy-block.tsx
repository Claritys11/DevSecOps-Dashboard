"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyBlock({ value, className, secret = false }: { value: string; className?: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea on plain-http LAN installs.
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={cn("group relative rounded border bg-bg", className)}>
      <pre className={cn("overflow-x-auto whitespace-pre-wrap break-all p-3 pr-24 font-mono text-xs leading-5", secret && "select-all")}>{value}</pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border bg-surface px-2 py-1 text-2xs font-medium text-muted hover:text-fg"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
