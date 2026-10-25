import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must point to an existing PostgreSQL database.");
}

function getClientConfig() {
  const caCertificate = process.env.DATABASE_CA_CERT?.trim();
  const parsedUrl = new URL(process.env.DATABASE_URL);
  const isAiven = parsedUrl.hostname.endsWith(".aivencloud.com");
  const disableSsl = process.env.XSTORE_DISABLE_DB_SSL === "1";

  if (isAiven && !caCertificate) {
    throw new Error(
      "DATABASE_CA_CERT must be set to the Aiven project CA certificate.",
    );
  }

  if (disableSsl && !isAiven) {
    // Replit's development database does not accept SSL, even if its URL
    // contains SSL options. Keep this override limited to the dev command.
    for (const key of [
      "sslmode",
      "sslrootcert",
      "sslcert",
      "sslkey",
      "uselibpqcompat",
    ]) {
      parsedUrl.searchParams.delete(key);
    }
    return { connectionString: parsedUrl.toString(), ssl: false };
  }

  if (!caCertificate) {
    return { connectionString: process.env.DATABASE_URL };
  }

  // pg-connection-string SSL URL options override the explicit `ssl` object.
  // Remove them so the Aiven CA is used with certificate verification enabled.
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "uselibpqcompat",
  ]) {
    parsedUrl.searchParams.delete(key);
  }

  return {
    connectionString: parsedUrl.toString(),
    ssl: {
      ca: caCertificate,
      rejectUnauthorized: true,
    },
  };
}

const client = new Client(getClientConfig());
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
    if (
      process.env.XSTORE_REPLIT_DEV_BOOTSTRAP_ONLY === "1" &&
      rows[0]?.has_migration_history
    ) {
      console.info(
        "Skipping Replit development startup migrations; post-merge setup applies schema changes.",
      );
    } else if (rows[0]?.has_existing_xstore_tables && !rows[0]?.has_migration_history) {
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
