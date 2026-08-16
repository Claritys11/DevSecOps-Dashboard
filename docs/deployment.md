# Deployment

The supported deployment model is Docker Compose on a Linux host.

## Production

1. Create a `.env` file.

```bash
npm run setup
```

2. Review generated secrets and set a production `AUTH_URL`.

3. Start the stack.

```bash
docker compose up -d --build
```

Production defaults:

- PostgreSQL is not published to the host.
- private-network endpoint monitoring is disabled;
- Docker socket access is disabled;
- database migrations run on startup by default;
- database seeding does not run unless `RUN_DATABASE_SEED=true`.

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
