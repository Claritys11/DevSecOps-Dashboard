# Changelog

This project uses a changelog inspired by Keep a Changelog and versioning compatible with SemVer once public releases begin.

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
