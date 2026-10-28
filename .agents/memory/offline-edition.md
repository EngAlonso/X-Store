---
name: X-Store offline edition
description: User requirements for a standalone, single-device Windows edition with no cloud dependency.
---

The user wants a separate Windows edition that runs on one computer per store with no internet dependency and sends no store data to the platform. During the first setup, the platform owner manually chooses/configures the store system. Include all store-facing X-Store functions. Automatically create backups in a folder selected during installation; the user will copy backups to a USB drive manually. Reinstalling or removing the program must not remove the store data or backups, and the edition needs a restore path.

**Why:** the user wants to collect payment, configure a standalone offline copy for each merchant, and leave without needing to know or receive the merchant's data.

**How to apply:** keep this edition independent from the hosted X-Store service, use local persistence, and make the no-network/no-sync boundary explicit. Exclude platform-wide tenant and subscription administration unless the user explicitly changes this requirement. Do not assume how offline licenses or renewals work until the user defines them.
