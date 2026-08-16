# DevSecOps Agent

Small Linux monitoring agent for DevSecOps Dashboard.

It uses an outbound push model:

```text
agent -> dashboard /api/agents/heartbeat
agent -> dashboard /api/agents/metrics
```

The agent reads `/proc/stat`, `/proc/meminfo`, `/proc/loadavg`, `/proc/net/dev`, `/proc/uptime`, `/proc/sys/kernel/osrelease`, `/etc/os-release`, and filesystem stats via `statfs`. It does not run arbitrary shell commands and does not send environment variables.

## Required Configuration

```bash
export DASHBOARD_URL="https://dashboard.example.com"
export AGENT_ID="primary-linux-agent"
export AGENT_SECRET="generated-agent-token"
export SERVER_NAME="linux-host-01"
```

`DASHBOARD_URL`, `AGENT_ID`, and `AGENT_SECRET` are required. Placeholder secrets are rejected.

## Run Locally

```bash
go run ./cmd/agent
```

## Build

```bash
go build -o devsecops-agent ./cmd/agent
```

## systemd

See:

```text
deployment/systemd/devsecops-agent.service
```

Store secrets in an environment file such as `/etc/devsecops-agent.env` and protect it with filesystem permissions.

## Notes

- CPU usage is calculated from deltas in `/proc/stat`, so the first sample may report `0`.
- Network bytes are summed across non-loopback interfaces.
- Disk usage currently reports `/`.
- Docker collection is handled by the dashboard when explicitly configured, not by the agent.
