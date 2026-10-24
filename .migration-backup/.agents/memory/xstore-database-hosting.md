---
name: X-Store database hosting
description: The selected production database provider and TLS requirements for deployment.
---

X-Store's hosted PostgreSQL database is on Aiven.

**Why:** the user said they host this database on Aiven. Aiven's project-specific CA must be trusted by the PostgreSQL client for verified TLS connections.

**How to apply:** Configure `DATABASE_URL` with Aiven's Service URI and `DATABASE_CA_CERT` with the Aiven project CA. Keep certificate verification enabled; do not bypass TLS validation to work around certificate errors.
