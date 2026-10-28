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

export const OFFLINE_LICENSE_PLANS = ["monthly", "half_yearly", "annual", "lifetime"] as const;
export const OFFLINE_INVOICE_FORMATS = ["wide", "thermal_80mm", "thermal_58mm"] as const;
export const OFFLINE_TEAM_PERMISSIONS = [
  "retail_sales",
  "wholesale_sales",
  "warehouse_manager",
  "accountant",
] as const;

export type OfflineStoreType = (typeof OFFLINE_STORE_TYPES)[number]["value"];
export type OfflineCurrency = (typeof OFFLINE_CURRENCIES)[number]["value"];
export type OfflinePaymentMethod = "cash" | "card" | "wallet" | "instapay" | "transfer";
export type OfflineSaleType = "retail" | "wholesale";
export type OfflineInvoiceFormat = (typeof OFFLINE_INVOICE_FORMATS)[number];
export type OfflineTeamPermission = (typeof OFFLINE_TEAM_PERMISSIONS)[number];
export type OfflineLicensePlan = (typeof OFFLINE_LICENSE_PLANS)[number];

export interface OfflineLicensePayload {
  version: 1;
  licenseId: string;
  installationId: string;
  storeName: string;
  plan: OfflineLicensePlan;
  issuedAt: string;
  expiresAt: string | null;
}

export interface OfflineLicense {
  payload: OfflineLicensePayload;
  signature: string;
}

export interface OfflineStore {
  name: string;
  businessType: string;
  storeType: OfflineStoreType;
  currency: OfflineCurrency;
  vatRate: number;
  wholesaleEnabled: boolean;
  invoiceFormat: OfflineInvoiceFormat;
}

export interface OfflineProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  costPrice: number;
  price: number | null;
  wholesalePrice: number | null;
  quantity: number;
  color: string;
  size: string;
  partNumber: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface OfflineSaleLine {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  returnedQuantity: number;
}

export interface OfflineSale {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: OfflinePaymentMethod;
  saleType: OfflineSaleType;
  transferSender: string;
  items: OfflineSaleLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountReceived: number;
  changeAmount: number;
  cashierName: string;
  exchangeOfInvoiceNumber: string | null;
}

export interface OfflineHeldSaleLine {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface OfflineHeldSale {
  id: string;
  reference: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: OfflinePaymentMethod;
  saleType: OfflineSaleType;
  transferSender: string;
  items: OfflineHeldSaleLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  estimatedTotal: number;
  amountReceived: number;
}

export interface OfflineReturnItem {
  productId: string;
  name: string;
  quantity: number;
  refundAmount: number;
  costAmount: number;
}

export interface OfflineReturn {
  id: string;
  saleId: string;
  invoiceNumber: string;
  createdAt: string;
  reason: string;
  cashierName: string;
  items: OfflineReturnItem[];
  refundAmount: number;
  costAmount: number;
}

export interface OfflineExchange {
  id: string;
  originalInvoiceNumber: string;
  replacementInvoiceNumber: string;
  createdAt: string;
  returnedAmount: number;
  replacementAmount: number;
  balanceDue: number;
  changeAmount: number;
}

export type OfflineTeamRole =
  | "tenant_admin"
  | "cashier"
  | "warehouse_manager"
  | "accountant"
  | "custom";

export interface OfflineTeamMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: OfflineTeamRole;
  roleName: string;
  permissions: OfflineTeamPermission[];
  active: boolean;
  pinSalt: string | null;
  pinHash: string | null;
  pinIterations: number | null;
  createdAt: string;
}

export interface OfflineAuditLog {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface OfflineBackupInfo {
  backupFolder: string | null;
  lastAutomaticBackupAt: string | null;
  lastManualBackupAt: string | null;
  lastError: string | null;
}

export interface OfflineState {
  schemaVersion: 3;
  setupComplete: boolean;
  store: OfflineStore | null;
  license: OfflineLicense | null;
  products: OfflineProduct[];
  sales: OfflineSale[];
  heldSales: OfflineHeldSale[];
  returns: OfflineReturn[];
  exchanges: OfflineExchange[];
  teamMembers: OfflineTeamMember[];
  auditLogs: OfflineAuditLog[];
  backup: OfflineBackupInfo;
}

export function createEmptyOfflineState(): OfflineState {
  return {
    schemaVersion: 3,
    setupComplete: false,
    store: null,
    license: null,
    products: [],
    sales: [],
    heldSales: [],
    returns: [],
    exchanges: [],
    teamMembers: [],
    auditLogs: [],
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
  const startsAt = license.payload.issuedAt.slice(0, 10);
  return startsAt <= today && (license.payload.expiresAt === null || license.payload.expiresAt >= today);
}

export function calculateSaleItemReturn(
  sale: OfflineSale,
  item: OfflineSaleLine,
  quantity: number,
): { refundAmount: number; costAmount: number } {
  const discountShare = sale.subtotal > 0
    ? Math.min(1, sale.discountAmount / sale.subtotal)
    : 0;
  const taxableSubtotal = Math.max(0, sale.subtotal - sale.discountAmount);
  const taxRate = taxableSubtotal > 0 ? sale.taxAmount / taxableSubtotal : 0;
  const discountedLineAmount = item.unitPrice * quantity * (1 - discountShare);
  return {
    refundAmount: Math.round(discountedLineAmount * (1 + taxRate) * 100) / 100,
    costAmount: Math.round(item.unitCost * quantity * 100) / 100,
  };
}

export function isOfflineState(value: unknown): value is OfflineState {
  if (!isRecord(value) || value.schemaVersion !== 3) return false;
  const state = value as unknown as OfflineState;
  if (
    typeof state.setupComplete !== "boolean" ||
    !Array.isArray(state.products) ||
    !Array.isArray(state.sales) ||
    !Array.isArray(state.heldSales) ||
    !Array.isArray(state.returns) ||
    !Array.isArray(state.exchanges) ||
    !Array.isArray(state.teamMembers) ||
    !Array.isArray(state.auditLogs) ||
    !isRecord(state.backup)
  ) return false;

  if (state.store !== null && (
    !isRecord(state.store) ||
    typeof state.store.name !== "string" ||
    typeof state.store.businessType !== "string" ||
    !OFFLINE_STORE_TYPES.some((item) => item.value === state.store?.storeType) ||
    !OFFLINE_CURRENCIES.some((item) => item.value === state.store?.currency) ||
    !OFFLINE_INVOICE_FORMATS.includes(state.store.invoiceFormat) ||
    !Number.isFinite(state.store.vatRate) ||
    state.store.vatRate < 0 ||
    state.store.vatRate > 100 ||
    typeof state.store.wholesaleEnabled !== "boolean"
  )) return false;

  if (state.license !== null && !isOfflineLicense(state.license)) return false;

  const backup = state.backup;
  const backupIsValid =
    (backup.backupFolder === null || typeof backup.backupFolder === "string") &&
    (backup.lastAutomaticBackupAt === null || isDate(backup.lastAutomaticBackupAt)) &&
    (backup.lastManualBackupAt === null || isDate(backup.lastManualBackupAt)) &&
    (backup.lastError === null || typeof backup.lastError === "string");

  const productsAreValid = state.products.every((product) =>
    isRecord(product) &&
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    typeof product.sku === "string" &&
    typeof product.barcode === "string" &&
    typeof product.category === "string" &&
    Number.isFinite(product.costPrice) && product.costPrice >= 0 &&
    (product.price === null || (Number.isFinite(product.price) && product.price >= 0)) &&
    (product.wholesalePrice === null || (Number.isFinite(product.wholesalePrice) && product.wholesalePrice >= 0)) &&
    Number.isInteger(product.quantity) && product.quantity >= 0 &&
    typeof product.color === "string" &&
    typeof product.size === "string" &&
    typeof product.partNumber === "string" &&
    (product.expiresAt === null || (typeof product.expiresAt === "string" && Number.isFinite(Date.parse(`${product.expiresAt}T12:00:00`)))) &&
    isDate(product.createdAt),
  );
  const saleLineIsValid = (item: unknown) =>
    isRecord(item) &&
    typeof item.productId === "string" &&
    typeof item.name === "string" &&
    typeof item.sku === "string" &&
    Number.isInteger(item.quantity) && item.quantity > 0 &&
    Number.isFinite(item.unitPrice) && item.unitPrice >= 0 &&
    Number.isFinite(item.unitCost) && item.unitCost >= 0 &&
    Number.isFinite(item.lineTotal) && item.lineTotal >= 0 &&
    Number.isInteger(item.returnedQuantity) && item.returnedQuantity >= 0 &&
    item.returnedQuantity <= item.quantity;
  const salesAreValid = state.sales.every((sale) =>
    isRecord(sale) &&
    typeof sale.id === "string" &&
    typeof sale.invoiceNumber === "string" &&
    isDate(sale.createdAt) &&
    typeof sale.customerName === "string" &&
    typeof sale.customerPhone === "string" &&
    ["cash", "card", "wallet", "instapay", "transfer"].includes(sale.paymentMethod) &&
    ["retail", "wholesale"].includes(sale.saleType) &&
    typeof sale.transferSender === "string" &&
    typeof sale.cashierName === "string" &&
    (sale.exchangeOfInvoiceNumber === null || typeof sale.exchangeOfInvoiceNumber === "string") &&
    Number.isFinite(sale.subtotal) && sale.subtotal >= 0 &&
    Number.isFinite(sale.discountAmount) && sale.discountAmount >= 0 && sale.discountAmount <= sale.subtotal &&
    Number.isFinite(sale.taxAmount) && sale.taxAmount >= 0 &&
    Number.isFinite(sale.total) && sale.total >= 0 &&
    Number.isFinite(sale.amountReceived) && sale.amountReceived >= 0 &&
    Number.isFinite(sale.changeAmount) && sale.changeAmount >= 0 &&
    Array.isArray(sale.items) && sale.items.length > 0 && sale.items.every(saleLineIsValid),
  );
  const heldSalesAreValid = state.heldSales.every((held) =>
    isRecord(held) &&
    typeof held.id === "string" &&
    typeof held.reference === "string" &&
    isDate(held.createdAt) &&
    typeof held.customerName === "string" &&
    typeof held.customerPhone === "string" &&
    ["cash", "card", "wallet", "instapay", "transfer"].includes(held.paymentMethod) &&
    ["retail", "wholesale"].includes(held.saleType) &&
    typeof held.transferSender === "string" &&
    Number.isFinite(held.subtotal) && Number.isFinite(held.discountAmount) &&
    Number.isFinite(held.taxAmount) && Number.isFinite(held.estimatedTotal) &&
    Number.isFinite(held.amountReceived) &&
    Array.isArray(held.items) && held.items.length > 0 &&
    held.items.every((item) => saleLineIsValid({ ...item, lineTotal: item.quantity * item.unitPrice, returnedQuantity: 0 })),
  );
  const returnsAreValid = state.returns.every((record) =>
    isRecord(record) &&
    typeof record.id === "string" &&
    typeof record.saleId === "string" &&
    typeof record.invoiceNumber === "string" &&
    isDate(record.createdAt) &&
    typeof record.reason === "string" &&
    typeof record.cashierName === "string" &&
    Number.isFinite(record.refundAmount) && record.refundAmount >= 0 &&
    Number.isFinite(record.costAmount) && record.costAmount >= 0 &&
    Array.isArray(record.items) && record.items.length > 0 &&
    record.items.every((item) => isRecord(item) && typeof item.productId === "string" && typeof item.name === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(item.refundAmount) && item.refundAmount >= 0 && Number.isFinite(item.costAmount) && item.costAmount >= 0),
  );
  const exchangesAreValid = state.exchanges.every((exchange) =>
    isRecord(exchange) &&
    typeof exchange.id === "string" &&
    typeof exchange.originalInvoiceNumber === "string" &&
    typeof exchange.replacementInvoiceNumber === "string" &&
    isDate(exchange.createdAt) &&
    Number.isFinite(exchange.returnedAmount) && exchange.returnedAmount >= 0 &&
    Number.isFinite(exchange.replacementAmount) && exchange.replacementAmount >= 0 &&
    Number.isFinite(exchange.balanceDue) &&
    Number.isFinite(exchange.changeAmount) && exchange.changeAmount >= 0,
  );
  const teamIsValid = state.teamMembers.every((member) =>
    isRecord(member) &&
    typeof member.id === "string" &&
    typeof member.name === "string" &&
    typeof member.phone === "string" &&
    typeof member.email === "string" &&
    ["tenant_admin", "cashier", "warehouse_manager", "accountant", "custom"].includes(member.role) &&
    typeof member.roleName === "string" &&
    Array.isArray(member.permissions) &&
    member.permissions.every((permission) => OFFLINE_TEAM_PERMISSIONS.includes(permission)) &&
    typeof member.active === "boolean" &&
    ((member.pinSalt === null && member.pinHash === null && member.pinIterations === null) ||
       (typeof member.pinSalt === "string" && /^[a-f0-9]{32}$/i.test(member.pinSalt) &&
         typeof member.pinHash === "string" && /^[a-f0-9]{64}$/i.test(member.pinHash) &&
         typeof member.pinIterations === "number" && Number.isInteger(member.pinIterations) &&
         member.pinIterations >= 100_000 && member.pinIterations <= 1_000_000)) &&
    isDate(member.createdAt),
  );
  const auditIsValid = state.auditLogs.every((entry) =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.actorName === "string" &&
    typeof entry.action === "string" &&
    typeof entry.entityType === "string" &&
    typeof entry.entityId === "string" &&
    typeof entry.details === "string" &&
    isDate(entry.createdAt),
  );

  return (
    (!state.setupComplete || Boolean(state.store)) &&
    backupIsValid &&
    productsAreValid &&
    salesAreValid &&
    heldSalesAreValid &&
    returnsAreValid &&
    exchangesAreValid &&
    teamIsValid &&
    auditIsValid
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function migrateOfflineState(value: unknown): OfflineState | null {
  if (!isRecord(value) || ![1, 2, 3].includes(value.schemaVersion)) return null;
  const defaults = createEmptyOfflineState();
  const store = value.store && isRecord(value.store)
    ? { ...value.store, invoiceFormat: value.store.invoiceFormat ?? "wide" }
    : value.store;
  const products = Array.isArray(value.products)
    ? value.products.map((product) => isRecord(product) ? {
      ...product,
      price: product.price ?? null,
      color: product.color ?? "",
      size: product.size ?? "",
      partNumber: product.partNumber ?? "",
      expiresAt: product.expiresAt ?? null,
    } : product)
    : value.products;
  const sales = Array.isArray(value.sales)
    ? value.sales.map((sale) => isRecord(sale) ? {
      ...sale,
      customerPhone: sale.customerPhone ?? "",
      transferSender: sale.transferSender ?? "",
      discountAmount: sale.discountAmount ?? 0,
      amountReceived: sale.amountReceived ?? sale.total ?? 0,
      changeAmount: sale.changeAmount ?? 0,
      cashierName: sale.cashierName ?? "صاحب المتجر",
      exchangeOfInvoiceNumber: sale.exchangeOfInvoiceNumber ?? null,
      items: Array.isArray(sale.items) ? sale.items.map((item) => isRecord(item) ? {
        ...item,
        unitCost: item.unitCost ?? 0,
        returnedQuantity: item.returnedQuantity ?? 0,
      } : item) : sale.items,
    } : sale)
    : value.sales;
  const normalized = {
    ...defaults,
    ...value,
    schemaVersion: 3,
    store,
    license: isOfflineLicense(value.license) ? value.license : null,
    products,
    sales,
    heldSales: value.heldSales ?? defaults.heldSales,
    returns: value.returns ?? defaults.returns,
    exchanges: value.exchanges ?? defaults.exchanges,
    teamMembers: Array.isArray(value.teamMembers)
      ? value.teamMembers.map((member) => isRecord(member) ? {
        ...member,
        pinSalt: member.pinSalt ?? null,
        pinHash: member.pinHash ?? null,
        pinIterations: member.pinIterations ?? null,
      } : member)
      : defaults.teamMembers,
    auditLogs: value.auditLogs ?? defaults.auditLogs,
    backup: { ...defaults.backup, ...(isRecord(value.backup) ? value.backup : {}) },
  };
  return isOfflineState(normalized) ? normalized : null;
}

export function isOfflineLicense(value: unknown): value is OfflineLicense {
  if (!isRecord(value) || !isRecord(value.payload)) return false;
  const payload = value.payload;
  const validPlan = OFFLINE_LICENSE_PLANS.includes(payload.plan as OfflineLicensePlan);
  const validExpiry = payload.plan === "lifetime"
    ? payload.expiresAt === null
    : typeof payload.expiresAt === "string" && Number.isFinite(Date.parse(`${payload.expiresAt}T12:00:00`));
  return (
    payload.version === 1 &&
    typeof payload.licenseId === "string" && payload.licenseId.length >= 16 &&
    typeof payload.installationId === "string" && payload.installationId.length >= 16 &&
    typeof payload.storeName === "string" && payload.storeName.length <= 160 &&
    validPlan &&
    typeof payload.issuedAt === "string" && Number.isFinite(Date.parse(payload.issuedAt)) &&
    validExpiry &&
    typeof value.signature === "string" &&
    /^[A-Za-z0-9+/]{86}==$/.test(value.signature)
  );
}
