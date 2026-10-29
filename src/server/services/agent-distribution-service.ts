import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const AGENT_PLATFORMS = ["linux-amd64", "linux-arm64"] as const;
export type AgentPlatform = (typeof AGENT_PLATFORMS)[number];

function agentDir() {
  return process.env.AGENT_DIR || path.join(process.cwd(), "agent");
}

export function agentBinaryPath(platform: AgentPlatform) {
  return path.join(agentDir(), "dist", `devsecops-agent-${platform}`);
}

export function availableAgentPlatforms() {
  return AGENT_PLATFORMS.filter((platform) => existsSync(agentBinaryPath(platform)));
}

/** Best-effort public origin, honouring reverse-proxy headers. */
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

let cachedScript: string | null = null;

export function renderInstallScript(defaultUrl: string) {
  cachedScript ??= readFileSync(path.join(agentDir(), "install.sh"), "utf8");
  // The URL lands inside a double-quoted shell string, so only allow URL-safe characters.
  const safeUrl = /^https?:\/\/[A-Za-z0-9.:\-[\]]+(\/[A-Za-z0-9._~\-/]*)?$/.test(defaultUrl) ? defaultUrl : "";
  return cachedScript.replace("__DEFAULT_URL__", safeUrl);
}
