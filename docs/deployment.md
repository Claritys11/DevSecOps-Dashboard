# Deployment

The supported deployment is Docker Compose on a Linux host. `install.sh` does all of it for you. This page explains what the installer does, so you can run, tune or reproduce it by hand.

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/Claritys11/DevSecOps-Dashboard/main/install.sh | bash
```

| Option | Effect |
| --- | --- |
| `--dir PATH` | Install location. Default `/opt/devsecops-dashboard` as root, `~/devsecops-dashboard` otherwise |
| `--port PORT` | Web UI port. Default: first free port from 3000 |
| `--url URL` | Public URL when serving behind a domain or reverse proxy (sets `AUTH_URL`) |
| `--email EMAIL` | Admin email. Default `admin@devsecops.local` |
| `--with-docker` / `--no-docker` | Mount the Docker socket for container management |
| `--no-agent` | Skip installing the agent on this machine |
| `--public-only` | Block monitoring of private and LAN addresses |
| `--project NAME` | Compose project name. Default `devsecopsdash`, or `devsecopsdash-2` and so on if that name is already used by a stack in another directory |
| `--ref REF` | Branch or tag to install. Default `main` |
| `--build` | Build the image locally instead of pulling it |
| `--yes` | Do not ask questions; accept defaults |
| `--uninstall` / `--purge` | Stop the stack and keep data, or stop it and delete all data |

Running it again updates the checkout and image, keeps `.env`, applies database migrations and restarts the containers.

## What gets created

```
~/devsecops-dashboard/
  .env                         # all configuration and secrets (mode 600)
  docker-compose.yml           # postgres + app + monitor-worker
  docker-compose.docker-socket.yml   # only used when container management is enabled
```

The stack has three containers that all use **one image**:

| Service | Role |
| --- | --- |
| `postgres` | Data. Not published to the host. |
| `app` | Web UI and API. Runs migrations and the idempotent bootstrap on start. Serves agent binaries and the agent installer. |
| `monitor-worker` | Runs endpoint and certificate checks and agent freshness alerts. |

`.env` is read by Compose and passed into the containers, so changing a value only needs `docker compose up -d`.

## Image: pull or build

`docker-compose.yml` refers to `ghcr.io/claritys11/devsecops-dashboard:latest`, and also has a `build:` section.

- Fresh installs try `docker compose pull` first. If the image cannot be pulled (offline, or not published yet), the installer builds locally.
- Running `install.sh` from a git checkout always builds, so your local changes are used.

Maintainers: `.github/workflows/release.yml` publishes multi-arch images on pushes to `main` and on `v*` tags. After the first publish, set the GHCR package visibility to **public** so installs can pull it anonymously.

## Reverse proxy and HTTPS

Leave `AUTH_URL` empty to accept requests on any hostname. This is fine for LAN use. Behind a proxy, set it to the public URL:

```env
AUTH_URL="https://ops.example.com"
APP_BIND="127.0.0.1"     # optional: only accept connections from the local proxy
```

Caddy example:

```
ops.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

The agent install command uses whatever address you opened the dashboard on, so open it by its public or LAN URL before copying the command.

## Container management

Mounting `/var/run/docker.sock` is root-equivalent. To enable it after installing:

```env
COMPOSE_FILE="docker-compose.yml:docker-compose.docker-socket.yml"
DOCKER_SOCKET_GID="975"   # stat -c %g /var/run/docker.sock
```

Then run `docker compose up -d`. For other hosts, expose the Docker API on a trusted network and set **Containers → Remote Docker API** on that server in the UI.

## Running next to other stacks

The installer picks a free port and a free Compose project name, so it does not collide with existing stacks. Check what is already listening:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
ss -ltnp
```

## Start on boot

Containers use `restart: unless-stopped`, so they come back after a reboot as long as Docker starts on boot (`systemctl enable docker`). `deployment/systemd/devsecops-dashboard-compose.service` is an optional unit if you prefer systemd to own the stack.

## Backups

```bash
docker compose exec -T postgres pg_dump -U devsecops devsecops_dashboard | gzip > backup-$(date +%F).sql.gz
```

Restore into an empty database:

```bash
gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U devsecops devsecops_dashboard
```

Keep a copy of `.env` with the backup. It holds `AUTH_SECRET` and the database password.
