import test from "node:test";
import assert from "node:assert/strict";
import { findUnsafeEnvSettings, isPlaceholderSecret, validateAppEnv } from "@/server/config/env";
import { runPreflight } from "@/server/config/preflight";

const validEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://devsecops:real-postgres-password@postgres:5432/devsecops_dashboard?schema=public",
  AUTH_URL: "https://dashboard.example.test",
  AUTH_SECRET: "12345678901234567890123456789012",
  ADMIN_EMAIL: "admin@example.test",
  ADMIN_PASSWORD: "real-admin-password",
  POSTGRES_PASSWORD: "real-postgres-password"
} as NodeJS.ProcessEnv;

test("validateAppEnv accepts a complete production configuration", () => {
  const parsed = validateAppEnv(validEnv, "production");
  assert.equal(parsed.AUTH_URL, "https://dashboard.example.test");
});

test("validateAppEnv rejects placeholder production secrets", () => {
  assert.throws(
    () => validateAppEnv({ ...validEnv, ADMIN_PASSWORD: "change-me-now" }, "production"),
    /ADMIN_PASSWORD uses a placeholder/
  );
});

test("preflight catches malformed URLs and inconsistent localhost ports", () => {
  const problems = runPreflight(
    {
      ...validEnv,
      AUTH_URL: "http://localhost:3000",
      APP_PORT: "3003",
      SEED_ENDPOINTS_JSON: "not json"
    },
    "production"
  );

  assert.match(problems.join("\n"), /AUTH_URL port 3000 does not match APP_PORT 3003/);
  assert.match(problems.join("\n"), /SEED_ENDPOINTS_JSON is not valid JSON/);
});

test("placeholder detection covers legacy and generic agent tokens", () => {
  assert.equal(isPlaceholderSecret("change-me-agent-token"), true);
  assert.equal(isPlaceholderSecret("change-me-cachyos-agent-token"), true);
  assert.equal(isPlaceholderSecret("real-agent-token-value"), false);
});

test("homelab examples require explicit private network opt-in in production", () => {
  const problems = findUnsafeEnvSettings({ ...validEnv, SEED_HOMELAB_EXAMPLES: "true" }, "production");
  assert.match(problems.join("\n"), /SEED_HOMELAB_EXAMPLES requires MONITOR_ALLOW_PRIVATE_NETWORKS=true/);
});

test("placeholder detection only applies to secret-like keys", () => {
  const problems = findUnsafeEnvSettings({ ...validEnv, POSTGRES_USER: "devsecops" }, "production");
  assert.doesNotMatch(problems.join("\n"), /POSTGRES_USER uses a placeholder/);
});
