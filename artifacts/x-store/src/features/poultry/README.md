# Poultry feature

This directory owns the online poultry-store experience.

## Frontend boundaries

- `PoultryPages.tsx`: customer accounts, kilogram sales, collections, statements, and poultry dashboard.
- `poultryApi.ts`: the only frontend HTTP client for `/api/xstore/poultry/*`.
- `poultryShell.ts`: poultry-only sidebar entries and notification polling.
- `poultry.css`: feature-scoped responsive and print styles.
- `index.ts`: public feature exports.

`App.tsx` keeps only thin route/session adapters. The general store navigation no longer declares poultry routes, and the general shell does not fetch poultry endpoints directly.

## Backend boundaries

`artifacts/api-server/src/routes/poultry.ts` owns every poultry HTTP endpoint. It has its own authenticated router and verifies the authenticated tenant's `storeType` is `poultry` before serving every endpoint. The general `xstore.ts` router no longer declares poultry endpoints.

## Data compatibility

Existing poultry customer, invoice, invoice-item, and payment tables are retained. This rebuild does not drop, rename, or migrate production data. The existing schema and migration remain compatible with previously recorded invoices and collections.

## Permission boundaries

- Customer management: tenant admin, cashier, or `customer_management`.
- Sales: tenant admin, cashier, or `retail_sales`.
- Collections: tenant admin, cashier, or `collector`.
- Customer lists and statements are readable by the poultry roles already authorized by the product.

Keep poultry changes inside this feature and its dedicated API router unless a deliberate shared-platform contract is required.
