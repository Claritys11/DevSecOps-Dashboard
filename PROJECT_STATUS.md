# Project Status

## Current State

DevSecOps Dashboard is now a working MVP-plus homelab monitoring platform.

Implemented:

- Authentication and roles: `ADMIN`, `MAINTAINER`, `VIEWER`.
- Server inventory for CachyOS host and Ubuntu `systemd-nspawn`.
- Go monitoring agent with outbound metrics push.
- Agent heartbeat and metrics ingestion APIs.
- Token hashing, timestamp validation, nonce replay protection, body hash validation.
- Metrics retention cleanup.
- Server metrics UI and historical charts.
- Docker container inventory separated between CachyOS host and Ubuntu nspawn.
- Container logs, restart, stop, delete.
- Container safety and protection levels.
- Manual container protection override.
- HTTP and SSL monitoring, both manual and scheduled.
- Basic alert engine with fingerprint deduplication.
- Alert rules: `SERVER_OFFLINE`, `AGENT_STALE`, `ENDPOINT_DOWN`, `CONTAINER_EXITED`, `HIGH_CPU`, `HIGH_MEMORY`, `HIGH_DISK`, `SSL_EXPIRING`.
- Alert acknowledgement for admin and maintainer users.
- PostgreSQL scheduler lock for duplicate job prevention.
- Audit logging for sensitive actions.
- Docker deployment assets.
- GitHub-ready first-run automation.
- Interactive `.env` bootstrap with generated secrets.
- Docker entrypoint for automatic production migration and seed.
- Portable seed mode with optional homelab example endpoints and custom endpoint JSON.
- GitHub Actions CI for app validation and agent tests.

## Verified

Latest verified commands:

```bash
npm run lint
npm run build
cd agent && go test ./...
```

Verified behavior:

- Valid agent heartbeat accepted.
- Valid agent metrics accepted and stored in PostgreSQL.
- Invalid agent token rejected.
- Replay nonce rejected.
- Duplicate metric collection ID rejected.
- CachyOS host agent sent real metrics.
- Ubuntu nspawn agent sent real metrics.
- Monitor worker checked all seeded endpoints.
- Duplicate scheduler lock prevented duplicate worker run.
- Host and Ubuntu nspawn containers are separated.
- Protected container actions are blocked.
- Manual protection override survives live Docker sync.
- Alert fingerprints prevent duplicate active alerts.
- Real exited containers create actionable active alerts.
- `npm run setup` does not overwrite an existing `.env` unless `--force` is used.
- Docker runner image builds successfully with the production entrypoint.

## Known Gaps

- Container action UI uses browser prompts; a proper modal is better.
- Role management UI is not implemented.
- Agent HMAC signing is prepared conceptually but current implementation uses token hash + body hash headers.
- Endpoint SSRF protection is basic and homelab-friendly; private networks are allowed by default.
- Production image favors reliable automatic seed/migration over minimal image size.

## Recommended Next Milestone

Improve operations UX:

- Replace browser prompts for container actions with proper confirmation modals.
- Add role and user management pages.
- Add notification channels for active alerts.
- Add deployment history from Coolify and GitHub Actions.
- Add a public/read-only status page.
