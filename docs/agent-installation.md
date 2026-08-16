# Agent Installation

The Go agent pushes heartbeat and metrics to the dashboard. The dashboard does not SSH into servers.

## Configure Credentials

Seed or create an agent credential, then configure the agent with matching values:

```bash
export DASHBOARD_URL="https://dashboard.example.com"
export AGENT_ID="primary-linux-agent"
export AGENT_SECRET="generated-agent-token"
export SERVER_NAME="linux-host-01"
```

The agent rejects missing or placeholder credentials.

## Run Locally

```bash
cd agent
go run ./cmd/agent
```

## Build

```bash
cd agent
go build -o devsecops-agent ./cmd/agent
```

## systemd

Use `deployment/systemd/devsecops-agent.service` as a starting point. Put secrets in `/etc/devsecops-agent.env` with permissions limited to root and the agent service account.

```text
DASHBOARD_URL=https://dashboard.example.com
AGENT_ID=primary-linux-agent
AGENT_SECRET=generated-agent-token
SERVER_NAME=linux-host-01
COLLECTION_INTERVAL_SECONDS=30
REQUEST_TIMEOUT_SECONDS=10
```

## Security Notes

- Use one agent credential per host.
- Rotate tokens by creating a new credential and revoking the old one.
- The agent reads Linux proc/sys files and filesystem stats. It does not run arbitrary shell commands.
- Do not commit `/etc/devsecops-agent.env`, `.env`, or token values.
