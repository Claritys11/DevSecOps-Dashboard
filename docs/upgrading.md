# Upgrading

This project is pre-1.0, so configuration defaults may change while the repository matures.

## Before Upgrading

1. Back up PostgreSQL.
2. Save your `.env` securely.
3. Read `CHANGELOG.md`.
4. Run `docker compose config` with your intended Compose files.

## Apply Migrations

Production startup runs migrations by default:

```bash
docker compose up -d --build
```

For manual control:

```bash
RUN_DATABASE_MIGRATIONS=false docker compose up -d --build app
docker compose run --rm app npx prisma migrate deploy
docker compose up -d app monitor-worker
```

If migration fails, stop and inspect the error before retrying.

## Breaking Configuration Changes In This Hardening Pass

- Production no longer accepts placeholder secrets.
- Production no longer publishes PostgreSQL by default.
- Production no longer allows private-network monitors by default.
- Production no longer seeds automatically.
- Docker socket access moved to `docker-compose.docker-socket.yml`.
- New installs should use `PRIMARY_AGENT_ID` and `PRIMARY_AGENT_TOKEN`.

Existing legacy agent env names remain recognized for seed compatibility.
