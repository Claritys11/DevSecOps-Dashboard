import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status?: string | null }) {
  const normalized = status?.toUpperCase();
  const tone = normalized === "HEALTHY" || normalized === "ONLINE" || normalized === "RUNNING" ? "good" : normalized === "DOWN" || normalized === "OFFLINE" || normalized === "EXITED" ? "bad" : normalized === "DEGRADED" ? "warn" : "neutral";
  return <Badge tone={tone}>{status ?? "UNKNOWN"}</Badge>;
}
