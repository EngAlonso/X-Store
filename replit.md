# X-Store

Arabic-first store management product with a hosted web edition and a separate, local Windows edition in development.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `pnpm run migrate:production` — apply pending tracked migrations to Aiven production using the `AIVEN_PRODUCTION_DATABASE_URL` Replit Secret and the checked-in Project CA certificate.
- Hosted web preview: open `/`; the API is served separately under `/api`.
- Offline edition preview: open `/offline.html` in the X-Store web workflow. Browser storage is only a preview and is not the Windows data store.
- `pnpm --filter @workspace/x-store run desktop:dev` — run the standalone Electron shell locally (requires a graphical desktop).
- `pnpm --filter @workspace/x-store run desktop:build` — build the standalone offline renderer.
- `pnpm --filter @workspace/x-store run desktop:package:win` — package the offline edition as a portable Windows x64 executable.
- `pnpm --filter @workspace/x-store run desktop:installer:win` — create an NSIS installer on Windows or a Linux machine with Wine installed.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Keep the hosted app and offline edition separate: the offline renderer does not import the hosted API client.
- Electron blocks external network requests in the packaged offline edition; only local renderer assets and local IPC are used.
- Offline state is stored outside the install directory; Windows backups are written to the folder selected during first-run setup and are not removed by the uninstaller.
- The offline edition includes the store-facing hosted workflows: dashboard, inventory and quantity adjustments, retail/wholesale point of sale, held sales, sales and invoice history, returns/exchanges, financial reports, team permissions, store settings, local audit history, backup/restore, and local license status.
- Offline license dates currently use local device data and local system time; they are not cryptographically signed or device-bound.

## Product

The hosted edition manages store accounts through the X-Store API. The separate offline Windows edition covers store-facing POS, inventory, sales, returns/exchanges, reports, team permissions, and store settings, with local authentication, licensing, audit history, and backup/restore. Platform-wide tenant and subscription administration is intentionally excluded from the offline edition.

## User preferences

- The offline edition is for one store at a time, must work without internet, and must not send the merchant's data to the platform.
- The seller configures store type/activity and license duration; automatic backups go to a user-selected folder that can be copied to removable storage.

## Gotchas

- The offline Windows app is a separate target from the hosted web build; use the `desktop:*` scripts for it. The portable executable is the supported build from this Linux environment.
- Browser preview of `/offline.html` persists only in browser local storage and cannot validate Windows filesystem backups or Electron IPC.
- Do not publish the offline route as a substitute for the installer; packaged Electron runtime and backup paths must be tested on Windows before customer delivery.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
