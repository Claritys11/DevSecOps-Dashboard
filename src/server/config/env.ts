import { z } from "zod";

export const PLACEHOLDER_SECRET_VALUES = new Set([
  "change-me-now",
  "change-me-postgres-password",
  "change-me-cachyos-agent-token",
  "change-me-ubuntu-nspawn-agent-token",
  "change-me-agent-token",
  "replace-with-openssl-rand-base64-32",
  "changeme",
  "password",
  "devsecops"
]);

const booleanSchema = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1" || value === "yes");

const integerSchema = (fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return fallback;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Expected an integer between ${min} and ${max}`
        });
        return z.NEVER;
      }
      return parsed;
    });

const optionalUrlSchema = z
  .string()
  .optional()
  .refine((value) => !value || isHttpUrl(value), "Expected an HTTP or HTTPS URL");

export const appEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1).optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),
  APP_PORT: integerSchema(3000, 1, 65535),
  PORT: integerSchema(3000, 1, 65535),
  HOSTNAME: z.string().default("0.0.0.0"),
  RUN_DATABASE_MIGRATIONS: booleanSchema,
  RUN_DATABASE_SEED: booleanSchema,
  SEED_HOMELAB_EXAMPLES: booleanSchema,
  SEED_ENDPOINTS_JSON: z.string().optional(),
  DOCKER_SOCKET_PATH: z.string().optional(),
  ENABLE_DOCKER_SOCKET: booleanSchema,
  UBUNTU_NSPAWN_DOCKER_ENDPOINT: z.string().optional(),
  DASHBOARD_HEALTH_URL: optionalUrlSchema,
  COOLIFY_STATUS_URL: optionalUrlSchema,
  MONITORING_DEFAULT_TIMEOUT_MS: integerSchema(5000, 500, 30000),
  MONITOR_WORKER_POLL_SECONDS: integerSchema(15, 5, 3600),
  MONITOR_WORKER_LOCK_SECONDS: integerSchema(45, 5, 3600),
  MONITOR_WORKER_BATCH_SIZE: integerSchema(10, 1, 1000),
  MONITOR_ALLOW_PRIVATE_NETWORKS: booleanSchema,
  MONITOR_REDIRECT_LIMIT: integerSchema(3, 0, 10),
  METRICS_RETENTION_DAYS: integerSchema(30, 1, 3650),
  ALERT_CPU_CRITICAL_PERCENT: integerSchema(90, 1, 100),
  ALERT_MEMORY_CRITICAL_PERCENT: integerSchema(90, 1, 100),
  ALERT_DISK_CRITICAL_PERCENT: integerSchema(85, 1, 100),
  ALERT_SSL_EXPIRING_DAYS: integerSchema(14, 1, 3650),
  ALERT_ENDPOINT_FAILURE_THRESHOLD: integerSchema(3, 1, 100),
  AGENT_STALE_AFTER_MINUTES: integerSchema(2, 1, 10080),
  SERVER_OFFLINE_AFTER_MINUTES: integerSchema(10, 1, 10080),
  AGENT_MAX_CLOCK_SKEW_SECONDS: integerSchema(300, 1, 86400),
  AGENT_NONCE_RETENTION_MINUTES: integerSchema(30, 1, 10080),
  AGENT_MAX_BODY_BYTES: integerSchema(16384, 1024, 1048576),
  PRIMARY_AGENT_ID: z.string().optional(),
  PRIMARY_AGENT_TOKEN: z.string().optional(),
  SECONDARY_AGENT_ID: z.string().optional(),
  SECONDARY_AGENT_TOKEN: z.string().optional(),
  CACHYOS_AGENT_ID: z.string().optional(),
  CACHYOS_AGENT_TOKEN: z.string().optional(),
  UBUNTU_NSPAWN_AGENT_ID: z.string().optional(),
  UBUNTU_NSPAWN_AGENT_TOKEN: z.string().optional()
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export type ValidationMode = "development" | "production";

export function parseAppEnv(source: NodeJS.ProcessEnv = process.env) {
  return appEnvSchema.safeParse(source);
}

export function validateAppEnv(source: NodeJS.ProcessEnv = process.env, mode: ValidationMode = "development"): AppEnv {
  const parsed = parseAppEnv(source);
  if (!parsed.success) {
    throw new Error(formatZodIssues(parsed.error));
  }

  const unsafe = findUnsafeEnvSettings(source, mode);
  if (unsafe.length > 0) {
    throw new Error(unsafe.join("\n"));
  }

  return parsed.data;
}

export function findUnsafeEnvSettings(source: NodeJS.ProcessEnv, mode: ValidationMode) {
  const problems: string[] = [];
  const requiredInProduction = ["DATABASE_URL", "AUTH_URL", "AUTH_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD", "POSTGRES_PASSWORD"];

  if (mode === "production") {
    for (const key of requiredInProduction) {
      if (!source[key]) problems.push(`${key} is required in production.`);
    }
  }

  for (const key of Object.keys(source)) {
    if (isSecretLikeKey(key) && isPlaceholderSecret(source[key])) {
      problems.push(`${key} uses a placeholder or unsafe default value.`);
    }
  }

  if (mode === "production") {
    for (const key of ["AUTH_SECRET", "ADMIN_PASSWORD", "POSTGRES_PASSWORD", "PRIMARY_AGENT_TOKEN", "SECONDARY_AGENT_TOKEN", "CACHYOS_AGENT_TOKEN", "UBUNTU_NSPAWN_AGENT_TOKEN"]) {
      const value = source[key];
      if (value && value.length < 12) problems.push(`${key} must be at least 12 characters in production.`);
    }
  }

  if (mode === "production" && source.MONITOR_ALLOW_PRIVATE_NETWORKS !== "true" && source.SEED_HOMELAB_EXAMPLES === "true") {
    problems.push("SEED_HOMELAB_EXAMPLES requires MONITOR_ALLOW_PRIVATE_NETWORKS=true because homelab examples target private host networks.");
  }

  if (source.APP_PORT && source.AUTH_URL) {
    const authPort = new URL(source.AUTH_URL).port || (source.AUTH_URL.startsWith("https://") ? "443" : "80");
    if (source.AUTH_URL.includes("localhost") && authPort !== source.APP_PORT) {
      problems.push(`AUTH_URL port ${authPort} does not match APP_PORT ${source.APP_PORT}.`);
    }
  }

  if (source.SEED_ENDPOINTS_JSON) {
    try {
      const endpoints = JSON.parse(source.SEED_ENDPOINTS_JSON);
      if (!Array.isArray(endpoints)) {
        problems.push("SEED_ENDPOINTS_JSON must be a JSON array.");
      }
    } catch {
      problems.push("SEED_ENDPOINTS_JSON is not valid JSON.");
    }
  }

  return problems;
}

function isSecretLikeKey(key: string) {
  return /SECRET|PASSWORD|TOKEN|KEY/i.test(key);
}

export function isPlaceholderSecret(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().replace(/^"|"$/g, "");
  if (PLACEHOLDER_SECRET_VALUES.has(normalized)) return true;
  return normalized.startsWith("change-me-") || normalized.startsWith("replace-with-");
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`).join("\n");
}
