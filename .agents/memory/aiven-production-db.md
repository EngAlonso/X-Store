---
name: Production database on Aiven
description: X-Store production PostgreSQL is hosted on Aiven and serves the Vercel deployment.
---

Production X-Store uses Aiven PostgreSQL, while the app is deployed on Vercel. The database connection requires the current Aiven Project CA certificate from the same service in `DATABASE_CA_CERT`; keep TLS certificate verification enabled. Replit development's managed database rejects SSL, so disable SSL only through the local development command. Schema changes are tracked with Drizzle migrations and must target the intended production `DATABASE_URL`, not Replit's managed database.

**Why:** The user confirmed Aiven as the provider, and a production schema mismatch caused API failures while the Replit development database was already migrated.

**How to apply:** For Vercel database errors, confirm the Aiven service URL and CA are paired, then run the project's tracked migration workflow against production. Never expose connection strings or bypass TLS validation. Keep any SSL-disabled override restricted to Replit development; production must continue using verified Aiven TLS.
