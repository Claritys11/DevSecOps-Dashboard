#!/bin/sh
set -eu

if [ "${RUN_DATABASE_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "${RUN_DATABASE_SEED:-true}" = "true" ]; then
  npm run prisma:seed
fi

exec "$@"
