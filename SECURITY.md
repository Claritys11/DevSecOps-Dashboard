# Security Policy

## Supported Versions

This project is pre-1.0. Security fixes are made on the default development line unless maintainers publish supported release branches later.

## Reporting Vulnerabilities

Please do not disclose vulnerabilities in public issues or discussions.

Report privately through GitHub private vulnerability reporting if enabled. If it is not enabled, contact the repository owner through a private channel listed on the GitHub profile and include:

- affected version or commit;
- vulnerable component;
- reproduction steps;
- expected and actual impact;
- logs or proof of concept without real secrets;
- suggested fix if known.

## Scope

Security-sensitive areas include:

- dashboard authentication and authorization;
- agent token validation, nonce replay protection, and request body hashing;
- endpoint monitoring and SSRF defenses;
- Docker socket access and container actions;
- database migrations, seed data, and secret handling;
- CI, dependency, and release automation.

## Expectations

Maintainers will acknowledge valid reports when possible, avoid public details until a fix is available, and credit reporters if they want credit. This is a best-effort open-source project and does not provide a service-level agreement.
