# Support

DevSecOps Dashboard is a self-hosted open-source project. Support is best effort.

## Where To Get Help

- Use GitHub issues for reproducible bugs and focused feature requests.
- Use documentation in `docs/` for installation, configuration, agent setup, upgrades, and troubleshooting.
- Do not use public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Before Opening An Issue

Check:

- the README and relevant docs;
- existing open and closed issues;
- `npm run preflight`;
- container logs for `app`, `postgres`, and `monitor-worker`;
- agent logs from systemd or your shell.

Include versions, deployment method, sanitized configuration, exact commands, and logs without secrets.

## Not Covered

Maintainers cannot operate your infrastructure, recover lost secrets, debug private networks without details, or provide guaranteed response times.
