# DevSecOps Dashboard

DevSecOps Dashboard is a self-hosted homelab operations dashboard for monitoring servers, Docker containers, HTTP endpoints, SSL certificates, agent metrics, alerts, and audit logs from one place.

It is built as a real usable portfolio project: not a static landing page, not a mock dashboard, and not tied to a single machine by default. You can run it locally, deploy it with Docker Compose, connect Linux agents, monitor your own services, and adapt the seed data for your own homelab.

## What It Does

- Tracks servers and their runtime type, including normal hosts and `systemd-nspawn` machines.
- Collects real CPU, memory, disk, load average, uptime, and network metrics through a Go agent.
- Lists Docker containers from the host and from an Ubuntu nspawn machine separately.
- Supports container logs, restart, stop, and delete actions.
- Adds container protection levels so critical containers cannot be managed accidentally.
- Monitors HTTP endpoints manually or on a schedule.
- Checks SSL certificate health and expiry for HTTPS endpoints.
- Creates deduplicated alerts for server, endpoint, metric, SSL, and container problems.
- Records sensitive actions in an audit log.
- Ships with Docker Compose, database migrations, seed automation, and GitHub Actions CI.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- NextAuth Credentials
- Argon2id password hashing
- Go Linux monitoring agent
- Docker Compose

## Quickstart With Docker Compose

This is the recommended path for most users.

```bash
npm run setup
docker compose up -d --build
```

Open the dashboard:

```text
http://localhost:3000
```

The setup command generates a local `.env` with random secrets and tokens. The app container automatically runs database migrations and seed data on startup.

Useful flags:

```bash
APP_PORT=3003 docker compose up -d --build
POSTGRES_HOST_PORT=5434 docker compose up -d postgres
RUN_DATABASE_SEED=false docker compose up -d app
RUN_DATABASE_MIGRATIONS=false docker compose up -d app
```

## Local Development

Requirements:

- Node.js 22 or newer
- npm
- Docker and Docker Compose
- Go 1.22 or newer, only needed for the agent

Install dependencies:

```bash
npm install
```

Generate `.env`:

```bash
npm run setup
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Run migrations and seed:

```bash
npm run prisma:deploy
npm run prisma:seed
```

Start the app:

```bash
npm run dev -- -p 3003
```

Open:

```text
http://localhost:3003
```

## First Login

The admin account is created from:

```text
ADMIN_EMAIL
ADMIN_PASSWORD
```

Both values are stored in `.env`. Change them before exposing the dashboard to a network.

## Seed Data

The default seed is portable and safe for a fresh install:

- One admin user.
- One local host server record.
- One Ubuntu `systemd-nspawn` server record.
- One dashboard health endpoint.
- Two agent credentials.

Homelab example endpoints are opt-in:

```bash
SEED_HOMELAB_EXAMPLES=true npm run prisma:seed
```

Custom endpoints can be seeded with `SEED_ENDPOINTS_JSON`:

```bash
SEED_ENDPOINTS_JSON='[
  {"name":"Docs","url":"https://example.com","expectedStatus":200},
  {"name":"API","url":"https://api.example.com/health","expectedStatus":200,"intervalSeconds":60}
]' npm run prisma:seed
```

## Monitoring Worker

Endpoint and SSL checks are performed by a worker outside the Next.js request lifecycle.

Run the worker:

```bash
npm run worker:monitor
```

Run one scheduler pass for testing:

```bash
MONITOR_WORKER_RUN_ONCE=true npm run worker:monitor
```

The worker uses the `SchedulerLock` table so multiple worker processes do not run the same scheduler cycle at the same time.

## Linux Agent

The Go agent lives in `agent/` and uses outbound push. The dashboard does not SSH into your servers.

```text
agent -> dashboard /api/agents/heartbeat
agent -> dashboard /api/agents/metrics
```

Run locally:

```bash
cd agent
cp .env.example .env
set -a
. ./.env
set +a
go run ./cmd/agent
```

Example:

```bash
DASHBOARD_URL=http://localhost:3003 \
AGENT_ID=cachyos-host-agent \
AGENT_SECRET=replace-with-generated-token \
SERVER_NAME=my-linux-host \
go run ./cmd/agent
```

For systemd deployment, see:

```text
deployment/systemd/devsecops-agent.service
```

Use a unique `AGENT_ID` and `AGENT_SECRET` per server. The dashboard stores token hashes, not raw agent secrets.

## Docker And systemd-nspawn

The dashboard supports two Docker sources:

- Host Docker through `DOCKER_SOCKET_PATH`, usually `/var/run/docker.sock`.
- Ubuntu nspawn Docker through `machinectl shell ubuntu /usr/bin/docker ...`.

If you expose the nspawn Docker daemon separately, configure:

```text
UBUNTU_NSPAWN_DOCKER_ENDPOINT
```

Container records include `serverId`, so containers from the host and from nspawn are shown separately.

## Alerts

The alert engine creates fingerprinted alerts so one resource and one rule produce only one active alert.

Current alert rules:

- `SERVER_OFFLINE`
- `AGENT_STALE`
- `ENDPOINT_DOWN`
- `CONTAINER_EXITED`
- `HIGH_CPU`
- `HIGH_MEMORY`
- `HIGH_DISK`
- `SSL_EXPIRING`

Alert thresholds are configurable:

```text
ALERT_CPU_CRITICAL_PERCENT
ALERT_MEMORY_CRITICAL_PERCENT
ALERT_DISK_CRITICAL_PERCENT
ALERT_SSL_EXPIRING_DAYS
ALERT_ENDPOINT_FAILURE_THRESHOLD
AGENT_STALE_AFTER_MINUTES
SERVER_OFFLINE_AFTER_MINUTES
```

## Security Model

Authentication and authorization:

- Email/password login with NextAuth Credentials.
- Argon2id password hashing.
- Roles: `ADMIN`, `MAINTAINER`, and `VIEWER`.
- Server-side route protection.
- Audit logs for sensitive operations.

Agent protection:

- Token hash validation.
- Timestamp validation.
- Nonce replay protection.
- Request body hash validation.
- Payload size limits.

Container safety:

- Protected containers cannot be restarted, stopped, or deleted from the dashboard.
- Stop, delete, and restart require an action reason.
- Delete requires typing the container name.
- Idempotency keys prevent repeated accidental actions.

Important: mounting `/var/run/docker.sock` gives powerful access to the host. Only run the dashboard for trusted administrators, and avoid exposing it publicly without proper network protection.

## Environment Variables

Common app variables:

```text
DATABASE_URL
AUTH_SECRET
AUTH_URL
ADMIN_EMAIL
ADMIN_PASSWORD
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
APP_PORT
POSTGRES_HOST_PORT
```

Monitoring variables:

```text
DASHBOARD_HEALTH_URL
COOLIFY_STATUS_URL
MONITORING_DEFAULT_TIMEOUT_MS
MONITOR_WORKER_POLL_SECONDS
MONITOR_WORKER_LOCK_SECONDS
MONITOR_WORKER_BATCH_SIZE
MONITOR_ALLOW_PRIVATE_NETWORKS
MONITOR_REDIRECT_LIMIT
METRICS_RETENTION_DAYS
```

Docker and agent variables:

```text
DOCKER_SOCKET_PATH
UBUNTU_NSPAWN_DOCKER_ENDPOINT
CACHYOS_AGENT_ID
CACHYOS_AGENT_TOKEN
UBUNTU_NSPAWN_AGENT_ID
UBUNTU_NSPAWN_AGENT_TOKEN
```

Seed variables:

```text
SEED_HOMELAB_EXAMPLES
SEED_ENDPOINTS_JSON
RUN_DATABASE_MIGRATIONS
RUN_DATABASE_SEED
```

See [.env.example](./.env.example) for the full list.

## Project Structure

```text
src/app                 Next.js pages and route handlers
src/components          React UI components
src/server/services     Business logic for Docker, monitoring, alerts, audit, agents, and safety
src/server/integrations External integrations such as Docker
src/server/validators   Zod validators
src/worker              Long-running monitoring worker
agent                   Go monitoring agent
prisma                  Prisma schema, migrations, and seed
deployment              Deployment helpers such as systemd units
scripts                 Setup and container entrypoint scripts
```

## Validation

Validate the web app:

```bash
npm run validate
```

Test the Go agent:

```bash
cd agent
go test ./...
```

Validate Docker Compose:

```bash
docker compose config
```

Build the production image:

```bash
docker build --target runner -t devsecops-dashboard:local .
```

## CI

GitHub Actions runs:

- `npm ci`
- `npm run setup -- --yes`
- `npm run validate`
- `go test ./...` inside `agent/`

Workflow file:

```text
.github/workflows/ci.yml
```

## Roadmap

- Replace browser prompts with polished confirmation modals for container actions.
- Add user and role management screens.
- Add notification channels for alerts.
- Add Coolify and GitHub Actions deployment history.
- Add a public read-only status page.
- Add packaged agent releases.
- Add screenshots and demo data for the public README.

## License

No license has been selected yet. Add a license before publishing if you want other people to use, fork, or contribute to the project clearly.
