---
name: Invoice line details
description: X-Store invoice requirements and the rule for preserving historical item names.
---

Completed invoices must show each sold product's name, quantity, unit price, and line total in print, WhatsApp, and sales history.

Capture the product name when the sale is recorded so later catalog edits do not rewrite historical invoices.

Cash sales require an explicitly entered amount that covers the invoice total; wallet and InstaPay sales require the sender identifier to be recorded with the invoice.

The store owner can choose the receipt format: the existing wide A5 design, thermal 80 mm, or thermal 58 mm. Each format must use a layout composed for its paper width, and the uploaded store logo remains the receipt watermark.

**Why:** the user asked for product-level prices across all invoice channels, plus receipts whose full composition adapts to the selected paper width; the wide format must print on A5.

**How to apply:** keep invoice details available in checkout results and saved sales; enforce payment requirements in both the cashier UI and API, show stored transfer details in invoice views, and preserve format-specific layout, print width, and logo watermark. Scope page-size rules to each named receipt format; do not apply A5 as a global print default.
