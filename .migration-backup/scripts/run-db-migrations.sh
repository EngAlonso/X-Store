#!/bin/sh
set -eu

if [ "${REPL_DEPLOYMENT:-}" = "1" ]; then
  echo "Skipping startup migrations for the Replit-managed production database; Publish applies its schema."
  exit 0
fi

if [ -n "${REPL_ID:-}" ]; then
  export XSTORE_SKIP_UNTRACKED_EXISTING_SCHEMA=1
  export XSTORE_REPLIT_DEV_BOOTSTRAP_ONLY=1
fi

exec pnpm --filter @workspace/db run migrate
