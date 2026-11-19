---
name: Store types
description: Product scope and rollout rule for store-type selection and future category-specific workflows.
---

The supported store types are clothing and shoes, grocery and supermarkets, electronics and accessories, perfume and beauty, cafes, and restaurants. All types retain the existing X-Store workflow except for this explicitly defined wholesale rule: wholesale can be enabled at store creation for the first four types only, never cafes or restaurants. Platform admins can later edit a tenant's name, activity, store type, and wholesale setting; changing to an ineligible type disables wholesale. A product must have a retail price or a wholesale price; cost is optional. Retail and wholesale are separate POS sections, and a product is available only in the section for which it has a price—never substitute one price for the other. Team members receive separate retail-sales and wholesale-sales permissions; the legacy cashier permission continues to grant both.

**Why:** The user wants store type chosen during store creation, platform-admin editing of existing store details, and explicit wholesale eligibility, pricing, POS behavior, and separate per-member permissions for each sales mode while keeping other category-specific workflows unchanged.

**How to apply:** Persist store type and the wholesale-enabled setting. Enforce store eligibility during both creation and editing, disable wholesale when a store becomes ineligible, and enforce each member's sale-type permissions and price selection in both interface and API. Keep existing cashier accounts fully enabled for both modes. Do not infer other category-specific inventory, tax, or navigation behavior before the user defines it.
