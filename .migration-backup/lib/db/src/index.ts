import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = databaseUrl;

function getPoolConfig() {
  const caCertificate = process.env.DATABASE_CA_CERT?.trim();
  const parsedUrl = new URL(connectionString);
  const isAiven = parsedUrl.hostname.endsWith(".aivencloud.com");

  if (isAiven && !caCertificate) {
    throw new Error(
      "DATABASE_CA_CERT must be set to the Aiven project CA certificate.",
    );
  }

  if (!caCertificate) {
    return { connectionString };
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

export const pool = new Pool(getPoolConfig());
export const db = drizzle(pool, { schema });

export * from "./schema";
