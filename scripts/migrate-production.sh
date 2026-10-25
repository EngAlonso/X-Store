#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CA_FILE="$ROOT_DIR/certs/aiven-project-ca.pem"

if [ -z "${AIVEN_PRODUCTION_DATABASE_URL:-}" ]; then
  echo "AIVEN_PRODUCTION_DATABASE_URL is missing. Add the Aiven production connection string in Replit Secrets." >&2
  exit 1
fi

if [ ! -s "$CA_FILE" ]; then
  echo "Aiven CA certificate is missing: $CA_FILE" >&2
  exit 1
fi

# Override Replit's runtime-managed DATABASE_URL only for this migration process.
DATABASE_URL="$AIVEN_PRODUCTION_DATABASE_URL"
DATABASE_CA_CERT=$(cat "$CA_FILE")
export DATABASE_URL DATABASE_CA_CERT

cd "$ROOT_DIR"
exec pnpm --filter @workspace/db run migrate
