#!/bin/sh
set -eu

if [ "${SKIP_PREFLIGHT:-false}" != "true" ]; then
  if [ "${NODE_ENV:-production}" = "production" ]; then
    npm run preflight -- --production
  else
    npm run preflight -- --development
  fi
fi

if [ "${RUN_DATABASE_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "${RUN_DATABASE_SEED:-false}" = "true" ]; then
  npm run prisma:seed
fi

exec "$@"
