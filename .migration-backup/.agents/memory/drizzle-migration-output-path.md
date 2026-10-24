---
name: Drizzle migration output path
description: Why the database package's Drizzle migration output directory must stay relative.
---

Keep Drizzle's `out` setting relative to the database package working directory (for example, `./migrations`). In this repository, an absolute path assembled from `__dirname` was prefixed again by Drizzle Kit and caused `generate` to look for a malformed snapshot path.

**Why:** migration generation failed while trying to open `.//home/.../migrations/meta/0000_snapshot.json`; using `./migrations` allowed it to find the existing journal and snapshot and create the next migration.

**How to apply:** when changing Drizzle configuration, keep `schema` resolution independent if needed, but leave `out` relative and verify with `pnpm --filter @workspace/db run generate`.
