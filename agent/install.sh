#!/bin/sh
# DevSecOps Dashboard agent installer.
#
# The dashboard serves this script at /api/agents/install and fills in its own URL.
#   curl -fsSL <dashboard>/api/agents/install | sudo sh -s -- --id <AGENT_ID> --token <TOKEN>
#   curl -fsSL <dashboard>/api/agents/install | sudo sh -s -- --uninstall
set -eu

DASHBOARD_URL="__DEFAULT_URL__"
AGENT_ID=""
AGENT_TOKEN=""
SERVER_NAME=""
INTERVAL="30"
ACTION="install"

BIN=/usr/local/bin/devsecops-agent
ENV_FILE=/etc/devsecops-agent.env
UNIT=/etc/systemd/system/devsecops-agent.service

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --url) DASHBOARD_URL="$2"; shift 2 ;;
    --id) AGENT_ID="$2"; shift 2 ;;
    --token) AGENT_TOKEN="$2"; shift 2 ;;
    --name) SERVER_NAME="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --uninstall) ACTION="uninstall"; shift ;;
    *) fail "unknown option: $1" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || fail "run as root (pipe into 'sudo sh')."
has_systemd() { command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; }

if [ "$ACTION" = "uninstall" ]; then
  if has_systemd; then
    systemctl disable --now devsecops-agent >/dev/null 2>&1 || true
    rm -f "$UNIT"
    systemctl daemon-reload
  fi
  rm -f "$BIN" "$ENV_FILE"
  say "Agent removed."
  exit 0
fi

[ -n "$DASHBOARD_URL" ] || fail "--url is required"
[ -n "$AGENT_ID" ] || fail "--id is required"
[ -n "$AGENT_TOKEN" ] || fail "--token is required"
DASHBOARD_URL="$(printf '%s' "$DASHBOARD_URL" | sed 's#/*$##')"

case "$(uname -s)" in Linux) ;; *) fail "the agent only supports Linux" ;; esac
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) fail "unsupported CPU architecture: $(uname -m)" ;;
esac

download() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -qO "$2" "$1"
  else fail "curl or wget is required"; fi
}

say "Downloading agent for linux-$ARCH from $DASHBOARD_URL"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
download "$DASHBOARD_URL/api/agents/download/linux-$ARCH" "$TMP" || fail "download failed. Can this machine reach $DASHBOARD_URL?"
if has_systemd; then systemctl stop devsecops-agent >/dev/null 2>&1 || true; fi
install -m 0755 "$TMP" "$BIN"

if ! id devsecops-agent >/dev/null 2>&1; then
  if command -v useradd >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin devsecops-agent
  elif command -v adduser >/dev/null 2>&1; then
    adduser -S -D -H -s /sbin/nologin devsecops-agent
  fi
fi

umask 077
{
  echo "DASHBOARD_URL=$DASHBOARD_URL"
  echo "AGENT_ID=$AGENT_ID"
  echo "AGENT_SECRET=$AGENT_TOKEN"
  echo "SERVER_NAME=$SERVER_NAME"
  echo "COLLECTION_INTERVAL_SECONDS=$INTERVAL"
  echo "REQUEST_TIMEOUT_SECONDS=10"
} > "$ENV_FILE"
chmod 0600 "$ENV_FILE"

if ! has_systemd; then
  say "Installed $BIN, but systemd was not found. Start the agent with:"
  echo "  set -a; . $ENV_FILE; set +a; $BIN"
  exit 0
fi

cat > "$UNIT" <<'UNIT_EOF'
[Unit]
Description=DevSecOps Dashboard monitoring agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=devsecops-agent
EnvironmentFile=/etc/devsecops-agent.env
ExecStart=/usr/local/bin/devsecops-agent
Restart=always
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
CapabilityBoundingSet=
LockPersonality=true
MemoryDenyWriteExecute=true

[Install]
WantedBy=multi-user.target
UNIT_EOF

systemctl daemon-reload
systemctl enable devsecops-agent >/dev/null 2>&1
systemctl restart devsecops-agent
sleep 2
if systemctl is-active --quiet devsecops-agent; then
  say "Agent is running. The server turns green in the dashboard within a minute."
  say "Logs: journalctl -u devsecops-agent -f"
else
  journalctl -u devsecops-agent -n 20 --no-pager || true
  fail "the agent did not start. See the log above."
fi
