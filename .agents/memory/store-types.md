---
name: Store types
description: Product scope and rollout rule for store-type selection and future category-specific workflows.
---

The supported store types are clothing and shoes, grocery and supermarkets, electronics and accessories, perfume and beauty, cafes, and restaurants. For now, all types use the existing X-Store system; category-specific workflows should only be added after the user and agent define them together.

**Why:** The user wants store type chosen during store creation but explicitly wants the current system retained for every store until they jointly decide how each type should work.

**How to apply:** Persist the selected type as store metadata. Do not infer or build category-specific inventory, sales, tax, or navigation behavior before the user defines it.
