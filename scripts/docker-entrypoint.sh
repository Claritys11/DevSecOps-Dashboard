#!/bin/sh
set -eu

# The worker shares this image; it only needs the database, so skip app-only steps.
if [ "${1:-}" = "worker" ]; then
  exec npx tsx src/worker/monitor-scheduler.ts
fi

if [ "${SKIP_PREFLIGHT:-false}" != "true" ]; then
  if [ "${NODE_ENV:-production}" = "production" ]; then
    npx tsx src/server/config/preflight.ts --production
  else
    npx tsx src/server/config/preflight.ts --development
  fi
fi

if [ "${RUN_DATABASE_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "${RUN_DATABASE_SEED:-true}" = "true" ]; then
  npx tsx prisma/seed.ts
fi

exec "$@"
