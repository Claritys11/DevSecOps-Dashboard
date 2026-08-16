# Project Status

DevSecOps Dashboard is a working MVP self-hosted monitoring platform.

## Implemented

- Authentication with roles: `ADMIN`, `MAINTAINER`, `VIEWER`.
- Go monitoring agent with outbound heartbeat and metrics push.
- Agent token hashing, timestamp validation, nonce replay protection, and body hash validation.
- Server metrics UI and historical charts.
- HTTP endpoint and SSL certificate monitoring.
- Alert fingerprint deduplication and acknowledgement.
- Docker container inventory and guarded actions when Docker access is explicitly configured.
- Audit logging for sensitive actions.
- Docker Compose deployment assets.
- Environment bootstrap and preflight validation.
- CI covering app checks, Go tests, Compose config, image build, secret scanning, and dependency checks.

## Current Hardening Direction

- Production configuration fails closed for required secrets.
- PostgreSQL is private by default in production Compose.
- Private-network endpoint monitoring is disabled by default.
- Docker socket access is an explicit privileged override.
- Production database seeding is opt-in.

## Known Gaps

- Container action UI uses browser prompts.
- Role management UI is not implemented.
- Agent HMAC signing is not implemented; current protection uses token hash plus timestamp, nonce, and body hash headers.
- DNS rebinding cannot be fully prevented by application-level URL validation.
- Formal release automation and signed artifacts are not implemented.

## Recommended Next Milestone

Improve operations UX and release maturity:

- Replace browser prompts for container actions with confirmation modals.
- Add role and user management pages.
- Add notification channels for active alerts.
- Add release packaging, signed artifacts, and release notes automation.
- Expand authorization and Docker safety tests.
