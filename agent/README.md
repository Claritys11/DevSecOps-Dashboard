# DevSecOps Agent

Small Linux monitoring agent for DevSecOps Dashboard.

It uses an outbound push model:

```text
agent -> dashboard /api/agents/heartbeat
agent -> dashboard /api/agents/metrics
```

The agent reads `/proc/stat`, `/proc/meminfo`, `/proc/loadavg`, `/proc/net/dev`, `/proc/uptime`, `/proc/sys/kernel/osrelease`, `/etc/os-release`, and filesystem stats via `statfs`. It does not run arbitrary shell commands and does not send environment variables.

## Run Locally

```bash
cp .env.example .env
set -a
. ./.env
set +a
go run ./cmd/agent
```

Use the matching `AGENT_ID` and `AGENT_SECRET` seeded in the dashboard database.

Example for CachyOS host:

```bash
DASHBOARD_URL=http://localhost:3003 \
AGENT_ID=cachyos-host-agent \
AGENT_SECRET=change-me-cachyos-agent-token \
SERVER_NAME=cachyos-host \
go run ./cmd/agent
```

Example for Ubuntu nspawn from the host:

```bash
go build -o /tmp/devsecops-agent ./cmd/agent
machinectl copy-to ubuntu /tmp/devsecops-agent /tmp/devsecops-agent
machinectl shell ubuntu /usr/bin/env \
  DASHBOARD_URL=http://192.168.100.64:3003 \
  AGENT_ID=ubuntu-nspawn-agent \
  AGENT_SECRET=change-me-ubuntu-nspawn-agent-token \
  SERVER_NAME=ubuntu-nspawn \
  /tmp/devsecops-agent
```

## Notes

- CPU usage is calculated from deltas in `/proc/stat`, so the first sample may report `0`.
- Network bytes are summed across non-loopback interfaces.
- Disk usage currently reports `/`.
- Docker collection is reserved for the next iteration.
