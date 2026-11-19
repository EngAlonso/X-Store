---
name: X-Store password choice
description: The product requirement for password selection across X-Store account forms.
---

Allow any non-empty password up to 128 characters for X-Store accounts. Do not require a minimum length above one character, digits, symbols, or other composition rules.

**Why:** The user requested free choice of password after the store-owner creation form rejected their chosen value.

**How to apply:** Keep password creation and change forms, API validation, and generated schemas consistent with this rule; login must accept passwords saved under it.
