#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const envPath = ".env";
const examplePath = ".env.example";
const args = new Set(process.argv.slice(2));
const options = parseOptions(process.argv.slice(2));

const yes = args.has("--yes");
const force = args.has("--force");
let projectName = options.project ?? "devsecopsdash";
const preferredPort = Number(options.port ?? 3003);
const host = options.host ?? "localhost";
const adminEmailDefault = options.adminEmail ?? "admin@example.com";
const requestedDeploy = args.has("--deploy");
const requestedNoDeploy = args.has("--no-deploy");
const requestedSeed = args.has("--seed");
const requestedNoSeed = args.has("--no-seed");
const requestedDev = args.has("--dev");
const requestedProd = args.has("--prod");
const requestedDockerSocket = args.has("--with-docker-socket");
const requestedSelfMonitor = args.has("--self-monitor");
const requestedReuseEnv = args.has("--reuse-env");

function parseOptions(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? (rawArgs[index + 1]?.startsWith("--") ? undefined : rawArgs[index + 1]);
    if (value && inlineValue === undefined) index += 1;
    parsed[toCamelCase(key)] = value ?? "true";
  }
  return parsed;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function randomBase64(bytes = 32) {
  return randomBytes(bytes).toString("base64");
}

function randomToken() {
  return randomBytes(24).toString("base64url");
}

function randomHex(bytes = 24) {
  return randomBytes(bytes).toString("hex");
}

function setEnv(content, key, value) {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const line = `${key}="${escaped}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

function getEnv(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return undefined;
  return match[1].trim().replace(/^"|"$/g, "");
}

function envBoolean(content, key, fallback = false) {
  const value = getEnv(content, key);
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

async function ask(rl, question, fallback) {
  if (yes) return fallback;
  const answer = await rl.question(`${question} (${fallback}): `);
  return answer.trim() || fallback;
}

async function askBoolean(rl, question, fallback) {
  const value = await ask(rl, question, fallback ? "yes" : "no");
  return ["y", "yes", "true", "1"].includes(value.toLowerCase());
}

async function askPort(rl, question, fallback) {
  while (true) {
    const value = await ask(rl, question, String(fallback));
    const port = Number(value);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
    console.log("Please enter a valid TCP port from 1 to 65535.");
  }
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function findPort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No free port found from ${startPort} to ${startPort + 99}. Use --port <PORT>.`);
}

async function choosePort(rl, label, preferred, { autoDetect = true } = {}) {
  const requested = await askPort(rl, label, preferred);
  if (await isPortAvailable(requested)) return requested;
  if (!autoDetect) {
    throw new Error(`Port ${requested} is already in use. Re-run with another port.`);
  }

  const available = await findPort(requested + 1);
  console.log(`Port ${requested} is already in use. Using next free port: ${available}.`);
  return available;
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function ensureCommand(command, installHint) {
  if (commandExists(command)) return;
  throw new Error(`${command} is required. ${installHint}`);
}

function dockerComposeAvailable() {
  const result = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  return result.status === 0;
}

function countDockerContainers() {
  const result = spawnSync("docker", ["ps", "-a", "--format", "{{.ID}}"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.split("\n").filter(Boolean).length;
}

function detectDockerSocketGid(socketPath = "/var/run/docker.sock") {
  const result = spawnSync("stat", ["-c", "%g", socketPath], { encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function composeArgs({ useDevOverride, useDockerSocket }) {
  const files = ["-f", "docker-compose.yml"];
  if (useDevOverride) files.push("-f", "docker-compose.dev.yml");
  if (useDockerSocket) files.push("-f", "docker-compose.docker-socket.yml", "--profile", "docker-socket");
  return ["compose", "-p", projectName, ...files];
}

function composeCommand(settings) {
  return ["docker", ...composeArgs(settings)].join(" ");
}

function printSummary({ appPort, authUrl, adminEmail, agentId, shouldSeed, shouldDeploy, postgresHostPort, useDevOverride, useDockerSocket, useSelfMonitor }) {
  console.log("");
  console.log("Configuration ready.");
  console.log(`- Project name: ${projectName}`);
  console.log(`- App URL: ${authUrl}`);
  console.log(`- App port: ${appPort}`);
  if (useDevOverride) console.log(`- Postgres host port: ${postgresHostPort}`);
  console.log(`- Admin email: ${adminEmail}`);
  console.log(`- Agent ID: ${agentId}`);
  console.log(`- Deploy now: ${shouldDeploy ? "yes" : "no"}`);
  console.log(`- Seed enabled for this run: ${shouldSeed ? "yes" : "no"}`);
  console.log(`- Dashboard self-monitor endpoint: ${useSelfMonitor ? "enabled" : "disabled"}`);
  console.log(`- Docker socket access: ${useDockerSocket ? "enabled" : "disabled"}`);
  console.log("");
  console.log("Next commands:");
  console.log(`  ${composeCommand({ useDevOverride, useDockerSocket })} up -d --build`);
  console.log(`  RUN_DATABASE_SEED=true ${composeCommand({ useDevOverride, useDockerSocket })} run --rm app true`);
}

function printHelp() {
  console.log(`Usage: ./install.sh [options]

Creates .env with generated secrets, detects free ports, validates config, and optionally deploys.

Options:
  --deploy                 Build, start, and seed the stack without asking.
  --no-deploy              Generate and validate .env only.
  --seed                   Seed admin and agent credentials for an existing stack.
  --no-seed                Skip the seed step.
  --force                  Replace an existing .env.
  --reuse-env              Use existing .env and continue validation/deploy.
  --yes                    Use defaults for non-interactive installs.
  --port <PORT>            Start app port detection from PORT. Default: 3003.
  --postgres-port <PORT>   Start dev Postgres port detection from PORT. Default: 5433.
  --url <URL>              Public app URL. Default: http://localhost:<APP_PORT>.
  --project <NAME>         Docker Compose project name. Default: devsecopsdash.
  --admin-email <EMAIL>    Initial admin email. Default: admin@example.com.
  --agent-id <ID>          Primary agent ID. Default: primary-linux-agent.
  --dev                    Include docker-compose.dev.yml.
  --prod                   Use production Compose only.
  --self-monitor           Seed the dashboard health endpoint and allow private monitor URLs.
  --with-docker-socket     Opt in to privileged Docker socket access.
  --help                   Show this help.
`);
}

if (args.has("--help") || args.has("-h")) {
  printHelp();
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error(".env.example not found. Run this script from the repository root.");
  process.exit(1);
}

const rl = createInterface({ input, output });

try {
  ensureCommand("node", "Install Node.js 22 or newer.");
  ensureCommand("npm", "Install npm.");
  ensureCommand("docker", "Install Docker with Compose support.");
  if (!dockerComposeAvailable()) {
    throw new Error("Docker Compose is required. Install the Docker Compose plugin so `docker compose version` works.");
  }

  const envExists = existsSync(envPath);
  const useExistingEnv = envExists && !force && (requestedReuseEnv || (!yes && (await askBoolean(rl, ".env already exists. Use it instead of rewriting?", true))));
  if (envExists && !force && !useExistingEnv) {
    const overwrite = !yes && (await askBoolean(rl, "Replace existing .env?", false));
    if (!overwrite) {
      throw new Error("Install cancelled. Re-run with --reuse-env to use current .env or --force to replace it.");
    }
  }

  projectName = await ask(rl, "Compose project name", projectName);
  const existingEnv = envExists ? readFileSync(envPath, "utf8") : "";
  const useDevOverride = requestedDev || (!requestedProd && !yes && (await askBoolean(rl, "Use development override?", false)));
  const appPort = useExistingEnv ? Number(getEnv(existingEnv, "APP_PORT") ?? preferredPort) : await choosePort(rl, "App port", preferredPort);
  const postgresHostPort = useDevOverride && !useExistingEnv
    ? await choosePort(rl, "Postgres host port", Number(options.postgresPort ?? 5433))
    : Number(getEnv(existingEnv, "POSTGRES_HOST_PORT") ?? options.postgresPort ?? 5433);
  const defaultAuthUrl = options.url ?? `http://${host}:${appPort}`;
  const authUrl = useExistingEnv ? getEnv(existingEnv, "AUTH_URL") ?? defaultAuthUrl : await ask(rl, "Public app URL", defaultAuthUrl);
  const shouldDeploy = requestedDeploy || (!requestedNoDeploy && (await askBoolean(rl, "Build and start Docker Compose now?", true)));
  const shouldSeed = !requestedNoSeed && (requestedSeed || shouldDeploy);
  const useSelfMonitor = requestedSelfMonitor || (await askBoolean(rl, "Seed dashboard self-monitor endpoint?", envBoolean(existingEnv, "SEED_DASHBOARD_ENDPOINT", false)));
  const containerCount = countDockerContainers();
  const dockerSocketQuestion = containerCount == null
    ? "Enable host Docker container inventory?"
    : `Enable host Docker container inventory? Detected ${containerCount} local Docker containers`;
  const useDockerSocket = requestedDockerSocket || (await askBoolean(rl, dockerSocketQuestion, envBoolean(existingEnv, "ENABLE_DOCKER_SOCKET", false)));
  const dockerSocketPath = useDockerSocket ? getEnv(existingEnv, "DOCKER_SOCKET_PATH") || "/var/run/docker.sock" : "";
  const dockerSocketGid = useDockerSocket ? detectDockerSocketGid(dockerSocketPath) : "";

  let adminEmail = getEnv(existingEnv, "ADMIN_EMAIL") ?? adminEmailDefault;
  let agentId = getEnv(existingEnv, "PRIMARY_AGENT_ID") ?? options.agentId ?? "primary-linux-agent";

  if (useExistingEnv) {
    let env = existingEnv;
    env = setEnv(env, "SEED_DASHBOARD_ENDPOINT", useSelfMonitor ? "true" : "false");
    env = setEnv(env, "ENABLE_DOCKER_SOCKET", useDockerSocket ? "true" : "false");
    env = setEnv(env, "DOCKER_SOCKET_PATH", dockerSocketPath);
    env = setEnv(env, "DOCKER_SOCKET_GID", dockerSocketGid);
    if (useSelfMonitor) {
      env = setEnv(env, "DASHBOARD_HEALTH_URL", options.dashboardHealthUrl ?? "http://app:3000/api/health");
      env = setEnv(env, "MONITOR_ALLOW_PRIVATE_NETWORKS", "true");
    }
    writeFileSync(envPath, env);
  } else {
    adminEmail = await ask(rl, "Admin email", adminEmailDefault);
    const adminPassword = yes ? randomToken() : await ask(rl, "Admin password", randomToken());
    const postgresPassword = randomHex();
    agentId = await ask(rl, "Primary agent ID", options.agentId ?? "primary-linux-agent");
    const agentToken = randomToken();
    const seedHomelabExamples = await askBoolean(rl, "Seed homelab example endpoints?", false);
    const selfMonitorUrl = options.dashboardHealthUrl ?? "http://app:3000/api/health";
    const allowPrivateMonitoring = useSelfMonitor || seedHomelabExamples || options.monitorPrivate === "true";

    let env = readFileSync(examplePath, "utf8");
    env = setEnv(env, "POSTGRES_PASSWORD", postgresPassword);
    env = setEnv(env, "POSTGRES_HOST_PORT", String(postgresHostPort));
    env = setEnv(env, "DATABASE_URL", `postgresql://devsecops:${postgresPassword}@localhost:${postgresHostPort}/devsecops_dashboard?schema=public`);
    env = setEnv(env, "AUTH_SECRET", randomBase64());
    env = setEnv(env, "AUTH_URL", authUrl);
    env = setEnv(env, "APP_PORT", String(appPort));
    env = setEnv(env, "ADMIN_EMAIL", adminEmail);
    env = setEnv(env, "ADMIN_PASSWORD", adminPassword);
    env = setEnv(env, "RUN_DATABASE_MIGRATIONS", "true");
    env = setEnv(env, "RUN_DATABASE_SEED", "false");
    env = setEnv(env, "SEED_DASHBOARD_ENDPOINT", useSelfMonitor ? "true" : "false");
    env = setEnv(env, "SEED_HOMELAB_EXAMPLES", seedHomelabExamples ? "true" : "false");
    env = setEnv(env, "ENABLE_DOCKER_SOCKET", useDockerSocket ? "true" : "false");
    env = setEnv(env, "DOCKER_SOCKET_PATH", dockerSocketPath);
    env = setEnv(env, "DOCKER_SOCKET_GID", dockerSocketGid);
    env = setEnv(env, "DASHBOARD_HEALTH_URL", selfMonitorUrl);
    env = setEnv(env, "MONITOR_ALLOW_PRIVATE_NETWORKS", allowPrivateMonitoring ? "true" : "false");
    env = setEnv(env, "PRIMARY_AGENT_ID", agentId);
    env = setEnv(env, "PRIMARY_AGENT_TOKEN", agentToken);
    env = setEnv(env, "SECONDARY_AGENT_ID", "");
    env = setEnv(env, "SECONDARY_AGENT_TOKEN", "");
    env = setEnv(env, "CACHYOS_AGENT_TOKEN", "");
    env = setEnv(env, "UBUNTU_NSPAWN_AGENT_TOKEN", "");

    writeFileSync(envPath, env);
  }
  run("npm", ["ci"]);
  run("npm", ["run", "preflight"]);
  run("docker", [...composeArgs({ useDevOverride, useDockerSocket }), "config", "--quiet"]);

  printSummary({ appPort, authUrl, adminEmail, agentId, shouldSeed, shouldDeploy, postgresHostPort, useDevOverride, useDockerSocket, useSelfMonitor });

  if (shouldDeploy) {
    run("docker", [...composeArgs({ useDevOverride, useDockerSocket }), "up", "-d", "--build"]);
    if (shouldSeed) {
      run("docker", [...composeArgs({ useDevOverride, useDockerSocket }), "run", "--rm", "app", "true"], { RUN_DATABASE_SEED: "true" });
    }
    run("docker", [...composeArgs({ useDevOverride, useDockerSocket }), "ps"]);
  } else if (shouldSeed) {
    run("docker", [...composeArgs({ useDevOverride, useDockerSocket }), "run", "--rm", "app", "true"], { RUN_DATABASE_SEED: "true" });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}
