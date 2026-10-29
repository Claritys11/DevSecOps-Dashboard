# Troubleshooting

Start with the container status and the app log. They usually name the problem.

```bash
cd ~/devsecops-dashboard
docker compose ps
docker compose logs --tail 100 app
docker compose logs --tail 100 monitor-worker
```

## The installer says the dashboard did not become healthy

The installer prints the last app log lines. Common causes:

- **`Configuration preflight failed`**: a value in `.env` is a placeholder or malformed. The message names the variable.
- **`P1001: Can't reach database server`**: Postgres is still starting or crashed. Run `docker compose logs postgres`.
- **Port already in use**: re-run with `--port`, or change `APP_PORT` in `.env`.

## I cannot sign in

- The installer printed the admin email and password, and they are saved in `.env` as `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- If you changed the password in the UI and forgot it, set `ADMIN_RESET_PASSWORD=true` in `.env`, run `docker compose up -d`, sign in with `ADMIN_PASSWORD`, then set it back to `false`.
- After 10 failed attempts for an email, sign-in for that email pauses for 15 minutes.
- If login redirects to the wrong host, clear `AUTH_URL` in `.env` or set it to the address you actually use.

## A server stays "Waiting for agent" or turns "Offline"

On that server:

```bash
systemctl status devsecops-agent
journalctl -u devsecops-agent -n 50
```

- **`connection refused` / `no such host`**: the agent cannot reach `DASHBOARD_URL` in `/etc/devsecops-agent.env`. Use the dashboard's LAN address, not `localhost`, for other machines.
- **`dashboard returned 401`**: the token was replaced or the clock is off by more than 5 minutes. Use **Install agent** on the server page to get a fresh command, and check `timedatectl`.
- **`download failed`** during install: the dashboard URL in the command is not reachable from that machine.

## An endpoint shows "Blocked monitor target address"

Private and local addresses are blocked unless `MONITOR_ALLOW_PRIVATE_NETWORKS=true` is set in `.env`. After changing it, run `docker compose up -d`. To reach services on the Docker host itself, use the host's LAN IP rather than `localhost`, because `localhost` inside the worker container is the container.

## Containers page says it cannot reach the Docker socket

Container management for the dashboard host is off by default. Enable it:

```env
COMPOSE_FILE="docker-compose.yml:docker-compose.docker-socket.yml"
DOCKER_SOCKET_GID="<output of: stat -c %g /var/run/docker.sock>"
```

Then run `docker compose up -d`.

## Upgrades fail to migrate

```bash
docker compose run --rm app npx prisma migrate status
```

Restore from your last backup if a migration was interrupted. See [deployment.md](deployment.md#backups).
