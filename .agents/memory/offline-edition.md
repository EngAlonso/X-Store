---
name: X-Store offline edition
description: User requirements for a standalone, single-device Windows edition with no cloud dependency.
---

The user wants a separate Windows edition that runs on one computer per store with no internet dependency and sends no store data to the platform. Licenses should be tied to the motherboard, internal drive, and RAM so changing any of them requires the platform owner to reissue activation; copying the app or backup must not transfer activation. During the first setup, the platform owner manually chooses/configures the store system. Include all store-facing X-Store functions. Automatically create backups in a folder selected during installation; the user will copy backups to a USB drive manually. Reinstalling or removing the program must not remove the store data or backups, and the edition needs a restore path.

**Why:** the user wants to collect payment, configure a standalone offline copy for each merchant, and leave without needing to know or receive the merchant's data. Hardware binding makes copying the store files alone insufficient to reuse a license.

**How to apply:** keep this edition independent from the hosted X-Store service, use local persistence, and make the no-network/no-sync boundary explicit. Exclude platform-wide tenant and subscription administration unless the user explicitly changes this requirement. The offline app cannot remotely revoke a license; treat device replacement as a manual reissue and explain that copied app data does not carry activation to another system.

When the user requests parity with the hosted edition, use its current store-facing workflows as the checklist. Keep transaction data local; for actions that normally require an internet service, provide local print/export options and clearly identify the limitation.

**Why:** the offline edition should match the store workflow without violating the no-internet boundary.

**How to apply:** compare the offline POS, inventory, sales, returns, team, reports, settings, and backup flows against the hosted store app; do not add network calls for convenience.

**Linux packaging note:** the NSIS installer target could not finish without Wine; a portable Windows x64 executable built successfully with executable resource editing disabled. That portable file is a self-extracting app, not a setup wizard, and has not been launched on Windows.

**Why:** Replit's build host is Linux, so a successful package build does not prove native Windows behavior or backup-path handling.

**How to apply:** use the portable target for a distributable preview; create the NSIS installer on Windows or Linux with Wine, then smoke-test launch, persistence, backup, and restore on Windows before merchant delivery.
