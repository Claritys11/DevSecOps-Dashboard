# Configuration

Configuration is loaded from environment variables. Run `npm run preflight` before starting a deployment.

## Required For Production

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma PostgreSQL connection string. Passed to app and worker. |
| `AUTH_URL` | Public dashboard URL used by NextAuth. Passed to app. |
| `AUTH_SECRET` | NextAuth secret, at least 32 characters. Passed to app. |
| `ADMIN_EMAIL` | Initial admin email for manual seed. Passed to app. |
| `ADMIN_PASSWORD` | Initial admin password for manual seed. Passed to app. |
| `POSTGRES_PASSWORD` | PostgreSQL password. Passed to Postgres, app, and worker. |

## Generating Values

For a fresh local `.env`, the easiest path is:

```bash
npm run setup -- --force
```

This regenerates `.env` with random `AUTH_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, and `PRIMARY_AGENT_TOKEN`. Save the generated values somewhere private before replacing or deleting the file.

To generate individual values manually:

```bash
openssl rand -base64 32
```

Use separate generated values for:

- `AUTH_SECRET`
- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `PRIMARY_AGENT_TOKEN`
- any optional `SECONDARY_AGENT_TOKEN`

`AUTH_URL` should be the URL users open in the browser, for example `http://localhost:3003` for local development or `https://dashboard.example.com` for production.

`DATABASE_URL` must match the PostgreSQL values. For local development with the dev Compose override:

```text
DATABASE_URL="postgresql://devsecops:<POSTGRES_PASSWORD>@localhost:5433/devsecops_dashboard?schema=public"
```

Inside the production Compose network the app uses the service hostname automatically:

```text
postgresql://devsecops:<POSTGRES_PASSWORD>@postgres:5432/devsecops_dashboard?schema=public
```

## Runtime Settings

| Variable | Default | Notes |
| --- | --- | --- |
| `APP_PORT` | `3000` | Host port published by Compose. |
| `RUN_DATABASE_MIGRATIONS` | `true` | Runs Prisma deploy on container start. |
| `RUN_DATABASE_SEED` | `false` | Production seed opt-in. |
| `MONITOR_ALLOW_PRIVATE_NETWORKS` | `false` | Set `true` only for trusted homelab/internal monitoring. |
| `MONITOR_REDIRECT_LIMIT` | `3` | Redirects are manually followed and each target is validated. |
| `MONITORING_DEFAULT_TIMEOUT_MS` | `5000` | Default HTTP/TLS monitor timeout. |
| `ENABLE_DOCKER_SOCKET` | `false` | Required acknowledgement for Docker socket use. |
| `DOCKER_SOCKET_PATH` | empty | Used only with the Docker socket override. |
| `UBUNTU_NSPAWN_DOCKER_ENDPOINT` | empty | Optional Docker endpoint for homelab nspawn setups. |

## Agent Seed Variables

| Variable | Notes |
| --- | --- |
| `PRIMARY_AGENT_ID` / `PRIMARY_AGENT_TOKEN` | Generic default agent credential pair. |
| `SECONDARY_AGENT_ID` / `SECONDARY_AGENT_TOKEN` | Optional second agent credential pair. |
| `CACHYOS_AGENT_*` and `UBUNTU_NSPAWN_AGENT_*` | Backwards-compatible legacy names. Prefer generic names for new installs. |

## Development-Only Or Optional

- `POSTGRES_HOST_PORT` is used by `docker-compose.dev.yml` to publish PostgreSQL locally.
- `SEED_HOMELAB_EXAMPLES=true` adds example private-network endpoints and requires `MONITOR_ALLOW_PRIVATE_NETWORKS=true`.
- `DASHBOARD_HEALTH_URL` and `COOLIFY_STATUS_URL` are used by seed data only.

## Preflight

```bash
npm run preflight
npm run preflight -- --production
```

Preflight detects missing required variables, placeholder secrets, malformed URLs, inconsistent localhost ports, unsafe production Docker socket settings, invalid `SEED_ENDPOINTS_JSON`, and homelab seed/private-network mismatches.
