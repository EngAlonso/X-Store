---
name: X-Store first founder setup
description: Preserve the one-time setup flow for the platform's first owner account.
---

Keep platform-owner registration available only before the first owner is created in a given database. After successful creation, return to regular sign-in and do not reopen the founder setup to create another owner. A newly imported Replit project has its own empty database and should guide the user through schema setup and first-owner creation instead of expecting the previous project's account to exist.

**Why:** This flow grants the highest platform role, and the user wants first-owner creation to work smoothly after each project import.

**How to apply:** When changing authentication or bootstrap behavior, preserve the server-side first-owner gate as well as the UI's status-based choice between founder setup and normal sign-in. On a fresh Replit import, account for its separate database and Secrets; never assume GitHub transfers either.
