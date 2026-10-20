---
name: X-Store invoice lifecycle
description: Customer details, invoice identity, hold/restore behavior, and WhatsApp status labels.
---

Keep the same invoice number and customer details when a cart is held, restored for checkout, then paid. WhatsApp sharing should clearly distinguish an unpaid held invoice from a paid receipt.

**Why:** the user asked for the invoice number and customer name to remain visible across the pending-invoice workflow, with WhatsApp sharing for either state.

**How to apply:** preserve invoice identity and customer fields through the POS, held-sales API, and receipt; label the status accurately in customer-facing messages.
