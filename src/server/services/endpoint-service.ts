import { validateMonitorUrl } from "@/server/services/monitoring-service";

/** Returns a user-facing reason the worker would refuse this URL, or null when it is allowed. */
export async function explainBlockedUrl(url: string) {
  try {
    await validateMonitorUrl(url);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Blocked monitor target address") {
      return "This address is on a private or local network, which is blocked by default. Set MONITOR_ALLOW_PRIVATE_NETWORKS=true in .env to monitor homelab services.";
    }
    if (/ENOTFOUND|EAI_AGAIN|did not resolve/.test(message)) {
      return "That hostname does not resolve from the dashboard. Check the spelling or DNS.";
    }
    return message;
  }
}
