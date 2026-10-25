---
name: Invoice line details
description: X-Store invoice requirements and the rule for preserving historical item names.
---

Completed invoices must show each sold product's name, quantity, unit price, and line total in print, WhatsApp, and sales history.

Capture the product name when the sale is recorded so later catalog edits do not rewrite historical invoices.

Cash sales require an explicitly entered amount that covers the invoice total; wallet and InstaPay sales require the sender identifier to be recorded with the invoice.

**Why:** the user asked for product-level prices across all invoice channels, not only a total.

**How to apply:** keep invoice details available in checkout results and saved sales; enforce payment requirements in both the cashier UI and API, and show stored transfer details in invoice views.
