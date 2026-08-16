# Contributing

Thanks for helping improve DevSecOps Dashboard. This project is a working MVP, so contributions should keep the self-hosted monitoring path stable while making the repository safer, clearer, and easier to operate.

## Fork And Clone

1. Fork `Claritys11/DevSecOps-Dashboard`.
2. Clone your fork.
3. Add the upstream remote.

```bash
git clone https://github.com/YOUR-USER/DevSecOps-Dashboard.git
cd DevSecOps-Dashboard
git remote add upstream https://github.com/Claritys11/DevSecOps-Dashboard.git
```

## Branches And Commits

Create a branch for each change:

```bash
git switch -c feat/short-description
```

Use Conventional Commits:

```text
feat: add endpoint filter
fix: reject unsafe monitor redirects
docs: document agent enrollment
chore: update ci checks
test: cover agent config parsing
```

## Development Setup

Requirements:

- Node.js 22 or newer
- npm
- Docker and Docker Compose
- Go 1.22 or newer for agent work

```bash
npm ci
npm run setup
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
npm run prisma:deploy
npm run prisma:seed
npm run dev -- -p 3003
```

## Validation Commands

Run the checks relevant to your change before opening a Pull Request:

```bash
npm run preflight
npm run lint
npm run typecheck
npm test
npm run build
cd agent && go test ./...
docker compose config
docker build --target runner -t devsecops-dashboard:local .
```

Do not report a command as passing unless you actually ran it.

## Tests

Add or update tests when changing:

- environment or preflight validation;
- authentication, authorization, or agent authentication;
- endpoint monitoring, redirects, DNS, or SSRF policy;
- Docker/container safety behavior;
- bootstrap, seed, or migration behavior;
- Go agent configuration or request signing/parsing.

Use focused tests that prove the behavior changed. If a meaningful test cannot be added, explain why in the PR.

## Pull Request Expectations

PRs should include:

- a clear summary and motivation;
- linked issues when available;
- exact validation commands and results;
- screenshots for UI changes;
- documentation updates for user-visible behavior;
- migration and deployment notes for config or database changes;
- security impact notes for network, auth, token, Docker, or secret-handling changes.

Keep PRs reviewable. Separate unrelated refactors, new features, and security hardening into different PRs.

## Security Reports

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md) and provide enough detail for maintainers to reproduce the issue safely.

## Documentation

Update docs when changing configuration, deployment, agent enrollment, migrations, security boundaries, or operational commands. Prefer explicit examples over hidden defaults.

## Review And Merge

Maintainers should require review, passing CI, and up-to-date branches before merge. Squash merge is preferred for a clean release history. Breaking changes need documentation and changelog entries.
