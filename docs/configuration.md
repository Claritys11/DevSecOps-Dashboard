# Configuration

All configuration lives in `.env` next to `docker-compose.yml`. `install.sh` generates it. After changing a value, run `docker compose up -d`.

## Required

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs sessions. 32+ random characters. Changing it signs everyone out. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First admin account. Created on first start if it does not exist. |
| `POSTGRES_PASSWORD` | Database password. |

Production start-up refuses placeholder values such as `change-me-*`.

## Web

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_PORT` | `3000` | Host port for the web UI |
| `APP_BIND` | `0.0.0.0` | Host interface to bind. Use `127.0.0.1` behind a local reverse proxy |
| `AUTH_URL` | empty | Public URL. Empty means any hostname is accepted |

## Compose

| Variable | Purpose |
| --- | --- |
| `COMPOSE_PROJECT_NAME` | Stack name (`devsecopsdash`) |
| `COMPOSE_FILE` | Add `:docker-compose.docker-socket.yml` to enable container management on this host |
| `DOCKER_SOCKET_GID` | Group id of `/var/run/docker.sock` |
| `DASHBOARD_IMAGE` | Image to run. Default `ghcr.io/claritys11/devsecops-dashboard:latest` |

## Monitoring

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONITOR_ALLOW_PRIVATE_NETWORKS` | `false` | Allow 10/8, 172.16/12, 192.168/16, loopback and link-local targets. Cloud metadata IPs stay blocked |
| `MONITORING_DEFAULT_TIMEOUT_MS` | `5000` | Default request timeout |
| `MONITOR_REDIRECT_LIMIT` | `3` | Redirects followed. Each hop is re-validated |
| `MONITOR_WORKER_POLL_SECONDS` | `15` | How often the worker looks for due checks |
| `MONITOR_WORKER_BATCH_SIZE` | `10` | Checks per poll |
| `METRICS_RETENTION_DAYS` | `30` | Server metric history kept |

## Alerts

| Variable | Default |
| --- | --- |
| `ALERT_CPU_CRITICAL_PERCENT` | `90` |
| `ALERT_MEMORY_CRITICAL_PERCENT` | `90` |
| `ALERT_DISK_CRITICAL_PERCENT` | `85` |
| `ALERT_SSL_EXPIRING_DAYS` | `14` |
| `ALERT_ENDPOINT_FAILURE_THRESHOLD` | `3` (failed checks in a row) |
| `AGENT_STALE_AFTER_MINUTES` | `2` |
| `SERVER_OFFLINE_AFTER_MINUTES` | `10` |

## Agents

| Variable | Default | Purpose |
| --- | --- | --- |
| `PRIMARY_SERVER_NAME` / `PRIMARY_AGENT_ID` / `PRIMARY_AGENT_TOKEN` | empty | Pre-provisioned agent for the dashboard host (set by the installer) |
| `SECONDARY_SERVER_NAME` / `SECONDARY_AGENT_ID` / `SECONDARY_AGENT_TOKEN` | empty | Optional second pre-provisioned agent |
| `AGENT_MAX_CLOCK_SKEW_SECONDS` | `300` | Allowed clock difference |
| `AGENT_NONCE_RETENTION_MINUTES` | `30` | Replay-protection window |
| `AGENT_MAX_BODY_BYTES` | `16384` | Maximum payload |

Agents for other servers are created in the UI and need no variables.

## Startup

| Variable | Default | Purpose |
| --- | --- | --- |
| `RUN_DATABASE_MIGRATIONS` | `true` | Apply migrations on start |
| `RUN_DATABASE_SEED` | `true` | Run the idempotent bootstrap (admin, pre-provisioned agents, `SEED_ENDPOINTS_JSON`) |
| `ADMIN_RESET_PASSWORD` | `false` | Reset the admin password to `ADMIN_PASSWORD` on start |
| `SEED_ENDPOINTS_JSON` | empty | JSON array of `{ "name", "url", "expectedStatus"?, "intervalSeconds"? }` created once |
| `SKIP_PREFLIGHT` | `false` | Skip configuration validation (not recommended) |

## Local development

`npm run setup` writes a development `.env` with `DATABASE_URL` pointing at `localhost:5433`, which is the Postgres port published by `docker-compose.dev.yml`.
