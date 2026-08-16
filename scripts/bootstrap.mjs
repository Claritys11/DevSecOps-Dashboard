#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const envPath = ".env";
const examplePath = ".env.example";
const force = process.argv.includes("--force");
const yes = process.argv.includes("--yes");

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64");
}

function token() {
  return randomBytes(24).toString("base64url");
}

async function ask(rl, question, fallback) {
  if (yes) return fallback;
  const answer = await rl.question(`${question} (${fallback}): `);
  return answer.trim() || fallback;
}

function setEnv(content, key, value) {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const line = `${key}="${escaped}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

if (existsSync(envPath) && !force) {
  console.log(".env already exists. Use npm run setup -- --force to regenerate it.");
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error(".env.example not found.");
  process.exit(1);
}

const rl = createInterface({ input, output });

try {
  let env = readFileSync(examplePath, "utf8");
  const appUrl = await ask(rl, "Public app URL", "http://localhost:3000");
  const adminEmail = await ask(rl, "Admin email", "admin@example.com");
  const adminPassword = yes ? token() : await ask(rl, "Admin password", token());
  const postgresPassword = yes ? token() : await ask(rl, "Postgres password", token());
  const seedHomelab = yes ? "false" : await ask(rl, "Seed example homelab endpoints? true/false", "false");

  env = setEnv(env, "AUTH_URL", appUrl);
  env = setEnv(env, "AUTH_SECRET", secret());
  env = setEnv(env, "ADMIN_EMAIL", adminEmail);
  env = setEnv(env, "ADMIN_PASSWORD", adminPassword);
  env = setEnv(env, "POSTGRES_PASSWORD", postgresPassword);
  env = setEnv(env, "DATABASE_URL", `postgresql://devsecops:${postgresPassword}@localhost:5433/devsecops_dashboard?schema=public`);
  env = setEnv(env, "DASHBOARD_HEALTH_URL", `${appUrl.replace(/\/$/, "")}/api/health`);
  env = setEnv(env, "RUN_DATABASE_SEED", "false");
  env = setEnv(env, "MONITOR_ALLOW_PRIVATE_NETWORKS", "false");
  env = setEnv(env, "PRIMARY_AGENT_ID", "primary-linux-agent");
  env = setEnv(env, "PRIMARY_AGENT_TOKEN", token());
  env = setEnv(env, "SECONDARY_AGENT_ID", "");
  env = setEnv(env, "SECONDARY_AGENT_TOKEN", "");
  env = setEnv(env, "CACHYOS_AGENT_TOKEN", "");
  env = setEnv(env, "UBUNTU_NSPAWN_AGENT_TOKEN", "");
  env = setEnv(env, "SEED_HOMELAB_EXAMPLES", seedHomelab.toLowerCase() === "true" ? "true" : "false");
  if (seedHomelab.toLowerCase() === "true") {
    env = setEnv(env, "MONITOR_ALLOW_PRIVATE_NETWORKS", "true");
  }

  writeFileSync(envPath, env);
  console.log(".env generated.");
  console.log(`Admin login: ${adminEmail}`);
  console.log("Keep the generated passwords and agent tokens private.");
} finally {
  rl.close();
}
