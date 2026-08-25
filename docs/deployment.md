# Deployment

The supported deployment model is Docker Compose on a Linux host.

## Production

1. Create a `.env` file.

```bash
./install.sh
```

The installer checks dependencies, installs npm packages, asks for the app port
and other required values, auto-selects the next free port when the requested
one is busy, generates secrets, writes `.env`, validates the Compose
configuration, and guides the deploy choices.

2. Review the generated output and keep the admin password and agent token
private.

3. Start the stack.

```bash
docker compose -p devsecopsdash up -d --build
```

To generate configuration and deploy in one step:

```bash
./install.sh --deploy
```

Production defaults:

- PostgreSQL is not published to the host.
- private-network endpoint monitoring is disabled;
- Docker socket access is disabled;
- database migrations run on startup by default;
- database seeding does not run unless `RUN_DATABASE_SEED=true`.

## Coexisting With Other Docker Stacks

If the host already runs Docker workloads, Coolify, systemd-nspawn machines, or
other Compose projects, treat this dashboard as a separate deployment. Check
published ports before starting:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
ss -ltnp
```

Set a free `APP_PORT` in `.env` and make `AUTH_URL` match it. For example:

```text
APP_PORT="3003"
AUTH_URL="http://localhost:3003"
```

Use a unique Compose project name when installing next to other stacks:

```bash
./install.sh --deploy --project devsecopsdash
```

Avoid the development override on shared hosts unless you intentionally need a
published PostgreSQL port. `docker-compose.dev.yml` exposes Postgres through
`POSTGRES_HOST_PORT`, which can conflict with existing databases. If you do need
the development override, let the installer pick free ports:

```bash
./install.sh --dev --deploy
```

Keep these values disabled for a first install on a busy host:

```text
RUN_DATABASE_SEED="false"
SEED_DASHBOARD_ENDPOINT="false"
SEED_HOMELAB_EXAMPLES="false"
MONITOR_ALLOW_PRIVATE_NETWORKS="false"
ENABLE_DOCKER_SOCKET="false"
```

Alternatives for multi-environment setups:

- Use the Go agent on each host or systemd-nspawn machine for host metrics.
- Put the dashboard behind an existing reverse proxy such as Coolify or Traefik
  instead of binding ports 80 or 443 directly.
- If container inventory is needed, prefer a dedicated Docker endpoint for the
  target environment. Mount `/var/run/docker.sock` only for a trusted host where
  dashboard admins are allowed Docker-equivalent access.

Useful installer flags:

```text
--port 3018              start app port detection from 3018
--url https://dash.example.com
--project devsecopsdash  set the Compose project name
--dev                    include docker-compose.dev.yml and detect POSTGRES_HOST_PORT
--seed                   create the initial admin and agent credential
--deploy                 build, start, and seed in one run
--self-monitor           seed an internal dashboard health endpoint
--with-docker-socket     opt in to Docker socket access
--force                  replace an existing .env
--yes                    accept defaults for non-interactive installs
```

The same automation is available through npm:

```bash
npm run setup:install -- --deploy
```

## Development

Use the development override for local database access and homelab-friendly monitoring.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

The dev override publishes PostgreSQL on `POSTGRES_HOST_PORT` and sets `MONITOR_ALLOW_PRIVATE_NETWORKS=true` unless overridden.

## Docker Socket Access

Docker socket access is privileged. A process with access to `/var/run/docker.sock` can usually gain host-level control.

Enable it only when you need container inventory/actions from the dashboard host:

```bash
docker compose -f docker-compose.yml -f docker-compose.docker-socket.yml --profile docker-socket up -d --build
```

This sets `ENABLE_DOCKER_SOCKET=true` and mounts the socket read-only. Read-only bind mounting limits filesystem writes to the socket path but does not make Docker API access safe.

## Migrations

`RUN_DATABASE_MIGRATIONS=true` runs `prisma migrate deploy` before the app starts. If migrations fail, the container exits instead of serving against an unknown schema.

For manual migration control:

```bash
RUN_DATABASE_MIGRATIONS=false docker compose up -d app
docker compose run --rm app npx prisma migrate deploy
```

## Seeding

Production does not seed automatically. To seed the first admin, endpoints, and agent credentials:

```bash
RUN_DATABASE_SEED=true docker compose run --rm app npm run prisma:seed
```

Do not keep placeholder admin passwords or agent tokens.

## Health Checks

Compose defines health checks for PostgreSQL, the app API, and the monitor worker process. Use:

```bash
docker compose ps
docker compose logs app postgres monitor-worker
```

## Resource Limits

The Compose file includes portable `deploy.resources.limits` recommendations. Some non-Swarm Compose runtimes treat these as advisory metadata. Enforce host-level limits with your container runtime or service manager if your environment ignores them.
