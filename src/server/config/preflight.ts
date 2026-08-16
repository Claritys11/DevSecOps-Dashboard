import "dotenv/config";
import { findUnsafeEnvSettings, parseAppEnv, type ValidationMode } from "./env";

export function runPreflight(source: NodeJS.ProcessEnv = process.env, mode: ValidationMode = process.env.NODE_ENV === "production" ? "production" : "development") {
  const problems: string[] = [];
  const parsed = parseAppEnv(source);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`${issue.path.join(".") || "environment"}: ${issue.message}`);
    }
  }

  problems.push(...findUnsafeEnvSettings(source, mode));

  if (source.POSTGRES_HOST_PORT && source.POSTGRES_HOST_PORT === source.APP_PORT) {
    problems.push("POSTGRES_HOST_PORT must not match APP_PORT.");
  }

  if (mode === "production" && source.DOCKER_SOCKET_PATH && source.ENABLE_DOCKER_SOCKET !== "true") {
    problems.push("DOCKER_SOCKET_PATH is set in production. Set ENABLE_DOCKER_SOCKET=true only when host-level Docker privileges are intended.");
  }

  return [...new Set(problems)];
}

if (process.argv[1]?.endsWith("preflight.ts")) {
  const mode = process.argv.includes("--production") ? "production" : process.argv.includes("--development") ? "development" : undefined;
  const problems = runPreflight(process.env, mode);
  if (problems.length > 0) {
    console.error("Configuration preflight failed:");
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log("Configuration preflight passed.");
}
