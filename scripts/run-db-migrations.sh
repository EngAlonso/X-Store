#!/bin/sh
set -eu

if [ -n "${REPL_ID:-}" ] || [ "${REPL_DEPLOYMENT:-}" = "1" ]; then
  echo "Skipping startup migrations for a Replit-managed database."
  exit 0
fi

exec pnpm --filter @workspace/db run migrate
