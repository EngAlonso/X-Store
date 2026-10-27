---
name: Store types
description: Product scope and rollout rule for store-type selection and future category-specific workflows.
---

The supported store types are clothing and shoes, grocery and supermarkets, electronics and accessories, perfume and beauty, cafes, and restaurants. All types retain the existing X-Store workflow except for this explicitly defined wholesale rule: wholesale can be enabled at store creation for the first four types only, never cafes or restaurants. A product must have a retail price or a wholesale price; cost is optional. Retail and wholesale are separate POS sections, and a product is available only in the section for which it has a price—never substitute one price for the other.

**Why:** The user wants store type chosen during store creation and has explicitly defined wholesale eligibility, pricing, and POS behavior while keeping all other category-specific workflows unchanged.

**How to apply:** Persist store type and the wholesale-enabled setting. Enforce eligibility and price selection in both the interface and API. Do not infer other category-specific inventory, tax, or navigation behavior before the user defines it.
