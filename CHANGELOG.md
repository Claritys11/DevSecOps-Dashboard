# Changelog

This project uses a changelog inspired by Keep a Changelog and versioning compatible with SemVer once public releases begin.

## 1.0.0

### Install and operations
- One-line installer (`curl … | bash`). It needs only Docker, generates every secret, picks a free port and Compose project name, pulls or builds the image, waits for health and prints the login. Re-running it upgrades the install.
- One image for app and worker that bundles agent binaries for amd64 and arm64. Published to GHCR by `release.yml`.
- Agents are installed with one command copied from the dashboard: `/api/agents/install` and `/api/agents/download/<platform>`.
- Idempotent bootstrap runs on every start. It no longer resets the admin password (use `ADMIN_RESET_PASSWORD=true`).
- `AUTH_URL` is optional, so the dashboard works by LAN IP, hostname or domain.

### Dashboard
- Redesigned UI with light and dark themes, mobile navigation, and live updates every 15 seconds (can be paused).
- The overview leads with one health sentence and a status strip of every server and endpoint, then what needs attention.
- Add, edit and remove servers, endpoints and users from the UI. Agent tokens can be rotated.
- Endpoint 24-hour uptime and last-30-check history. Server history as per-resource charts with alert thresholds, and network shown as a rate.
- Container actions use confirmation dialogs with a required reason instead of browser prompts.
- New Alerts (open and resolved), Activity and Settings pages.

### Fixes
- Server status now goes Offline when an agent stops reporting. It used to stay Online forever.
- Endpoint alerts respect `ALERT_ENDPOINT_FAILURE_THRESHOLD`. They used to fire on the first failure.
- Servers that have never connected no longer raise "server offline" alerts.
- Sign-in is rate limited and email matching is case-insensitive.

## Unreleased

### Added

- Open-source governance files, issue templates, PR template, and maintainer settings guidance.
- Deployment, configuration, architecture, agent installation, upgrade, and troubleshooting documentation.
- Production preflight validation for required environment variables and unsafe settings.
- Unit tests for environment validation, monitoring network policy, redirect validation, and agent config parsing.
- CI jobs for app validation, Go tests, Compose validation, image build, secret scanning, and dependency checks.

### Changed

- Production Compose now requires secrets explicitly, keeps PostgreSQL private by default, and disables private-network monitoring by default.
- Docker socket access moved to an explicit privileged override/profile.
- Production startup no longer seeds the database unless `RUN_DATABASE_SEED=true`.
- Default seed and agent configuration are generic instead of host-specific.

### Security

- Placeholder production secrets are rejected by preflight.
- Cloud metadata addresses remain blocked even when private-network monitoring is enabled.
- The app container runs as a non-root user.
