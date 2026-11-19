---
name: Platform database administration
description: The access scope and integrity expectations for X-Store's owner database tools.
---

Database browsing and cleanup are reserved for the platform owner and apply across all stores.

**Why:** The user selected global owner access to remove experimental data, rather than store-owner access.

**How to apply:** Keep both the interface and API restricted to the platform-owner role. Preserve audit history and protect records whose deletion would corrupt invoice or inventory state.
