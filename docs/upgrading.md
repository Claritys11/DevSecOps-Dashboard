# Upgrading

Re-run the installer from the same machine:

```bash
curl -fsSL https://raw.githubusercontent.com/Claritys11/DevSecOps-Dashboard/main/install.sh | bash
```

Or, from an existing checkout:

```bash
cd ~/devsecops-dashboard
git pull
./install.sh
```

Your `.env` and database are kept. Migrations run automatically when the `app` container starts.

## From 0.x to 1.0

- **Servers, agents, endpoints and users are now managed in the UI.** Existing `PRIMARY_AGENT_*` / `SECONDARY_AGENT_*` (and the older `CACHYOS_*` / `UBUNTU_NSPAWN_*`) variables keep working. Their servers keep their ids and history.
- **The bootstrap runs on every start** (`RUN_DATABASE_SEED` now defaults to `true`). It only creates what is missing. It no longer resets the admin password. Use `ADMIN_RESET_PASSWORD=true` for that.
- **`SEED_HOMELAB_EXAMPLES`, `SEED_DASHBOARD_ENDPOINT`, `DASHBOARD_HEALTH_URL` and `COOLIFY_STATUS_URL` were removed.** Endpoints created earlier stay. Manage them from the Endpoints page.
- **`AUTH_URL` is optional.** Leave it empty to open the dashboard by any hostname.
- **One image** now runs both the app and the worker, and bundles the agent binaries.
- Container management is enabled with `COMPOSE_FILE=docker-compose.yml:docker-compose.docker-socket.yml` instead of a Compose profile.

## Rolling back

Check out the previous tag and re-run the installer with `--build`. Database migrations only add columns and enum values, so older versions keep working on an upgraded database.
