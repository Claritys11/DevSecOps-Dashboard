# Project Status

DevSecOps Dashboard 1.0 is a self-hosted monitoring platform for homelabs and small fleets.

## Implemented

- One-line installer and upgrade path (Docker only).
- Server enrollment from the UI, with a one-command agent install that the dashboard serves (amd64 and arm64).
- Go agent with outbound push, hashed tokens, timestamp, nonce and body-hash validation.
- HTTP and TLS endpoint monitoring with uptime, history and SSL expiry.
- Threshold alerts that open and close on their own, with acknowledgement.
- Docker container inventory, logs and guarded actions (reason required, protection levels, audit log).
- Users and roles (viewer, maintainer, admin) and password change.
- Light and dark UI, mobile navigation, live updates.
- CI: lint, types, tests, build, Go tests, Compose validation, image build, secret scan, dependency audit. Image publishing to GHCR.

## Known gaps

- No notification channels yet (email, webhook, Telegram). Alerts are visible in the UI only.
- Agent requests are authenticated by token and body hash, not HMAC-signed.
- DNS rebinding cannot be fully prevented by URL validation. Run the worker in a network context you trust.
- Rate limiting is in-memory per app instance.

## Next milestone

- Webhook and email notifications for alerts.
- Per-endpoint alert thresholds and maintenance windows.
- Signed release artifacts.
