import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function formatByteCount(bytes: bigint | number | null | undefined) {
  if (bytes == null) return "—";
  let value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(ms?: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatPercent(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatUptime(seconds?: bigint | number | null) {
  if (seconds == null) return "—";
  const totalSeconds = typeof seconds === "bigint" ? Number(seconds) : seconds;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatRelative(date: Date | string | null | undefined, now = Date.now()) {
  if (!date) return "never";
  const diffSeconds = Math.round((new Date(date).getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);
  const future = diffSeconds > 0;
  let text: string;
  if (abs < 10) return future ? "in a moment" : "just now";
  if (abs < 60) text = `${abs}s`;
  else if (abs < 3600) text = `${Math.floor(abs / 60)}m`;
  else if (abs < 86400) text = `${Math.floor(abs / 3600)}h`;
  else text = `${Math.floor(abs / 86400)}d`;
  return future ? `in ${text}` : `${text} ago`;
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function slugify(value: string, max = 40) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}
