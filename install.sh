#!/usr/bin/env bash
# DevSecOps Dashboard installer.
#
#   curl -fsSL https://raw.githubusercontent.com/Claritys11/DevSecOps-Dashboard/main/install.sh | bash
#
# Re-running it updates an existing install and keeps your .env and data.
# Only Docker (with the Compose plugin) is required on the host.
set -eu

REPO_URL="${DEVSECOPS_REPO:-https://github.com/Claritys11/DevSecOps-Dashboard}"
REF="main"
INSTALL_DIR=""
PORT=""
PUBLIC_URL=""
ADMIN_EMAIL="admin@devsecops.local"
PROJECT=""
WITH_DOCKER=""
MONITOR_HOST=""
PRIVATE_NETWORKS=""
FORCE_BUILD="false"
ASSUME_YES="false"
ACTION="install"

usage() {
  cat <<'USAGE'
Usage: install.sh [options]

  --dir PATH          Install location (default: /opt/devsecops-dashboard as root, ~/devsecops-dashboard otherwise)
  --port PORT         Port for the web UI (default: first free port from 3000)
  --url URL           Public URL, if you serve it behind a domain or reverse proxy
  --email EMAIL       Admin email (default: admin@devsecops.local)
  --project NAME      Docker Compose project name (default: devsecopsdash)
  --with-docker       Let the dashboard manage containers on this host (mounts the Docker socket)
  --no-docker         Do not mount the Docker socket
  --no-agent          Do not install the monitoring agent on this machine
  --public-only       Block monitoring of private/LAN addresses
  --ref REF           Git branch or tag to install (default: main)
  --build             Build the image locally instead of pulling it
  -y, --yes           Accept defaults without asking
  --uninstall         Stop and remove the containers (keeps data)
  --purge             Stop and remove the containers and all data
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --url) PUBLIC_URL="${2%/}"; shift 2 ;;
    --email) ADMIN_EMAIL="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --with-docker) WITH_DOCKER="true"; shift ;;
    --no-docker) WITH_DOCKER="false"; shift ;;
    --no-agent) MONITOR_HOST="false"; shift ;;
    --public-only) PRIVATE_NETWORKS="false"; shift ;;
    --ref) REF="$2"; shift 2 ;;
    --build) FORCE_BUILD="true"; shift ;;
    -y|--yes) ASSUME_YES="true"; shift ;;
    --uninstall) ACTION="uninstall"; shift ;;
    --purge) ACTION="purge"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; BLUE=$'\033[1;34m'; GREEN=$'\033[1;32m'; RED=$'\033[1;31m'; YELLOW=$'\033[1;33m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; BLUE=""; GREEN=""; RED=""; YELLOW=""; RESET=""
fi
step() { printf '%s==>%s %s\n' "$BLUE" "$RESET" "$*"; }
ok() { printf '%s ✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s !%s %s\n' "$YELLOW" "$RESET" "$*"; }
die() { printf '%serror:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

# Prompts read from the terminal so they work when the script is piped from curl.
TTY=""
if [ "$ASSUME_YES" != "true" ] && [ -r /dev/tty ] && { : </dev/tty; } 2>/dev/null; then TTY=/dev/tty; fi
confirm() {
  local question="$1" default="$2" answer
  if [ -z "$TTY" ]; then [ "$default" = "y" ]; return; fi
  local hint="[y/N]"; [ "$default" = "y" ] && hint="[Y/n]"
  printf '%s %s ' "$question" "$hint" >/dev/tty
  read -r answer </dev/tty || answer=""
  answer="${answer:-$default}"
  case "$answer" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

need() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- prerequisites
need docker || die "Docker is required. Install it from https://docs.docker.com/engine/install/ and re-run."
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  if need sudo && sudo docker info >/dev/null 2>&1; then
    DOCKER="sudo docker"
    warn "Using sudo for Docker. Add yourself to the docker group to avoid this."
  else
    die "Cannot talk to the Docker daemon. Is it running, and are you allowed to use it?"
  fi
fi
$DOCKER compose version >/dev/null 2>&1 || die "The Docker Compose plugin is required (docker compose)."

# ---------------------------------------------------------------- locate source
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ -z "$INSTALL_DIR" ]; then
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/docker-compose.yml" ] && [ -f "$SCRIPT_DIR/Dockerfile" ]; then
    INSTALL_DIR="$SCRIPT_DIR"
  elif [ "$(id -u)" -eq 0 ]; then
    INSTALL_DIR="/opt/devsecops-dashboard"
  else
    INSTALL_DIR="$HOME/devsecops-dashboard"
  fi
fi

compose() { (cd "$INSTALL_DIR" && $DOCKER compose "$@"); }

if [ "$ACTION" != "install" ]; then
  [ -f "$INSTALL_DIR/docker-compose.yml" ] || die "No install found in $INSTALL_DIR (use --dir)."
  if [ "$ACTION" = "purge" ]; then
    confirm "Delete all dashboard data in $INSTALL_DIR? This cannot be undone." "n" || die "Cancelled."
    compose down -v --remove-orphans
    ok "Containers and data removed. You can now delete $INSTALL_DIR."
  else
    compose down --remove-orphans
    ok "Dashboard stopped. Data is kept; re-run the installer to start it again."
  fi
  echo "To remove agents from monitored servers: curl -fsSL <dashboard>/api/agents/install | sudo sh -s -- --uninstall"
  exit 0
fi

printf '\n%sDevSecOps Dashboard installer%s\n\n' "$BOLD" "$RESET"

if [ "$INSTALL_DIR" = "$SCRIPT_DIR" ]; then
  step "Using the source in $INSTALL_DIR"
  # A local checkout may contain changes, so build it instead of pulling a published image.
  FORCE_BUILD="true"
elif [ -d "$INSTALL_DIR/.git" ]; then
  step "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$REF" && git -C "$INSTALL_DIR" checkout -q FETCH_HEAD \
    || die "Could not update the git checkout in $INSTALL_DIR."
elif need git; then
  step "Downloading into $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  if [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null | grep -v '^\.env$' || true)" ]; then
    die "$INSTALL_DIR is not empty. Choose another location with --dir."
  fi
  tmp_clone="$(mktemp -d)"
  git clone -q --depth 1 --branch "$REF" "$REPO_URL" "$tmp_clone" || die "git clone failed."
  cp -a "$tmp_clone/." "$INSTALL_DIR/"
  rm -rf "$tmp_clone"
else
  need curl || die "git or curl is required to download the dashboard."
  step "Downloading into $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$REPO_URL/archive/$REF.tar.gz" | tar -xz -C "$INSTALL_DIR" --strip-components=1 \
    || die "Download failed."
fi

# ---------------------------------------------------------------- configuration
random() {
  local length="$1"
  if need openssl; then
    openssl rand -base64 $((length * 2)) | tr -dc 'A-Za-z0-9' | cut -c1-"$length"
  else
    head -c $((length * 3)) /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-"$length"
  fi
}

port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Config file(s) of an existing Compose project, or nothing when no such project exists.
project_config() {
  $DOCKER compose ls -a --format json 2>/dev/null | tr '}' '\n' | grep -F "\"Name\":\"$1\"," | sed -n 's/.*"ConfigFiles":"\([^"]*\)".*/\1/p' | head -n1
}

env_get() { sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" "$INSTALL_DIR/.env" | tail -n1; }

FRESH="false"
ENV_FILE="$INSTALL_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  ok "Keeping existing configuration in $ENV_FILE"
  PORT="$(env_get APP_PORT)"; PORT="${PORT:-3000}"
  ADMIN_EMAIL="$(env_get ADMIN_EMAIL)"
else
  FRESH="true"
  if [ -z "$PORT" ]; then
    PORT=3000
    while port_in_use "$PORT"; do PORT=$((PORT + 1)); done
  elif port_in_use "$PORT"; then
    die "Port $PORT is already in use. Pick another with --port."
  fi
  ok "Web UI will listen on port $PORT"

  if [ -z "$WITH_DOCKER" ]; then
    if [ -S /var/run/docker.sock ] && confirm "Show and manage this host's Docker containers in the dashboard? (grants the dashboard Docker access)" "y"; then
      WITH_DOCKER="true"
    else
      WITH_DOCKER="false"
    fi
  fi
  if [ -z "$PRIVATE_NETWORKS" ]; then
    if confirm "Will you monitor services on your local network (192.168.x.x, 10.x.x.x, localhost)?" "y"; then
      PRIVATE_NETWORKS="true"
    else
      PRIVATE_NETWORKS="false"
    fi
  fi
  if [ -z "$MONITOR_HOST" ]; then
    if [ -d /run/systemd/system ] && confirm "Install the monitoring agent on this machine too?" "y"; then
      MONITOR_HOST="true"
    else
      MONITOR_HOST="false"
    fi
  fi

  # Never take over a stack with the same project name that lives in another directory.
  if [ -z "$PROJECT" ]; then
    PROJECT="devsecopsdash"
    n=2
    while other="$(project_config "$PROJECT")" && [ -n "$other" ] && [[ "$other" != "$INSTALL_DIR/"* ]]; do
      PROJECT="devsecopsdash-$n"; n=$((n + 1))
    done
  fi
  ok "Compose project: $PROJECT"

  ADMIN_PASSWORD="$(random 20)"
  POSTGRES_PASSWORD="$(random 32)"
  AUTH_SECRET="$(random 48)"
  COMPOSE_FILES="docker-compose.yml"
  DOCKER_GID=""
  if [ "$WITH_DOCKER" = "true" ]; then
    COMPOSE_FILES="docker-compose.yml:docker-compose.docker-socket.yml"
    DOCKER_GID="$(stat -c %g /var/run/docker.sock 2>/dev/null || echo 0)"
  fi
  AGENT_ID=""; AGENT_TOKEN=""
  if [ "$MONITOR_HOST" = "true" ]; then
    AGENT_ID="this-server-$(random 6 | tr 'A-Z' 'a-z')"
    AGENT_TOKEN="$(random 43)"
  fi

  umask 077
  cat >"$ENV_FILE" <<ENV
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Keep this file private.
COMPOSE_PROJECT_NAME="$PROJECT"
COMPOSE_FILE="$COMPOSE_FILES"
APP_PORT="$PORT"
AUTH_URL="$PUBLIC_URL"
AUTH_SECRET="$AUTH_SECRET"
ADMIN_EMAIL="$ADMIN_EMAIL"
ADMIN_PASSWORD="$ADMIN_PASSWORD"
POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
MONITOR_ALLOW_PRIVATE_NETWORKS="$PRIVATE_NETWORKS"
DOCKER_SOCKET_GID="$DOCKER_GID"
PRIMARY_SERVER_NAME="$(hostname 2>/dev/null || echo "This server")"
PRIMARY_AGENT_ID="$AGENT_ID"
PRIMARY_AGENT_TOKEN="$AGENT_TOKEN"
DASHBOARD_IMAGE="ghcr.io/claritys11/devsecops-dashboard:$([ "$REF" = "main" ] && echo latest || echo "$REF")"
ENV
  umask 022
  ok "Wrote $ENV_FILE with freshly generated secrets"
fi

# ---------------------------------------------------------------- start
pulled="false"
if [ "$FORCE_BUILD" != "true" ]; then
  step "Pulling the dashboard image"
  if compose pull --quiet app 2>/dev/null; then pulled="true"; fi
fi
if [ "$pulled" = "true" ]; then
  step "Starting containers"
  compose up -d --no-build --remove-orphans
else
  step "Building the dashboard image (first build takes a few minutes)"
  compose build app
  step "Starting containers"
  compose up -d --no-build --remove-orphans
fi

step "Waiting for the dashboard to become healthy"
healthy="false"
for _ in $(seq 1 90); do
  if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && {
    if need curl; then curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1
    else compose exec -T app wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; fi
  }; then
    healthy="true"; break
  fi
  sleep 2
done
if [ "$healthy" != "true" ]; then
  compose logs --tail 60 app >&2 || true
  die "The dashboard did not become healthy. The log above usually says why."
fi
ok "Dashboard is up"

# ---------------------------------------------------------------- local agent
# Only on fresh installs: on upgrades the host agent may use credentials issued from the UI,
# and reinstalling it with the .env ones would disconnect it.
AGENT_ID="$(env_get PRIMARY_AGENT_ID)"
AGENT_TOKEN="$(env_get PRIMARY_AGENT_TOKEN)"
if [ "$FRESH" = "true" ] && [ "$MONITOR_HOST" = "true" ] && [ -n "$AGENT_ID" ] && [ -n "$AGENT_TOKEN" ] && need curl; then
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  step "Installing the monitoring agent on this machine"
  if curl -fsSL "http://127.0.0.1:$PORT/api/agents/install" \
      | $SUDO sh -s -- --url "http://127.0.0.1:$PORT" --id "$AGENT_ID" --token "$AGENT_TOKEN" --name "$(env_get PRIMARY_SERVER_NAME)"; then
    ok "Agent installed"
  else
    warn "Agent install failed. You can retry from Servers → This server in the dashboard."
  fi
fi

# ---------------------------------------------------------------- summary
LAN_IP="$( (ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p') || true)"
[ -z "$LAN_IP" ] && LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"

printf '\n%sDevSecOps Dashboard is running.%s\n\n' "$GREEN" "$RESET"
if [ -n "$(env_get AUTH_URL)" ]; then
  printf '  Open      %s\n' "$(env_get AUTH_URL)"
else
  printf '  Open      http://localhost:%s\n' "$PORT"
  [ -n "$LAN_IP" ] && printf '            http://%s:%s %s(from other devices)%s\n' "$LAN_IP" "$PORT" "$DIM" "$RESET"
fi
printf '  Email     %s\n' "$ADMIN_EMAIL"
if [ "$FRESH" = "true" ]; then
  printf '  Password  %s%s%s  %s(also saved in .env as ADMIN_PASSWORD)%s\n' "$BOLD" "$ADMIN_PASSWORD" "$RESET" "$DIM" "$RESET"
else
  printf '  Password  %s(unchanged; see ADMIN_PASSWORD in %s)%s\n' "$DIM" "$ENV_FILE" "$RESET"
fi
printf '\n  Files     %s\n' "$INSTALL_DIR"
printf '  Update    re-run this installer\n'
printf '  Logs      cd %s && docker compose logs -f\n' "$INSTALL_DIR"
printf '  Stop      cd %s && docker compose down\n\n' "$INSTALL_DIR"
