---
name: Tenant currency behavior
description: Currency codes determine how a store's existing numeric amounts are interpreted.
---

Keep legacy X-Store amounts in SAR when adding tenant-specific currencies. Selecting a different currency changes how the same stored numbers are displayed; it does not convert them.

**Why:** Existing product, sale, and report amounts were stored as numbers without a per-record currency code or exchange-rate history.

**How to apply:** Warn before changing a store's currency and never imply that historical values were converted. If historical currency accuracy becomes necessary, save currency with each transaction and implement explicit conversion records.
