export const PROTECTION_LEVELS = [
  { value: "PROTECTED", label: "Protected", description: "Read-only in the dashboard. Used automatically for databases, proxies and the dashboard itself." },
  { value: "MANAGED", label: "Managed", description: "Can be restarted and stopped by maintainers, and deleted by admins." },
  { value: "EPHEMERAL", label: "Ephemeral", description: "Short-lived jobs and workers. Manageable like Managed." },
  { value: "UNMANAGED", label: "Unmanaged", description: "Not classified yet. Manageable like Managed." }
] as const;

export function protectionLabel(level: string) {
  return PROTECTION_LEVELS.find((item) => item.value === level)?.label ?? level;
}
