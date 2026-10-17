# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run generate` — create a versioned Drizzle migration after changing the schema; commit it with the schema change
- `pnpm --filter @workspace/db run migrate` — apply pending migrations to an existing PostgreSQL database
- Required env: `DATABASE_URL` — Postgres connection string

For external hosting, start the API with `pnpm --filter @workspace/api-server run start`; it applies pending migrations before listening. The database itself must already exist, and `DATABASE_URL` must point to it with permission to create/alter tables. A fresh database gets empty X-Store tables; this does not copy founder accounts or business data. Existing X-Store tables without a Drizzle migration tracking table are rejected rather than overwritten and must be baselined separately. Replit-managed databases skip app-start migrations: development schema changes use the existing post-merge setup, and production schema changes use Publish.

### Every new Replit import

A GitHub import creates a separate Replit database and does not transfer accounts, store data, or Replit Secrets. An old founder login cannot work in a new import until its data is restored or the new project is pointed at the original database. To start the new import with a fresh account:

1. Add a strong `XSTORE_BOOTSTRAP_SECRET` (at least 32 characters) in Replit Secrets. Secrets do not travel with the repository.
2. Run `pnpm xstore:setup` once in Shell to create the new development schema.
3. Open `/sign-in`, create the first platform-owner account, and use the same value from Secrets in the setup-secret field.

This initializes an empty database; it does not restore the former project's accounts or business data. Never store bootstrap secrets in `.replit` or commit them to Git.

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

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
