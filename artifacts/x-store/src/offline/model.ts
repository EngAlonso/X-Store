export const OFFLINE_STORE_TYPES = [
  { value: "clothing_shoes", label: "ملابس وأحذية", supportsWholesale: true },
  { value: "grocery_supermarket", label: "بقالة وسوبر ماركت", supportsWholesale: true },
  { value: "electronics_accessories", label: "إلكترونيات وإكسسوارات", supportsWholesale: true },
  { value: "perfume_beauty", label: "عطور وتجميل", supportsWholesale: true },
  { value: "cafe", label: "كافيه", supportsWholesale: false },
  { value: "restaurant", label: "مطعم", supportsWholesale: false },
] as const;

export const OFFLINE_CURRENCIES = [
  { value: "EGP", label: "جنيه مصري" },
  { value: "SAR", label: "ريال سعودي" },
  { value: "AED", label: "درهم إماراتي" },
  { value: "USD", label: "دولار أمريكي" },
  { value: "EUR", label: "يورو" },
  { value: "GBP", label: "جنيه إسترليني" },
] as const;

export const LICENSE_DURATIONS = [1, 3, 6, 12, 24, 36] as const;

export type OfflineStoreType = (typeof OFFLINE_STORE_TYPES)[number]["value"];
export type OfflineCurrency = (typeof OFFLINE_CURRENCIES)[number]["value"];
export type OfflinePaymentMethod = "cash" | "card" | "transfer";
export type OfflineSaleType = "retail" | "wholesale";

export interface OfflineStore {
  name: string;
  businessType: string;
  storeType: OfflineStoreType;
  currency: OfflineCurrency;
  vatRate: number;
  wholesaleEnabled: boolean;
}

export interface OfflineLicense {
  startedAt: string;
  months: number;
  expiresAt: string;
}

export interface OfflineProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  costPrice: number;
  price: number;
  wholesalePrice: number | null;
  quantity: number;
  createdAt: string;
}

export interface OfflineSaleLine {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OfflineSale {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  paymentMethod: OfflinePaymentMethod;
  saleType: OfflineSaleType;
  items: OfflineSaleLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface OfflineBackupInfo {
  backupFolder: string | null;
  lastAutomaticBackupAt: string | null;
  lastManualBackupAt: string | null;
  lastError: string | null;
}

export interface OfflineState {
  schemaVersion: 1;
  setupComplete: boolean;
  store: OfflineStore | null;
  license: OfflineLicense | null;
  products: OfflineProduct[];
  sales: OfflineSale[];
  backup: OfflineBackupInfo;
}

export function createEmptyOfflineState(): OfflineState {
  return {
    schemaVersion: 1,
    setupComplete: false,
    store: null,
    license: null,
    products: [],
    sales: [],
    backup: {
      backupFolder: null,
      lastAutomaticBackupAt: null,
      lastManualBackupAt: null,
      lastError: null,
    },
  };
}

export function addMonthsToDate(dateValue: string, months: number): string {
  const date = new Date(`${dateValue}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isLicenseActive(license: OfflineLicense | null, now = new Date()): boolean {
  if (!license) return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return license.expiresAt >= today;
}

export function isOfflineState(value: unknown): value is OfflineState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<OfflineState>;
  if (
    state.schemaVersion !== 1 ||
    typeof state.setupComplete !== "boolean" ||
    !Array.isArray(state.products) ||
    !Array.isArray(state.sales) ||
    !state.backup ||
    typeof state.backup !== "object"
  ) {
    return false;
  }
  if (state.store !== null && state.store !== undefined) {
    if (
      typeof state.store.name !== "string" ||
      typeof state.store.businessType !== "string" ||
      !OFFLINE_STORE_TYPES.some((item) => item.value === state.store?.storeType) ||
      !OFFLINE_CURRENCIES.some((item) => item.value === state.store?.currency) ||
      !Number.isFinite(state.store.vatRate) ||
      state.store.vatRate < 0 ||
      state.store.vatRate > 100 ||
      typeof state.store.wholesaleEnabled !== "boolean"
    ) {
      return false;
    }
  }
  if (state.license !== null && state.license !== undefined) {
    if (
      typeof state.license.startedAt !== "string" ||
      typeof state.license.expiresAt !== "string" ||
      !LICENSE_DURATIONS.includes(state.license.months as (typeof LICENSE_DURATIONS)[number]) ||
      !Number.isFinite(Date.parse(state.license.startedAt)) ||
      !Number.isFinite(Date.parse(`${state.license.expiresAt}T12:00:00`))
    ) {
      return false;
    }
  }
  const backup = state.backup;
  const validBackupInfo =
    (backup.backupFolder === null || typeof backup.backupFolder === "string") &&
    (backup.lastAutomaticBackupAt === null ||
      (typeof backup.lastAutomaticBackupAt === "string" &&
        Number.isFinite(Date.parse(backup.lastAutomaticBackupAt)))) &&
    (backup.lastManualBackupAt === null ||
      (typeof backup.lastManualBackupAt === "string" &&
        Number.isFinite(Date.parse(backup.lastManualBackupAt)))) &&
    (backup.lastError === null || typeof backup.lastError === "string");
  const productsAreValid = state.products.every(
    (product) =>
      typeof product.id === "string" &&
      typeof product.name === "string" &&
      typeof product.sku === "string" &&
      typeof product.barcode === "string" &&
      typeof product.category === "string" &&
      Number.isFinite(product.costPrice) &&
      product.costPrice >= 0 &&
      Number.isFinite(product.price) &&
      product.price >= 0 &&
      (product.wholesalePrice === null ||
        (Number.isFinite(product.wholesalePrice) && product.wholesalePrice >= 0)) &&
      Number.isInteger(product.quantity) &&
      product.quantity >= 0 &&
      Number.isFinite(Date.parse(product.createdAt)),
  );
  const salesAreValid = state.sales.every(
    (sale) =>
      typeof sale.id === "string" &&
      typeof sale.invoiceNumber === "string" &&
      Number.isFinite(Date.parse(sale.createdAt)) &&
      typeof sale.customerName === "string" &&
      ["cash", "card", "transfer"].includes(sale.paymentMethod) &&
      ["retail", "wholesale"].includes(sale.saleType) &&
      Number.isFinite(sale.subtotal) &&
      Number.isFinite(sale.taxAmount) &&
      Number.isFinite(sale.total) &&
      Array.isArray(sale.items) &&
      sale.items.every(
        (item) =>
          typeof item.productId === "string" &&
          typeof item.name === "string" &&
          typeof item.sku === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          Number.isFinite(item.unitPrice) &&
          Number.isFinite(item.lineTotal),
      ),
  );
  if (state.setupComplete && (!state.store || !state.license)) return false;
  return validBackupInfo && productsAreValid && salesAreValid;
}
