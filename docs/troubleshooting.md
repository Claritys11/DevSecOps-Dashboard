# Troubleshooting

## Preflight Fails

Run:

```bash
npm run preflight -- --production
```

Replace placeholder values, fix malformed URLs, align `APP_PORT` and localhost `AUTH_URL`, and avoid `DOCKER_SOCKET_PATH` unless `ENABLE_DOCKER_SOCKET=true` is intentional.

If your `.env` was created before the generic agent names were introduced, remove old placeholder lines such as:

```text
CACHYOS_AGENT_TOKEN="change-me-cachyos-agent-token"
UBUNTU_NSPAWN_AGENT_TOKEN="change-me-ubuntu-nspawn-agent-token"
```

Then use `PRIMARY_AGENT_ID` and `PRIMARY_AGENT_TOKEN`, or regenerate the file:

```bash
npm run setup -- --force
```

## Docker Build Fails During npm ci

Prisma downloads engine packages during `npm ci`. If Docker logs show `ECONNRESET` from `@prisma/engines`, retry the build after checking network/DNS access from Docker:

```bash
docker compose build --no-cache app
```

The Dockerfile configures npm fetch retries, but a hard network reset can still fail a single build attempt.

## App Does Not Start

Check:

```bash
docker compose ps
docker compose logs app
docker compose logs postgres
```

Common causes are missing secrets, failed migrations, unavailable PostgreSQL, or an incorrect `AUTH_URL`.

## Cannot Log In

The admin user is created by the seed command. If seeding was skipped, run it intentionally:

```bash
RUN_DATABASE_SEED=true docker compose run --rm app npm run prisma:seed
```

Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your environment.

## Endpoint Checks Fail

Production blocks private and loopback targets by default. For trusted homelab monitoring, set:

```text
MONITOR_ALLOW_PRIVATE_NETWORKS=true
```

Cloud metadata addresses remain blocked.

## Docker Containers Show Cached Data

The dashboard falls back to cached container records when Docker is unavailable. To enable live host Docker access, use the Docker socket override and understand the host-equivalent privileges.

## Agent Is Rejected

Check:

- `DASHBOARD_URL` is reachable from the host running the agent;
- `AGENT_ID` matches a database credential;
- `AGENT_SECRET` matches the original token;
- system clocks are within `AGENT_MAX_CLOCK_SKEW_SECONDS`;
- the token was not revoked.
