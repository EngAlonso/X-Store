---
name: X-Store invoice lifecycle
description: Invoice identity, customer details, cashier attribution, timestamps, and generated API route accuracy.
---

Keep the same invoice number and customer details when a cart is held, restored for checkout, then paid. WhatsApp sharing should clearly distinguish an unpaid held invoice from a paid receipt.

**Why:** the user asked for the invoice number and customer name to remain visible across the pending-invoice workflow, with WhatsApp sharing for either state.

**How to apply:** preserve invoice identity and customer fields through the POS, held-sales API, and receipt; label the status accurately in customer-facing messages.

For completed sales, include the name of the account that completed checkout and the sale's creation time on the receipt and invoice sharing. Render the timestamp in the Africa/Cairo timezone.

**Why:** the user wants invoices to identify the account responsible and show the date and time clearly.

**How to apply:** resolve historical cashier names from the sale's cashier user, use the authenticated actor's name for a newly completed sale, and format the persisted timestamp for Cairo.

When adding or moving an OpenAPI operation, verify that it is nested under the intended path and inspect the generated client URL; code generation and typechecking do not detect a valid but semantically incorrect route.

**Why:** a misplaced checkout operation generated a client request to an unrelated endpoint and appeared to users as a generic sale failure.

**How to apply:** after API-spec edits, regenerate clients and check the operation's concrete URL before testing the UI.

For returns and exchanges, load selectable return items from the entered invoice, not the full inventory. Allow multiple invoice lines, cap each quantity at its unreturned balance, and record multi-line returns atomically.

**Why:** the user asked for invoice-only item selection with multiple items for returns and exchanges.

**How to apply:** fetch invoice lines by invoice number, display each line's remaining returnable quantity, and validate the selected lines together before applying stock and return changes.

For exchanges, show the price difference before confirmation and label whether the customer owes the store or the store owes a refund. Persist the exchanged items, quantities, actor, timestamp, and amounts so invoice history explains the exchange.

**Why:** the user asked to see the price difference and later identify what was exchanged and who performed it.

**How to apply:** derive the preview from invoice and replacement prices using the store's VAT, then keep the exchange details attached to both related invoice numbers in the audit-backed history.
