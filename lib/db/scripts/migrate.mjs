import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must point to an existing PostgreSQL database.");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
const migrationsFolder = fileURLToPath(new URL("../migrations/", import.meta.url));
const lockQuery =
  "SELECT pg_advisory_lock(hashtext('xstore-schema-migrations')::bigint)";
const unlockQuery =
  "SELECT pg_advisory_unlock(hashtext('xstore-schema-migrations')::bigint)";

await client.connect();
try {
  await client.query(lockQuery);
  try {
    const { rows } = await client.query(`
      SELECT
        (
          to_regclass('drizzle.__drizzle_migrations') IS NOT NULL
          OR to_regclass('public.__drizzle_migrations') IS NOT NULL
        ) AS has_migration_history,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND left(table_name, 7) = 'xstore_'
        ) AS has_existing_xstore_tables
    `);
    if (rows[0]?.has_existing_xstore_tables && !rows[0]?.has_migration_history) {
      if (process.env.XSTORE_SKIP_UNTRACKED_EXISTING_SCHEMA === "1") {
        console.info(
          "Existing X-Store tables have no Drizzle migration history; leaving the existing schema unchanged.",
        );
      } else {
        throw new Error(
          "Existing X-Store tables have no Drizzle migration history. Refusing to apply the initial migration over an existing schema.",
        );
      }
    } else {
      await migrate(drizzle(client), { migrationsFolder: path.resolve(migrationsFolder) });
      console.info("Database migrations are up to date.");
    }
  } finally {
    await client.query(unlockQuery);
  }
} finally {
  await client.end();
}
