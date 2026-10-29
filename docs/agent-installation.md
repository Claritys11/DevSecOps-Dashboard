# Agent

The agent is a single static Go binary (amd64 and arm64). It reads `/proc`, `/etc/os-release` and `statfs("/")`, and pushes a sample to the dashboard every 30 seconds. It does not run shell commands, does not read environment variables beyond its own config, and needs no inbound ports.

## Install from the dashboard

1. Open **Servers**, then **Add server** (or **Install agent** on an existing server).
2. Run the command it gives you on the target machine:

```bash
curl -fsSL http://DASHBOARD/api/agents/install | sudo sh -s -- --url http://DASHBOARD --id AGENT_ID --token TOKEN
```

The script:

- downloads the matching binary from `DASHBOARD/api/agents/download/linux-<arch>` to `/usr/local/bin/devsecops-agent`,
- creates a `devsecops-agent` system user,
- writes `/etc/devsecops-agent.env` (mode 600),
- installs and starts a hardened `devsecops-agent` systemd service.

Tokens are stored hashed, so a token is only shown once. **Install agent** on a connected server issues a new token and disconnects the old one.

## Options

| Flag | Meaning |
| --- | --- |
| `--url` | Dashboard URL as seen from the server |
| `--id`, `--token` | Credentials from the dashboard |
| `--name` | Display hostname sent by the agent (defaults to the machine hostname) |
| `--interval` | Seconds between samples (default 30) |
| `--uninstall` | Stop and remove the agent |

## Operating it

```bash
systemctl status devsecops-agent
journalctl -u devsecops-agent -f
sudo cat /etc/devsecops-agent.env
```

## Without systemd

The installer still places the binary and env file, then prints how to start it. Any supervisor works:

```bash
set -a; . /etc/devsecops-agent.env; set +a; /usr/local/bin/devsecops-agent
```

## Building from source

```bash
cd agent
go build -o devsecops-agent ./cmd/agent
```

Or run `npm run agent:build` from the repository root to build `agent/dist/` for both architectures, which the development server then serves.

## Notes

- CPU usage is computed from `/proc/stat` deltas, so the first sample reports 0%.
- Network counters are summed across non-loopback interfaces. The dashboard shows them as a rate.
- Disk usage is for `/`.
- Containers are read by the dashboard (Docker socket or API), not by the agent.
