import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  createHash,
  createPrivateKey,
  randomUUID,
  sign as signBytes,
  timingSafeEqual,
} from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import {
  CreateInitialPlatformOwnerBody,
  CreateInitialPlatformOwnerResponse,
  AddXStoreTeamMemberBody,
  AddXStoreTeamMemberResponse,
  CheckoutXStoreSaleBody,
  CheckoutXStoreSaleResponse,
  CreateXStoreExchangeBody,
  CreateXStoreExchangeResponse,
  CreateXStoreProductBody,
  CreateXStoreProductResponse,
  CreateXStoreReturnBody,
  CreateXStoreReturnResponse,
  CreateXStoreReturnBatchBody,
  CreateXStoreReturnBatchResponse,
  CreateXStoreSubscriptionPaymentBody,
  CreateXStoreSubscriptionPaymentResponse,
  IssueXStoreOfflineLicenseBody,
  IssueXStoreOfflineLicenseResponse,
  CreateXStoreTenantBody,
  CreateXStoreTenantResponse,
  DeleteXStoreTeamMemberParams,
  GetXStoreAuthStatusResponse,
  GetXStoreContactSettingsResponse,
  GetXStoreDashboardResponse,
  GetXStoreProfitLossReportQueryParams,
  GetXStoreProfitLossReportResponse,
  GetXStoreSessionResponse,
  LoginXStoreWithPhoneBody,
  LoginXStoreWithPhoneResponse,
  LogoutXStoreResponse,
  HoldXStoreSaleBody,
  HoldXStoreSaleResponse,
  ListXStoreAuditLogsResponse,
  ListXStoreHeldSalesResponse,
  ListXStoreProductsQueryParams,
  ListXStoreProductsResponse,
  ListXStoreSalesQueryParams,
  ListXStoreSalesResponse,
  GetXStoreSaleInvoiceItemsParams,
  GetXStoreSaleInvoiceItemsResponse,
  ListXStoreSubscriptionPaymentsResponse,
  ListXStoreTeamResponse,
  ListXStoreTenantsQueryParams,
  ListXStoreTenantsResponse,
  ReleaseXStoreHeldSaleParams,
  UpdateXStoreProductBody,
  UpdateXStoreProductParams,
  UpdateXStoreProductResponse,
  UpdateXStoreTenantBody,
  UpdateXStoreTenantParams,
  UpdateXStoreTenantResponse,
  UpdateXStoreTenantCredentialsBody,
  UpdateXStoreTenantCredentialsParams,
  UpdateXStoreTenantCredentialsResponse,
  UpdateXStoreContactSettingsBody,
  UpdateXStoreContactSettingsResponse,
  UpdateXStoreStoreSettingsBody,
  UpdateXStoreStoreSettingsResponse,
  UpdateXStoreTeamMemberBody,
  UpdateXStoreTeamMemberParams,
  UpdateXStoreTeamMemberResponse,
} from "@workspace/api-zod";
import {
  db,
  xstoreAuditLogs,
  xstoreCustomers,
  xstorePoultryInvoices,
  xstorePoultryInvoiceItems,
  xstorePoultryPayments,
  xstoreHeldSales,
  xstoreProducts,
  xstoreMenus,
  xstoreMenuItems,
  xstorePlatformSettings,
  xstoreReturns,
  xstoreSaleItems,
  xstoreSales,
  xstoreSubscriptionPayments,
  xstoreTeamMembers,
  xstoreTenants,
  xstoreUsers,
  type XStoreLine,
  type XStoreProduct,
  type XStoreSocialLinks,
  type XStoreTenant,
  type XStoreTeamPermission,
  type XStoreUser,
} from "@workspace/db";
import {
  canAccessPointOfSale,
  canSellSaleType,
  getAllowedSaleTypes,
  getXStoreUser,
  hasRole,
  requireXStoreUser,
  ensureXStoreTenantAccess,
} from "../middlewares/xstoreAuth";
import {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  normalizePhone,
  readSessionToken,
  setSessionCookie,
  verifyPassword,
} from "../lib/xstore-session";

const router: IRouter = Router();
const platformAdmin = ["platform_admin"] as const;
const tenantManagers = ["tenant_admin"] as const;
const inventoryEditors = ["platform_admin", "tenant_admin", "warehouse_manager"] as const;
const reportRoles = ["platform_admin", "tenant_admin", "accountant"] as const;
const saleHistoryRoles = [
  "platform_admin",
  "tenant_admin",
  "cashier",
  "accountant",
] as const;
const loginAttempts = new Map<string, { count: number; resetsAt: number }>();
const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const xstoreSaleSelectionWithoutTableNumber = {
  id: xstoreSales.id,
  tenantId: xstoreSales.tenantId,
  cashierUserId: xstoreSales.cashierUserId,
  invoiceNo: xstoreSales.invoiceNo,
  saleType: xstoreSales.saleType,
  customerName: xstoreSales.customerName,
  customerPhone: xstoreSales.customerPhone,
  itemCount: xstoreSales.itemCount,
  subtotal: xstoreSales.subtotal,
  discountAmount: xstoreSales.discountAmount,
  taxAmount: xstoreSales.taxAmount,
  total: xstoreSales.total,
  paymentMethod: xstoreSales.paymentMethod,
  transferSender: xstoreSales.transferSender,
  amountReceived: xstoreSales.amountReceived,
  changeAmount: xstoreSales.changeAmount,
  status: xstoreSales.status,
  createdAt: xstoreSales.createdAt,
  tableNumber: sql<string | null>`NULL`.as("table_number"),
  orderType: sql<"internal" | "external" | null>`NULL`.as("order_type"),
};

class DomainError extends Error {
  constructor(
    message: string,
    readonly statusCode = 409,
  ) {
    super(message);
  }
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const toNumber = (value: string | number | null | undefined) =>
  Number(value ?? 0);
const wholesaleStoreTypes = new Set([
  "clothing_shoes",
  "grocery_supermarket",
  "electronics_accessories",
  "perfume_beauty",
]);
function isWholesaleStoreType(storeType: string | null | undefined): boolean {
  return Boolean(storeType && wholesaleStoreTypes.has(storeType));
}
function tenantAllowsWholesale(
  tenant:
    | { storeType: string | null; wholesaleEnabled: boolean }
    | null
    | undefined,
): boolean {
  return Boolean(
    tenant?.wholesaleEnabled && isWholesaleStoreType(tenant.storeType),
  );
}
const iso = (value: Date) => value.toISOString();
const dbDate = (value: Date | string | null | undefined) =>
  value === undefined || value === null
    ? value
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value;

function tenantDto(tenant: XStoreTenant) {
  return {
    ...tenant,
    subscriptionEndsAt: tenant.subscriptionEndsAt ?? null,
    createdAt: iso(tenant.createdAt),
  };
}

async function sessionUserDto(user: typeof xstoreUsers.$inferSelect) {
  const [tenant] = user.tenantId
    ? await db
        .select({
          name: xstoreTenants.name,
          storeType: xstoreTenants.storeType,
          countryCode: xstoreTenants.countryCode,
          currency: xstoreTenants.currency,
          vatRate: xstoreTenants.vatRate,
          invoiceFormat: xstoreTenants.invoiceFormat,
          wholesaleEnabled: xstoreTenants.wholesaleEnabled,
        })
        .from(xstoreTenants)
        .where(eq(xstoreTenants.id, user.tenantId))
        .limit(1)
    : [];
  return {
    id: user.id,
    name: user.name,
    phone: user.phone ?? "",
    email: user.email,
    role: user.role,
    roleName: user.roleName ?? null,
    permissions: user.permissions ?? [],
    tenantId: user.tenantId,
    tenantName: tenant?.name ?? null,
    storeType: tenant?.storeType ?? null,
    countryCode: tenant?.countryCode ?? null,
    currency: tenant?.currency ?? null,
    vatRate: tenant ? toNumber(tenant.vatRate) : null,
    invoiceFormat: tenant?.invoiceFormat ?? null,
    wholesaleEnabled: tenantAllowsWholesale(tenant),
  };
}

async function getTenantVatRate(tenantId: string): Promise<number | null> {
  const [tenant] = await db
    .select({ vatRate: xstoreTenants.vatRate })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, tenantId))
    .limit(1);
  return tenant ? toNumber(tenant.vatRate) : null;
}

function legacyWhatsappNumber(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    let phone: string | null = null;
    if (url.hostname === "wa.me" || url.hostname === "www.wa.me") {
      phone = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      url.hostname === "api.whatsapp.com" ||
      url.hostname === "web.whatsapp.com" ||
      url.hostname === "whatsapp.com"
    ) {
      phone = url.searchParams.get("phone");
    }
    const digits = phone?.replace(/\D/g, "") ?? "";
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  } catch {
    return null;
  }
}

async function contactSettingsDto() {
  const [settings] = await db
    .select()
    .from(xstorePlatformSettings)
    .where(eq(xstorePlatformSettings.id, "global"))
    .limit(1);
  return {
    supportPhone: settings?.supportPhone ?? null,
    supportWhatsapp:
      settings?.supportWhatsapp?.trim() ||
      legacyWhatsappNumber(
        (settings?.socialLinks as (XStoreSocialLinks & { whatsapp?: string | null }) | undefined)
          ?.whatsapp,
      ),
    supportEmail: settings?.supportEmail ?? null,
    socialLinks: {
      facebook: settings?.socialLinks?.facebook ?? null,
      instagram: settings?.socialLinks?.instagram ?? null,
      tiktok: settings?.socialLinks?.tiktok ?? null,
      snapchat: settings?.socialLinks?.snapchat ?? null,
      x: settings?.socialLinks?.x ?? null,
      youtube: settings?.socialLinks?.youtube ?? null,
      linkedin: settings?.socialLinks?.linkedin ?? null,
      telegram: settings?.socialLinks?.telegram ?? null,
      threads: settings?.socialLinks?.threads ?? null,
      pinterest: settings?.socialLinks?.pinterest ?? null,
    },
  };
}

const socialLinkLabels: Record<keyof XStoreSocialLinks, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  x: "X",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  threads: "Threads",
  pinterest: "Pinterest",
};

function normalizeSocialLinks(links: XStoreSocialLinks): XStoreSocialLinks {
  const normalized = { ...links };
  for (const key of Object.keys(normalized) as (keyof XStoreSocialLinks)[]) {
    const value = normalized[key]?.trim() || null;
    if (!value) {
      normalized[key] = null;
      continue;
    }

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`أدخل رابطاً صالحاً لمنصة ${socialLinkLabels[key]}.`);
    }
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error(`يجب أن يبدأ رابط ${socialLinkLabels[key]} بـ http:// أو https://.`);
    }
    normalized[key] = url.toString();
  }
  return normalized;
}

function rateLimitLogin(req: Request, phone: string) {
  const now = Date.now();
  if (loginAttempts.size > 5_000) {
    for (const [key, bucket] of loginAttempts) {
      if (bucket.resetsAt <= now) loginAttempts.delete(key);
    }
  }
  const keys = [
    `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`,
    `phone:${phone}`,
  ];
  const blocked = keys.some((key) => {
    const bucket = loginAttempts.get(key);
    return !!bucket && bucket.resetsAt > now && bucket.count >= LOGIN_ATTEMPT_LIMIT;
  });
  if (blocked) return true;
  for (const key of keys) {
    const bucket = loginAttempts.get(key);
    if (!bucket || bucket.resetsAt <= now) {
      loginAttempts.set(key, {
        count: 1,
        resetsAt: now + LOGIN_ATTEMPT_WINDOW_MS,
      });
    } else {
      bucket.count += 1;
    }
  }
  return false;
}

function hasValidBootstrapSecret(candidate: string): boolean {
  const configured = process.env.XSTORE_BOOTSTRAP_SECRET;
  if (!configured || configured.length < 32) return false;
  const providedBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(configured);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

function clearLoginLimit(req: Request, phone: string) {
  loginAttempts.delete(`ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`);
  loginAttempts.delete(`phone:${phone}`);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function isMissingDatabaseRelation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

type XStoreSaleLineItemDto = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  returnedQuantity: number;
};

function saleDto(
  sale: typeof xstoreSales.$inferSelect,
  user: XStoreUser,
  grossProfit: number | null = null,
  cashierName = "—",
  exchangeEvents: XStoreExchangeEvent[] = [],
  items?: XStoreSaleLineItemDto[],
  tenantName?: string | null,
) {
  return {
    ...sale,
    cashierName,
    exchangeEvents,
    ...(items === undefined ? {} : { items }),
    ...(tenantName === undefined ? {} : { tenantName }),
    subtotal: toNumber(sale.subtotal),
    discountAmount: toNumber(sale.discountAmount),
    taxAmount: toNumber(sale.taxAmount),
    total: toNumber(sale.total),
    grossProfit: hasRole(user, ["platform_admin", "tenant_admin", "accountant"])
      ? grossProfit
      : null,
    amountReceived: toNumber(sale.amountReceived),
    changeAmount: toNumber(sale.changeAmount),
    createdAt: iso(sale.createdAt),
  };
}

type XStoreExchangeEvent = {
  originalInvoiceNo: string;
  exchangeInvoiceNo: string;
  returnedItems: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
  }>;
  replacementItems: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
  }>;
  refundAmount: number | null;
  replacementTotal: number | null;
  balanceDue: number | null;
  performedBy: string;
  createdAt: string;
  detailsAvailable: boolean;
};

function exchangeEventFromAudit(log: {
  entityId: string | null;
  details: string;
  actorName: string;
  createdAt: Date;
}): XStoreExchangeEvent | null {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(log.details);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    // Older exchange records used a human-readable details string.
  }

  const legacyOriginalInvoice = log.details.match(/^Exchange for (.+)$/)?.[1];
  const originalInvoiceNo =
    typeof payload.originalInvoiceNo === "string"
      ? payload.originalInvoiceNo
      : legacyOriginalInvoice;
  if (!originalInvoiceNo || !log.entityId) return null;

  const toItems = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is XStoreExchangeEvent["returnedItems"][number] => {
      if (typeof item !== "object" || item === null) return false;
      const line = item as Record<string, unknown>;
      return typeof line.productId === "string"
        && typeof line.name === "string"
        && typeof line.sku === "string"
        && typeof line.quantity === "number";
    });
  };
  const returnedItems = toItems(payload.returnedItems);
  const replacementItems = toItems(payload.replacementItems);
  const detailsAvailable = returnedItems.length > 0 && replacementItems.length > 0;

  return {
    originalInvoiceNo,
    exchangeInvoiceNo: log.entityId,
    returnedItems,
    replacementItems,
    refundAmount:
      typeof payload.refundAmount === "number" ? payload.refundAmount : null,
    replacementTotal:
      typeof payload.replacementTotal === "number"
        ? payload.replacementTotal
        : null,
    balanceDue:
      typeof payload.balanceDue === "number" ? payload.balanceDue : null,
    performedBy: log.actorName,
    createdAt: iso(log.createdAt),
    detailsAvailable,
  };
}

function productDto(product: XStoreProduct, user: XStoreUser) {
  const canViewSellingPrices = hasRole(user, [
    "platform_admin",
    "tenant_admin",
    "cashier",
    "warehouse_manager",
    "accountant",
  ]);
  const canViewRetailPrice =
    canViewSellingPrices || canSellSaleType(user, "retail");
  const canViewWholesalePrice =
    canViewSellingPrices || canSellSaleType(user, "wholesale");
  return {
    ...product,
    price: canViewRetailPrice
      ? product.price === null
        ? null
        : toNumber(product.price)
      : 0,
    wholesalePrice: canViewWholesalePrice
      ? product.wholesalePrice === null
        ? null
        : toNumber(product.wholesalePrice)
      : null,
    costPrice: hasRole(user, [
      "platform_admin",
      "tenant_admin",
      "warehouse_manager",
      "accountant",
    ])
      ? toNumber(product.costPrice)
      : null,
    barcode: product.barcode ?? null,
    color: product.color ?? null,
    size: product.size ?? null,
    partNumber: product.partNumber ?? null,
    ingredients: product.partNumber ?? null,
    expiresAt: product.expiresAt ?? null,
  };
}

function planEndDate(plan: string, from: Date): string | null {
  if (plan === "lifetime") return null;
  const date = new Date(from);
  if (plan === "half_yearly") date.setMonth(date.getMonth() + 6);
  else if (plan === "annual") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function offlineLicenseEndDate(
  plan: "monthly" | "half_yearly" | "annual" | "lifetime",
  from: Date,
): string | null {
  if (plan === "lifetime") return null;
  const months = plan === "half_yearly" ? 6 : plan === "annual" ? 12 : 1;
  const targetMonth = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  targetMonth.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return targetMonth.toISOString().slice(0, 10);
}

function mergedLines(lines: XStoreLine[]) {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(
      line.productId,
      (quantities.get(line.productId) ?? 0) + line.quantity,
    );
  }
  return Array.from(quantities, ([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function invoiceNumber() {
  return `XS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 7).toUpperCase()}`;
}

async function audit(
  actor: ReturnType<typeof getXStoreUser>,
  action: string,
  tenantId: string | null,
  entityType: string,
  entityId: string | null,
  details: string,
) {
  await db.insert(xstoreAuditLogs).values({
    actorUserId: actor.id,
    actorName: actor.name,
    action,
    tenantId,
    entityType,
    entityId,
    details,
  });
}

function tenantIdFor(user: ReturnType<typeof getXStoreUser>, requested?: string) {
  if (user.role === "platform_admin") return requested;
  return user.tenantId ?? undefined;
}

function requireTenant(
  res: Parameters<typeof getXStoreUser>[0],
  user: ReturnType<typeof getXStoreUser>,
): string | null {
  if (user.tenantId) return user.tenantId;
  res.status(400).json({ error: "Select a store before using this action." });
  return null;
}

router.get("/xstore/auth/status", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const [platformAdmin] = await db
      .select({ id: xstoreUsers.id, passwordHash: xstoreUsers.passwordHash })
      .from(xstoreUsers)
      .where(eq(xstoreUsers.role, "platform_admin"))
      .limit(1);
    res.json(
      GetXStoreAuthStatusResponse.parse({
        bootstrapRequired: !!platformAdmin && !platformAdmin.passwordHash,
        founderSetupRequired: !platformAdmin,
        ...(await contactSettingsDto()),
      }),
    );
  } catch (error) {
    if (isMissingDatabaseRelation(error)) {
      res.status(503).json({
        error:
          "قاعدة بيانات هذه النسخة لم تُجهّز بعد. شغّل pnpm xstore:setup في Shell، ثم أعد تحميل الصفحة.",
      });
      return;
    }
    throw error;
  }
});

router.post("/xstore/auth/login", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = LoginXStoreWithPhoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid phone number and password." });
    return;
  }
  let phone: string;
  try {
    phone = normalizePhone(parsed.data.phone);
  } catch {
    res.status(400).json({ error: "Enter a valid phone number." });
    return;
  }
  if (rateLimitLogin(req, phone)) {
    res.status(429).json({
      error: "Too many sign-in attempts. Wait a few minutes and try again.",
    });
    return;
  }

  const [user] = await db
    .select()
    .from(xstoreUsers)
    .where(eq(xstoreUsers.phone, phone))
    .limit(1);
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    user?.passwordHash,
  );
  if (!user || !user.isActive || !user.passwordHash || !passwordMatches) {
    res.status(401).json({ error: "Phone number or password is incorrect." });
    return;
  }
  if (!(await ensureXStoreTenantAccess(user, req, res))) return;

  clearLoginLimit(req, phone);
  setSessionCookie(res, createSessionToken(user.id, user.sessionVersion));
  res.json(
    LoginXStoreWithPhoneResponse.parse(await sessionUserDto(user)),
  );
});

router.post("/xstore/auth/logout", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const session = readSessionToken(req);
  if (session) {
    await db
      .update(xstoreUsers)
      .set({ sessionVersion: sql`${xstoreUsers.sessionVersion} + 1` })
      .where(eq(xstoreUsers.id, session.userId));
  }
  clearSessionCookie(res);
  res.status(204).end();
});

router.post("/xstore/auth/founder", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = CreateInitialPlatformOwnerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  if (name.length < 2) {
    res.status(400).json({ error: "Enter the founder's name." });
    return;
  }

  let phone: string;
  try {
    phone = normalizePhone(parsed.data.phone);
  } catch {
    res.status(400).json({ error: "Enter a valid phone number." });
    return;
  }
  if (rateLimitLogin(req, phone)) {
    res.status(429).json({
      error: "Too many setup attempts. Wait a few minutes and try again.",
    });
    return;
  }
  if (!hasValidBootstrapSecret(parsed.data.setupSecret)) {
    const configured = process.env.XSTORE_BOOTSTRAP_SECRET;
    res.status(configured && configured.length >= 32 ? 403 : 503).json({
      error:
        configured && configured.length >= 32
          ? "رمز التأسيس غير صحيح."
          : "إعداد حساب المالك غير متاح حاليًا. يلزم إعداد رمز تأسيس قوي في أسرار المشروع.",
    });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  let result:
    | { kind: "configured" }
    | { kind: "phone_taken" }
    | { kind: "success"; user: typeof xstoreUsers.$inferSelect; recovered: boolean };
  try {
    result = await db.transaction(async (tx) => {
      // Only one first-run request can claim the platform owner role.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('xstore-owner-bootstrap'))`,
      );
      const [existingAdmin] = await tx
        .select()
        .from(xstoreUsers)
        .where(eq(xstoreUsers.role, "platform_admin"))
        .limit(1);
      if (existingAdmin?.passwordHash) return { kind: "configured" as const };

      const [phoneOwner] = await tx
        .select({ id: xstoreUsers.id })
        .from(xstoreUsers)
        .where(eq(xstoreUsers.phone, phone))
        .limit(1);
      if (phoneOwner && phoneOwner.id !== existingAdmin?.id) {
        return { kind: "phone_taken" as const };
      }

      if (existingAdmin) {
        const [updated] = await tx
          .update(xstoreUsers)
          .set({
            name,
            phone,
            passwordHash,
            clerkUserId: null,
            sessionVersion: existingAdmin.sessionVersion + 1,
            isActive: true,
          })
          .where(
            and(
              eq(xstoreUsers.id, existingAdmin.id),
              eq(xstoreUsers.role, "platform_admin"),
              isNull(xstoreUsers.passwordHash),
            ),
          )
          .returning();
        return updated
          ? { kind: "success" as const, user: updated, recovered: true }
          : { kind: "configured" as const };
      }

      const [user] = await tx
        .insert(xstoreUsers)
        .values({
          name,
          phone,
          passwordHash,
          role: "platform_admin",
          email: null,
          tenantId: null,
        })
        .returning();
      return user
        ? { kind: "success" as const, user, recovered: false }
        : { kind: "configured" as const };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "This phone number already belongs to an account." });
      return;
    }
    throw error;
  }

  if (result.kind === "configured") {
    res.status(409).json({ error: "The platform owner account is already set up." });
    return;
  }
  if (result.kind === "phone_taken") {
    res.status(409).json({ error: "This phone number already belongs to an account." });
    return;
  }

  clearLoginLimit(req, phone);
  try {
    await audit(
      result.user,
      result.recovered
        ? "auth.platform_owner_credentials_set"
        : "auth.platform_owner_created",
      null,
      "user",
      result.user.id,
      result.recovered
        ? "The existing platform owner set phone-and-password sign-in."
        : "The initial platform owner completed one-time account setup.",
    );
  } catch (error) {
    req.log.error(
      { error, userId: result.user.id },
      "Unable to record the initial platform owner audit event",
    );
  }
  setSessionCookie(
    res,
    createSessionToken(result.user.id, result.user.sessionVersion),
  );
  res.json(
    CreateInitialPlatformOwnerResponse.parse(
      await sessionUserDto(result.user),
    ),
  );
});

router.get("/xstore/public/menu/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) {
    res.status(404).json({ error: "Menu not found." });
    return;
  }
  const [menu] = await db
    .select()
    .from(xstoreMenus)
    .where(and(eq(xstoreMenus.publicSlug, slug), eq(xstoreMenus.isPublished, true)))
    .limit(1);
  if (!menu) {
    res.status(404).json({ error: "Menu not found." });
    return;
  }
  const [tenant] = await db
    .select({
      id: xstoreTenants.id,
      name: xstoreTenants.name,
      storeType: xstoreTenants.storeType,
      currency: xstoreTenants.currency,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, menu.tenantId))
    .limit(1);
  if (tenant?.storeType !== "cafe" && tenant?.storeType !== "restaurant") {
    res.status(404).json({ error: "Menu not found." });
    return;
  }
  const rows = await db
    .select({
      id: xstoreMenuItems.id,
      productId: xstoreProducts.id,
      name: xstoreProducts.name,
      category: xstoreProducts.category,
      ingredients: xstoreProducts.partNumber,
      price: xstoreProducts.price,
      quantity: xstoreProducts.quantity,
      description: xstoreMenuItems.description,
      imageUrl: xstoreMenuItems.imageUrl,
      displayOrder: xstoreMenuItems.displayOrder,
      isAvailable: xstoreMenuItems.isAvailable,
    })
    .from(xstoreMenuItems)
    .innerJoin(xstoreProducts, eq(xstoreMenuItems.productId, xstoreProducts.id))
    .where(eq(xstoreMenuItems.menuId, menu.id))
    .orderBy(xstoreMenuItems.displayOrder, xstoreProducts.category, xstoreProducts.name);

  const categories = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const category = row.category || "أصناف";
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category)!.push({
      id: row.productId,
      name: row.name,
      price: toNumber(row.price),
      ingredients: row.ingredients ?? null,
      description: row.description ?? null,
      imageUrl: row.imageUrl ?? null,
      available: row.isAvailable && row.quantity > 0,
    });
  }

  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({
    menu: {
      title: menu.title,
      description: menu.description ?? null,
      slug: menu.publicSlug,
    },
    store: {
      name: tenant?.name ?? "X-Store",
      storeType: tenant?.storeType ?? null,
      currency: tenant?.currency ?? "EGP",
    },
    categories: Array.from(categories, ([name, items]) => ({ name, items })),
  });
});

router.use("/xstore", requireXStoreUser);

router.get("/xstore/restaurant-feature", async (_req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!actor.tenantId) {
    res.json({ enabled: false });
    return;
  }
  const [tenant] = await db
    .select({ storeType: xstoreTenants.storeType })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, actor.tenantId))
    .limit(1);
  res.json({
    enabled: tenant?.storeType === "cafe" || tenant?.storeType === "restaurant",
  });
});

router.get("/xstore/menu", async (_req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "tenant_admin") {
    res.status(403).json({ error: "Only the store owner can manage the menu." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const [tenant] = await db
    .select({
      name: xstoreTenants.name,
      storeType: xstoreTenants.storeType,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, tenantId))
    .limit(1);
  if (tenant?.storeType !== "cafe" && tenant?.storeType !== "restaurant") {
    res.status(403).json({ error: "Restaurant menu is available only for cafes and restaurants." });
    return;
  }
  let [menu] = await db.select().from(xstoreMenus).where(eq(xstoreMenus.tenantId, tenantId)).limit(1);
  if (!menu) {
    [menu] = await db.insert(xstoreMenus).values({
      tenantId,
      publicSlug: randomUUID().replaceAll("-", ""),
      title: tenant?.name?.trim() || "منيو المتجر",
      isPublished: true,
    }).returning();
  } else if ((!menu.title?.trim() || menu.title === "منيو المتجر") && tenant?.name?.trim()) {
    [menu] = await db.update(xstoreMenus)
      .set({ title: tenant.name.trim(), updatedAt: new Date() })
      .where(eq(xstoreMenus.id, menu.id))
      .returning();
  }
  const products = await db
    .select({
      id: xstoreProducts.id,
      name: xstoreProducts.name,
      category: xstoreProducts.category,
      price: xstoreProducts.price,
      quantity: xstoreProducts.quantity,
      barcode: xstoreProducts.barcode,
      sku: xstoreProducts.sku,
      menuItemId: xstoreMenuItems.id,
      description: xstoreMenuItems.description,
      imageUrl: xstoreMenuItems.imageUrl,
      displayOrder: xstoreMenuItems.displayOrder,
      isAvailable: xstoreMenuItems.isAvailable,
    })
    .from(xstoreProducts)
    .leftJoin(
      xstoreMenuItems,
      and(
        eq(xstoreMenuItems.productId, xstoreProducts.id),
        eq(xstoreMenuItems.menuId, menu.id),
      ),
    )
    .where(eq(xstoreProducts.tenantId, tenantId))
    .orderBy(xstoreProducts.category, xstoreProducts.name);

  res.json({
    menu: {
      id: menu.id,
      title: menu.title,
      description: menu.description,
      isPublished: menu.isPublished,
      publicSlug: menu.publicSlug,
    },
    products: products.map((product) => ({
      ...product,
      price: product.price === null ? null : toNumber(product.price),
      selected: Boolean(product.menuItemId),
    })),
  });
});

router.put("/xstore/menu", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "tenant_admin") {
    res.status(403).json({ error: "Only the store owner can manage the menu." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const [tenant] = await db
    .select({
      name: xstoreTenants.name,
      storeType: xstoreTenants.storeType,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, tenantId))
    .limit(1);
  if (tenant?.storeType !== "cafe" && tenant?.storeType !== "restaurant") {
    res.status(403).json({ error: "Restaurant menu is available only for cafes and restaurants." });
    return;
  }
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim().slice(0, 120)
    : tenant?.name?.trim() || "منيو المتجر";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
  const isPublished = body.isPublished !== false;
  const selectedProductIds = Array.isArray(body.productIds)
    ? Array.from(new Set(body.productIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)))
    : [];

  const products = selectedProductIds.length
    ? await db.select({ id: xstoreProducts.id }).from(xstoreProducts).where(and(eq(xstoreProducts.tenantId, tenantId), inArray(xstoreProducts.id, selectedProductIds)))
    : [];
  const validProductIds = products.map((product) => product.id);

  const [menu] = await db
    .insert(xstoreMenus)
    .values({
      tenantId,
      publicSlug: randomUUID().replaceAll("-", ""),
      title,
      description,
      isPublished,
    })
    .onConflictDoUpdate({
      target: xstoreMenus.tenantId,
      set: { title, description, isPublished, updatedAt: new Date() },
    })
    .returning();

  await db.transaction(async (tx) => {
    await tx.delete(xstoreMenuItems).where(eq(xstoreMenuItems.menuId, menu.id));
    if (validProductIds.length) {
      await tx.insert(xstoreMenuItems).values(
        validProductIds.map((productId, index) => ({
          menuId: menu.id,
          productId,
          displayOrder: index,
          isAvailable: true,
        })),
      );
    }
  });

  res.json({
    menu: {
      id: menu.id,
      title: menu.title,
      description: menu.description,
      isPublished: menu.isPublished,
      publicSlug: menu.publicSlug,
    },
    selectedProductIds: validProductIds,
  });
});

router.get("/xstore/session", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const user = getXStoreUser(res);
  res.json(
    GetXStoreSessionResponse.parse(await sessionUserDto(user)),
  );
});

router.patch("/xstore/store-settings", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "tenant_admin") {
    res.status(403).json({ error: "Only the store owner can change invoice settings." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const parsed = UpdateXStoreStoreSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tenant] = await db
    .update(xstoreTenants)
    .set({
      vatRate: String(parsed.data.vatRate),
      ...(parsed.data.invoiceFormat
        ? { invoiceFormat: parsed.data.invoiceFormat }
        : {}),
    })
    .where(eq(xstoreTenants.id, tenantId))
    .returning({
      id: xstoreTenants.id,
      vatRate: xstoreTenants.vatRate,
      invoiceFormat: xstoreTenants.invoiceFormat,
    });
  if (!tenant) {
    res.status(404).json({ error: "Store settings not found." });
    return;
  }
  await audit(
    actor,
    "tenant.store_settings_updated",
    tenant.id,
    "tenant",
    tenant.id,
    `Updated VAT rate to ${(toNumber(tenant.vatRate) * 100).toFixed(2)}% and invoice format to ${tenant.invoiceFormat}`,
  );
  res.json(
    UpdateXStoreStoreSettingsResponse.parse({
      vatRate: toNumber(tenant.vatRate),
      invoiceFormat: tenant.invoiceFormat,
    }),
  );
});

router.get("/xstore/settings/contact", async (_req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can manage contact details." });
    return;
  }
  res.json(GetXStoreContactSettingsResponse.parse(await contactSettingsDto()));
});

router.put("/xstore/settings/contact", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can manage contact details." });
    return;
  }
  const parsed = UpdateXStoreContactSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let socialLinks: XStoreSocialLinks;
  try {
    socialLinks = normalizeSocialLinks(parsed.data.socialLinks);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "تحقق من روابط التواصل الاجتماعي.",
    });
    return;
  }
  const update = {
    supportPhone: parsed.data.supportPhone?.trim() || null,
    supportWhatsapp: parsed.data.supportWhatsapp?.trim() || null,
    supportEmail: parsed.data.supportEmail?.trim().toLowerCase() || null,
    socialLinks,
    updatedAt: new Date(),
  };
  const [settings] = await db
    .insert(xstorePlatformSettings)
    .values({ id: "global", ...update })
    .onConflictDoUpdate({
      target: xstorePlatformSettings.id,
      set: update,
    })
    .returning();
  await audit(
    actor,
    "platform.contact_settings_updated",
    null,
    "platform_settings",
    "global",
    "Updated the public support contact details and social media links.",
  );
  res.json(
    UpdateXStoreContactSettingsResponse.parse({
      supportPhone: settings?.supportPhone ?? null,
      supportWhatsapp: settings?.supportWhatsapp ?? null,
      supportEmail: settings?.supportEmail ?? null,
      socialLinks: settings?.socialLinks ?? socialLinks,
    }),
  );
});


const poultryUserRoles = ["tenant_admin", "cashier", "accountant", "collector", "retail_sales", "customer_management"] as const;

router.get("/xstore/poultry/customers", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, poultryUserRoles)) { res.status(403).json({ error: "ليس لديك صلاحية للوصول إلى حسابات العملاء." }); return; }
  const [tenant] = await db.select({ storeType: xstoreTenants.storeType }).from(xstoreTenants).where(eq(xstoreTenants.id, user.tenantId)).limit(1);
  if (tenant?.storeType !== "poultry") { res.status(403).json({ error: "هذه الشاشة متاحة لمتاجر الدواجن فقط." }); return; }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rows = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.tenantId, user.tenantId), search ? or(ilike(xstoreCustomers.name, "%" + search + "%"), ilike(xstoreCustomers.phone, "%" + search + "%"), ilike(xstoreCustomers.shopName, "%" + search + "%")) : undefined)).orderBy(desc(xstoreCustomers.updatedAt)).limit(100);
  const invoices = await db.select().from(xstorePoultryInvoices).where(eq(xstorePoultryInvoices.tenantId, user.tenantId));
  const payments = await db.select().from(xstorePoultryPayments).where(eq(xstorePoultryPayments.tenantId, user.tenantId));
  res.json(rows.map(customer => {
    const sales = invoices.filter(x => x.customerId === customer.id).reduce((s, x) => s + toNumber(x.total), 0);
    const paid = invoices.filter(x => x.customerId === customer.id).reduce((s, x) => s + toNumber(x.amountPaid), 0) + payments.filter(x => x.customerId === customer.id).reduce((s, x) => s + toNumber(x.amount), 0);
    return { ...customer, createdAt: iso(customer.createdAt), updatedAt: iso(customer.updatedAt), totalSales: sales, totalPaid: paid, balance: roundMoney(sales - paid) };
  }));
});

router.post("/xstore/poultry/customers", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin", "cashier", "customer_management"])) { res.status(403).json({ error: "ليس لديك صلاحية إضافة عميل." }); return; }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const shopName = typeof req.body?.shopName === "string" ? req.body.shopName.trim() : "";
  const shopAddress = typeof req.body?.shopAddress === "string" ? req.body.shopAddress.trim() : "";
  if (!name || !phone) { res.status(400).json({ error: "اسم العميل ورقم الهاتف مطلوبان." }); return; }
  const [customer] = await db.insert(xstoreCustomers).values({ tenantId: user.tenantId, name, phone, shopName: shopName || null, shopAddress: shopAddress || null }).returning();
  if (!customer) { res.status(500).json({ error: "تعذر إنشاء العميل." }); return; }
  await audit(user, "poultry.customer_created", customer.id, "poultry_customer", customer.id, "تم إضافة العميل " + name);
  res.status(201).json({ ...customer, createdAt: iso(customer.createdAt), updatedAt: iso(customer.updatedAt) });
});

router.get("/xstore/poultry/customers/:customerId/statement", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, poultryUserRoles)) { res.status(403).json({ error: "ليس لديك صلاحية لعرض كشف الحساب." }); return; }
  const [customer] = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.id, req.params.customerId), eq(xstoreCustomers.tenantId, user.tenantId))).limit(1);
  if (!customer) { res.status(404).json({ error: "العميل غير موجود." }); return; }
  const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from + "T00:00:00+02:00") : new Date("1970-01-01T00:00:00Z");
  const to = typeof req.query.to === "string" && req.query.to ? new Date(req.query.to + "T23:59:59.999+02:00") : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) { res.status(400).json({ error: "الفترة الزمنية غير صحيحة." }); return; }
  const allInvoices = await db.select({ invoice: xstorePoultryInvoices, cashierName: xstoreUsers.name }).from(xstorePoultryInvoices).innerJoin(xstoreUsers, eq(xstorePoultryInvoices.cashierUserId, xstoreUsers.id)).where(eq(xstorePoultryInvoices.customerId, customer.id)).orderBy(xstorePoultryInvoices.createdAt);
  const allPayments = await db.select({ payment: xstorePoultryPayments, cashierName: xstoreUsers.name }).from(xstorePoultryPayments).innerJoin(xstoreUsers, eq(xstorePoultryPayments.cashierUserId, xstoreUsers.id)).where(eq(xstorePoultryPayments.customerId, customer.id)).orderBy(xstorePoultryPayments.createdAt);
  const beforeSales = allInvoices.filter(x => x.invoice.createdAt < from).reduce((s,x)=>s+toNumber(x.invoice.total),0);
  const beforePaid = allInvoices.filter(x => x.invoice.createdAt < from).reduce((s,x)=>s+toNumber(x.invoice.amountPaid),0) + allPayments.filter(x => x.payment.createdAt < from).reduce((s,x)=>s+toNumber(x.payment.amount),0);
  const invoices = allInvoices.filter(x => x.invoice.createdAt >= from && x.invoice.createdAt <= to);
  const payments = allPayments.filter(x => x.payment.createdAt >= from && x.payment.createdAt <= to);
  const invoiceIds = invoices.map(x => x.invoice.id);
  const items = invoiceIds.length ? await db.select().from(xstorePoultryInvoiceItems).where(inArray(xstorePoultryInvoiceItems.invoiceId, invoiceIds)) : [];
  const rows = [
    ...invoices.map(({invoice,cashierName}) => ({ type:"invoice", id:invoice.id, invoiceNo:invoice.invoiceNo, date:iso(invoice.createdAt), actorName:cashierName, total:toNumber(invoice.total), paid:toNumber(invoice.amountPaid), note:null, items:items.filter(item=>item.invoiceId===invoice.id).map(item=>({productName:item.productName,quantityKg:toNumber(item.quantityKg),unitPrice:toNumber(item.unitPrice),total:toNumber(item.total)})) })),
    ...payments.map(({payment,cashierName}) => ({ type:"payment", id:payment.id, invoiceNo:null, date:iso(payment.createdAt), actorName:cashierName, total:0, paid:toNumber(payment.amount), note:payment.note, items:[] })),
  ].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  const periodSales = invoices.reduce((s,x)=>s+toNumber(x.invoice.total),0);
  const periodPaid = invoices.reduce((s,x)=>s+toNumber(x.invoice.amountPaid),0) + payments.reduce((s,x)=>s+toNumber(x.payment.amount),0);
  const totalKg = items.reduce((s,x)=>s+toNumber(x.quantityKg),0);
  res.json({ customer:{...customer,createdAt:iso(customer.createdAt),updatedAt:iso(customer.updatedAt)}, from:req.query.from||null, to:req.query.to||null, openingBalance:roundMoney(beforeSales-beforePaid), summary:{totalKg,sales:periodSales,paid:periodPaid,remaining:roundMoney(beforeSales-beforePaid+periodSales-periodPaid)}, rows });
});

router.post("/xstore/poultry/customers/:customerId/invoices", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin", "cashier", "retail_sales"])) { res.status(403).json({ error: "ليس لديك صلاحية إنشاء فاتورة دواجن." }); return; }
  const [customer] = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.id, req.params.customerId), eq(xstoreCustomers.tenantId, user.tenantId))).limit(1);
  if (!customer) { res.status(404).json({ error: "العميل غير موجود." }); return; }

  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const items = rawItems
    .map((item:any)=>({
      productName:typeof item?.productName==="string"?item.productName.trim():"",
      quantityKg:Number(item?.quantityKg),
      unitPrice:Number(item?.unitPrice),
    }))
    .filter((item:any)=>item.productName && Number.isFinite(item.quantityKg) && item.quantityKg>0 && Number.isFinite(item.unitPrice) && item.unitPrice>=0);

  if (!items.length) {
    res.status(400).json({ error: "أضف صنفًا واحدًا على الأقل بالوزن وسعر الكيلو." });
    return;
  }

  const total = roundMoney(items.reduce((s:number,item:any)=>s+roundMoney(item.quantityKg*item.unitPrice),0));
  const amountReceived = Number(req.body?.amountPaid);
  if (!Number.isFinite(amountReceived) || amountReceived < 0) {
    res.status(400).json({ error: "أدخل المبلغ المدفوع اليوم بشكل صحيح." });
    return;
  }

  const existingInvoices = await db.select({ total: xstorePoultryInvoices.total, amountPaid: xstorePoultryInvoices.amountPaid })
    .from(xstorePoultryInvoices)
    .where(and(eq(xstorePoultryInvoices.customerId, customer.id), eq(xstorePoultryInvoices.tenantId, user.tenantId)));
  const existingPayments = await db.select({ amount: xstorePoultryPayments.amount })
    .from(xstorePoultryPayments)
    .where(and(eq(xstorePoultryPayments.customerId, customer.id), eq(xstorePoultryPayments.tenantId, user.tenantId)));
  const existingBalance = roundMoney(
    existingInvoices.reduce((sum, row) => sum + toNumber(row.total) - toNumber(row.amountPaid), 0)
    - existingPayments.reduce((sum, row) => sum + toNumber(row.amount), 0),
  );
  const maxReceivableToday = roundMoney(total + Math.max(0, existingBalance));
  if (amountReceived > maxReceivableToday) {
    res.status(400).json({
      error: "المبلغ المدفوع اليوم أكبر من إجمالي الفاتورة ورصيد العميل المستحق.",
    });
    return;
  }

  const amountPaid = Math.min(total, amountReceived);
  const extraCollection = roundMoney(Math.max(0, amountReceived - total));
  const invoiceNo = "PD-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + Math.random().toString(36).slice(2,7).toUpperCase();

  const invoice = await db.transaction(async tx => {
    const [created] = await tx.insert(xstorePoultryInvoices).values({
      tenantId:user.tenantId!,
      customerId:customer.id,
      cashierUserId:user.id,
      invoiceNo,
      total:String(total),
      amountPaid:String(amountPaid),
    }).returning();

    if (!created) throw new DomainError("تعذر إنشاء الفاتورة.",500);

    await tx.insert(xstorePoultryInvoiceItems).values(
      items.map((item:any)=>({
        invoiceId:created.id,
        productName:item.productName,
        quantityKg:String(item.quantityKg),
        unitPrice:String(item.unitPrice),
        total:String(roundMoney(item.quantityKg*item.unitPrice)),
      })),
    );

    if (extraCollection > 0) {
      await tx.insert(xstorePoultryPayments).values({
        tenantId:user.tenantId!,
        customerId:customer.id,
        cashierUserId:user.id,
        amount:String(extraCollection),
        note:"تحصيل من الرصيد السابق مع الفاتورة "+invoiceNo,
      });
    }

    return created;
  });

  await audit(
    user,
    "poultry.invoice_created",
    invoice.id,
    "poultry_invoice",
    invoice.id,
    "تم تسجيل فاتورة "+invoiceNo+" للعميل "+customer.name+" بقيمة "+total,
  );

  if (extraCollection > 0) {
    await audit(
      user,
      "poultry.payment_collected",
      invoice.id,
      "poultry_payment",
      invoice.id,
      "تم تحصيل "+extraCollection+" من الرصيد السابق للعميل "+customer.name+" مع الفاتورة "+invoiceNo,
    );
  }

  res.status(201).json({
    id:invoice.id,
    invoiceNo,
    total,
    amountPaid,
    extraCollection,
    amountReceived,
    balance:roundMoney(total-amountPaid),
    createdAt:iso(invoice.createdAt),
    cashierName:user.name,
  });
});
router.post("/xstore/poultry/customers/:customerId/payments", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin", "cashier", "collector"])) { res.status(403).json({ error: "ليس لديك صلاحية تسجيل تحصيل." }); return; }
  const [customer] = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.id,req.params.customerId),eq(xstoreCustomers.tenantId,user.tenantId))).limit(1);
  if (!customer) { res.status(404).json({ error: "العميل غير موجود." }); return; }
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount<=0) { res.status(400).json({ error: "أدخل مبلغ تحصيل صحيح." }); return; }
  const [payment] = await db.insert(xstorePoultryPayments).values({tenantId:user.tenantId,customerId:customer.id,cashierUserId:user.id,amount:String(roundMoney(amount)),note:typeof req.body?.note==="string"?req.body.note.trim()||null:null}).returning();
  if (!payment) { res.status(500).json({ error: "تعذر تسجيل التحصيل." }); return; }
  await audit(user,"poultry.payment_collected",payment.id,"poultry_payment",payment.id,"تم تحصيل "+roundMoney(amount)+" من العميل "+customer.name);
  res.status(201).json({id:payment.id,amount:roundMoney(amount),createdAt:iso(payment.createdAt),collectorName:user.name});
});

router.get("/xstore/poultry/notifications", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user,poultryUserRoles)) { res.status(403).json({error:"غير مصرح."}); return; }
  const [invoices,payments] = await Promise.all([
    db.select({invoice:xstorePoultryInvoices,customerName:xstoreCustomers.name,actorName:xstoreUsers.name}).from(xstorePoultryInvoices).innerJoin(xstoreCustomers,eq(xstorePoultryInvoices.customerId,xstoreCustomers.id)).innerJoin(xstoreUsers,eq(xstorePoultryInvoices.cashierUserId,xstoreUsers.id)).where(eq(xstorePoultryInvoices.tenantId,user.tenantId)).orderBy(desc(xstorePoultryInvoices.createdAt)).limit(20),
    db.select({payment:xstorePoultryPayments,customerName:xstoreCustomers.name,actorName:xstoreUsers.name}).from(xstorePoultryPayments).innerJoin(xstoreCustomers,eq(xstorePoultryPayments.customerId,xstoreCustomers.id)).innerJoin(xstoreUsers,eq(xstorePoultryPayments.cashierUserId,xstoreUsers.id)).where(eq(xstorePoultryPayments.tenantId,user.tenantId)).orderBy(desc(xstorePoultryPayments.createdAt)).limit(20),
  ]);
  res.json([...invoices.map(x=>({id:"poultry-invoice:"+x.invoice.id,title:"تم تسجيل فاتورة دواجن",detail:x.customerName+" · "+toNumber(x.invoice.total)+" جنيه · بواسطة "+x.actorName,createdAt:iso(x.invoice.createdAt),href:"/poultry-customers"})),...payments.map(x=>({id:"poultry-payment:"+x.payment.id,title:"تم تسجيل تحصيل",detail:x.customerName+" · "+toNumber(x.payment.amount)+" جنيه · بواسطة "+x.actorName,createdAt:iso(x.payment.createdAt),href:"/poultry-customers"}))].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,40));
});

router.get("/xstore/dashboard", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  const isPlatformAdmin = user.role === "platform_admin";
  const isFinancial = hasRole(user, reportRoles);
  const hasAllSalesHistory = hasRole(user, saleHistoryRoles);
  const limitedSaleTypes =
    canAccessPointOfSale(user) && !hasAllSalesHistory
      ? getAllowedSaleTypes(user)
      : undefined;
  const tenantWhere = user.tenantId
    ? eq(xstoreTenants.id, user.tenantId)
    : undefined;
  const productWhere = user.tenantId
    ? eq(xstoreProducts.tenantId, user.tenantId)
    : undefined;
  const saleWhere = and(
    user.tenantId ? eq(xstoreSales.tenantId, user.tenantId) : undefined,
    limitedSaleTypes
      ? inArray(xstoreSales.saleType, limitedSaleTypes)
      : undefined,
  );
  const currentDay = new Date();
  currentDay.setHours(0, 0, 0, 0);
  const dayStart = currentDay;
  const dayEnd = new Date(currentDay);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const todayDate = currentDay.toISOString().slice(0, 10);
  const expiryDate = new Date(currentDay);
  expiryDate.setDate(expiryDate.getDate() + 7);
  const expiryEnd = expiryDate.toISOString().slice(0, 10);

  const [tenants, productsAgg, salesAgg, todayAgg, paymentAgg, expiringCount] =
    await Promise.all([
      db.select().from(xstoreTenants).where(tenantWhere),
      db
        .select({
          inventoryValue: sql<number>`coalesce(sum(${xstoreProducts.price} * ${xstoreProducts.quantity}), 0)`,
          lowStockCount: sql<number>`count(*) filter (where ${xstoreProducts.quantity} <= 5)`,
        })
        .from(xstoreProducts)
        .where(productWhere),
      db
        .select({ total: count() })
        .from(xstoreSales)
        .where(saleWhere),
      db
        .select({
          total: count(),
          revenue: sql<number>`coalesce(sum(${xstoreSales.total}), 0)`,
        })
        .from(xstoreSales)
        .where(
          and(
            saleWhere,
            gte(xstoreSales.createdAt, dayStart),
            lt(xstoreSales.createdAt, dayEnd),
          ),
        ),
      isPlatformAdmin
        ? db
            .select({
              revenue: sql<number>`coalesce(sum(${xstoreSubscriptionPayments.amount}), 0)`,
            })
            .from(xstoreSubscriptionPayments)
        : Promise.resolve([{ revenue: 0 }]),
      db
        .select({ total: count() })
        .from(xstoreTenants)
        .where(
          and(
            tenantWhere,
            eq(xstoreTenants.status, "active"),
            gte(xstoreTenants.subscriptionEndsAt, todayDate),
            lte(xstoreTenants.subscriptionEndsAt, expiryEnd),
          ),
        ),
    ]);

  const latestTenants = isPlatformAdmin
    ? await db
        .select()
        .from(xstoreTenants)
        .orderBy(desc(xstoreTenants.createdAt))
        .limit(5)
    : [];
  const latestSales = isFinancial
    ? await db
        .select({
          sale: xstoreSaleSelectionWithoutTableNumber,
          cashierName: xstoreUsers.name,
        })
        .from(xstoreSales)
        .innerJoin(
          xstoreUsers,
          eq(xstoreSales.cashierUserId, xstoreUsers.id),
        )
        .where(saleWhere)
        .orderBy(desc(xstoreSales.createdAt))
        .limit(5)
    : [];
  const latestLogs = isPlatformAdmin
    ? await db
        .select({
          id: xstoreAuditLogs.id,
          actorName: xstoreAuditLogs.actorName,
          action: xstoreAuditLogs.action,
          tenantName: xstoreTenants.name,
          entityType: xstoreAuditLogs.entityType,
          entityId: xstoreAuditLogs.entityId,
          details: xstoreAuditLogs.details,
          createdAt: xstoreAuditLogs.createdAt,
        })
        .from(xstoreAuditLogs)
        .leftJoin(
          xstoreTenants,
          eq(xstoreAuditLogs.tenantId, xstoreTenants.id),
        )
        .orderBy(desc(xstoreAuditLogs.createdAt))
        .limit(5)
    : [];

  const activeTenants = tenants.filter(
    (tenant) =>
      tenant.status === "active" &&
      (tenant.plan === "lifetime" ||
        !tenant.subscriptionEndsAt ||
        tenant.subscriptionEndsAt >= todayDate),
  ).length;
  const dashboard = {
    totalTenants: isPlatformAdmin ? tenants.length : tenants.length,
    activeTenants,
    suspendedTenants: tenants.filter((tenant) => tenant.status === "suspended")
      .length,
    todaySales: Number(todayAgg[0]?.total ?? 0),
    todayRevenue: isFinancial ? toNumber(todayAgg[0]?.revenue) : 0,
    inventoryValue: isFinancial
      ? toNumber(productsAgg[0]?.inventoryValue)
      : 0,
    lowStockCount: Number(productsAgg[0]?.lowStockCount ?? 0),
    subscriptionRevenue: isPlatformAdmin
      ? toNumber(paymentAgg[0]?.revenue)
      : 0,
    activeSubscriptions: activeTenants,
    expiringSubscriptions: Number(expiringCount[0]?.total ?? 0),
    latestTenants: latestTenants.map(tenantDto),
    latestSales: latestSales.map(({ sale, cashierName }) =>
      saleDto(sale, user, null, cashierName),
    ),
    latestAuditLogs: latestLogs.map((log) => ({
      ...log,
      tenantName: log.tenantName ?? null,
      entityId: log.entityId ?? null,
      createdAt: iso(log.createdAt),
    })),
  };
  res.json(GetXStoreDashboardResponse.parse(dashboard));
});

router.get("/xstore/tenants", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (user.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can manage stores." });
    return;
  }
  const parsed = ListXStoreTenantsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, status, businessType } = parsed.data;
  const filters = [
    search
      ? or(
          ilike(xstoreTenants.name, `%${search}%`),
          ilike(xstoreTenants.ownerName, `%${search}%`),
          ilike(xstoreTenants.email, `%${search}%`),
        )
      : undefined,
    status ? eq(xstoreTenants.status, status) : undefined,
    businessType ? eq(xstoreTenants.businessType, businessType) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(xstoreTenants)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(xstoreTenants.createdAt));
  res.json(ListXStoreTenantsResponse.parse(rows.map(tenantDto)));
});

router.post("/xstore/tenants", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can create stores." });
    return;
  }
  const parsed = CreateXStoreTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  if (input.wholesaleEnabled && !isWholesaleStoreType(input.storeType)) {
    res.status(400).json({
      error: "Wholesale sales are not available for cafes or restaurants.",
    });
    return;
  }
  let phone: string;
  try {
    phone = normalizePhone(input.phone);
  } catch {
    res.status(400).json({ error: "Enter a valid owner phone number." });
    return;
  }
  const ownerPasswordHash = await hashPassword(input.ownerPassword);
  const requestedEnd = dbDate(input.subscriptionEndsAt);
  const subscriptionEndsAt =
    requestedEnd === undefined
      ? planEndDate(input.plan, new Date())
      : requestedEnd;
  let tenant: XStoreTenant | undefined;
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${phone}))`);
      const [existingAccount] = await tx
        .select({ id: xstoreUsers.id })
        .from(xstoreUsers)
        .where(eq(xstoreUsers.phone, phone))
        .limit(1);
      if (existingAccount) return { kind: "phone_taken" as const };

      const [createdTenant] = await tx
        .insert(xstoreTenants)
        .values({
          name: input.name,
          ownerName: input.ownerName,
          phone,
          email: input.email?.trim().toLowerCase() || null,
          businessType: input.businessType,
          storeType: input.storeType,
          wholesaleEnabled: input.wholesaleEnabled ?? false,
          countryCode: input.countryCode,
          currency: input.currency,
          status: "trial",
          plan: input.plan,
          subscriptionEndsAt,
          branchCount: 1,
        })
        .returning();
      if (!createdTenant) return { kind: "failed" as const };
      await tx.insert(xstoreUsers).values({
        email: input.email?.trim().toLowerCase() || null,
        phone,
        passwordHash: ownerPasswordHash,
        name: input.ownerName,
        role: "tenant_admin",
        tenantId: createdTenant.id,
      });
      return { kind: "success" as const, tenant: createdTenant };
    });
    if (result.kind === "phone_taken") {
      res.status(409).json({ error: "This phone number already belongs to an account." });
      return;
    }
    if (result.kind === "success") tenant = result.tenant;
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "This phone number already belongs to an account." });
      return;
    }
    throw error;
  }
  if (!tenant) {
    res.status(500).json({ error: "Unable to create this store." });
    return;
  }
  await audit(
    actor,
    "tenant.created",
    tenant.id,
    "tenant",
    tenant.id,
    `Created ${tenant.name}`,
  );
  res.status(201).json(CreateXStoreTenantResponse.parse(tenantDto(tenant)));
});

router.patch("/xstore/tenants/:tenantId", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can manage stores." });
    return;
  }
  const params = UpdateXStoreTenantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateXStoreTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existingTenant] = await db
    .select({
      storeType: xstoreTenants.storeType,
      wholesaleEnabled: xstoreTenants.wholesaleEnabled,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, params.data.tenantId))
    .limit(1);
  if (!existingTenant) {
    res.status(404).json({ error: "Store not found." });
    return;
  }
  const nextStoreType = parsed.data.storeType ?? existingTenant.storeType;
  const nextStoreSupportsWholesale = isWholesaleStoreType(nextStoreType);
  if (parsed.data.wholesaleEnabled === true && !nextStoreSupportsWholesale) {
    res.status(400).json({
      error: "Wholesale sales are not available for cafes or restaurants.",
    });
    return;
  }
  const name = parsed.data.name?.trim();
  const businessType = parsed.data.businessType?.trim();
  if (name === "" || businessType === "") {
    res.status(400).json({ error: "Store name and activity cannot be blank." });
    return;
  }
  const update = {
    ...parsed.data,
    ...(name !== undefined ? { name } : {}),
    ...(businessType !== undefined ? { businessType } : {}),
    subscriptionEndsAt: dbDate(parsed.data.subscriptionEndsAt),
  };
  if (!nextStoreSupportsWholesale) {
    update.wholesaleEnabled = false;
  }
  if (update.plan === "lifetime" && update.subscriptionEndsAt === undefined) {
    update.subscriptionEndsAt = null;
  }
  const [tenant] = await db
    .update(xstoreTenants)
    .set(update)
    .where(eq(xstoreTenants.id, params.data.tenantId))
    .returning();
  if (!tenant) {
    res.status(404).json({ error: "Store not found." });
    return;
  }
  await audit(
    actor,
    "tenant.updated",
    tenant.id,
    "tenant",
    tenant.id,
    `Updated store details or subscription for ${tenant.name}`,
  );
  res.json(UpdateXStoreTenantResponse.parse(tenantDto(tenant)));
});

router.delete("/xstore/tenants/:tenantId", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can permanently delete stores." });
    return;
  }

  const tenantId = String(req.params.tenantId || "").trim();
  if (!tenantId) {
    res.status(400).json({ error: "Store ID is required." });
    return;
  }

  const [tenant] = await db
    .select({ id: xstoreTenants.id, name: xstoreTenants.name })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: "Store not found." });
    return;
  }

  await db.transaction(async (tx) => {
    // Keep the audit trail, but remove every tenant-owned record that can
    // otherwise block deletion because of non-cascading foreign keys.
    await tx.execute(sql`
      DELETE FROM xstore_returns
      WHERE sale_id IN (SELECT id FROM xstore_sales WHERE tenant_id = ${tenantId}::uuid)
         OR product_id IN (SELECT id FROM xstore_products WHERE tenant_id = ${tenantId}::uuid)
    `);
    await tx.execute(sql`
      DELETE FROM xstore_sale_items
      WHERE sale_id IN (SELECT id FROM xstore_sales WHERE tenant_id = ${tenantId}::uuid)
         OR product_id IN (SELECT id FROM xstore_products WHERE tenant_id = ${tenantId}::uuid)
    `);
    await tx.execute(sql`
      DELETE FROM xstore_poultry_invoice_items
      WHERE invoice_id IN (
        SELECT id FROM xstore_poultry_invoices WHERE tenant_id = ${tenantId}::uuid
      )
    `);
    await tx.execute(sql`
      DELETE FROM xstore_poultry_invoices
      WHERE tenant_id = ${tenantId}::uuid
    `);
    await tx.execute(sql`
      DELETE FROM xstore_poultry_payments
      WHERE tenant_id = ${tenantId}::uuid
    `);
    await tx.execute(sql`
      DELETE FROM xstore_customers
      WHERE tenant_id = ${tenantId}::uuid
    `);
    await tx.execute(sql`
      DELETE FROM xstore_users
      WHERE tenant_id = ${tenantId}::uuid
    `);
    await tx.delete(xstoreTenants).where(eq(xstoreTenants.id, tenantId));
  });

  await audit(
    actor,
    "tenant.deleted",
    null,
    "tenant",
    tenantId,
    "Permanently deleted store " + tenant.name + " and its tenant-owned data.",
  );

  res.status(204).end();
});

router.patch(
  "/xstore/tenants/:tenantId/credentials",
  async (req, res): Promise<void> => {
    const actor = getXStoreUser(res);
    if (actor.role !== "platform_admin") {
      res.status(403).json({ error: "Only the platform owner can manage store access." });
      return;
    }
    const params = UpdateXStoreTenantCredentialsParams.safeParse(req.params);
    const parsed = UpdateXStoreTenantCredentialsBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: params.error?.message ?? parsed.error?.message ?? "Invalid credentials.",
      });
      return;
    }

    const [tenant] = await db
      .select()
      .from(xstoreTenants)
      .where(eq(xstoreTenants.id, params.data.tenantId))
      .limit(1);
    if (!tenant) {
      res.status(404).json({ error: "Store not found." });
      return;
    }

    let phone: string;
    try {
      phone = normalizePhone(parsed.data.phone);
    } catch {
      res.status(400).json({ error: "Enter a valid owner phone number." });
      return;
    }
    const passwordHash = await hashPassword(parsed.data.password);

    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${phone}))`);
        const [owner] = await tx
          .select()
          .from(xstoreUsers)
          .where(
            and(
              eq(xstoreUsers.tenantId, tenant.id),
              eq(xstoreUsers.role, "tenant_admin"),
            ),
          )
          .limit(1);
        const [phoneOwner] = await tx
          .select({ id: xstoreUsers.id })
          .from(xstoreUsers)
          .where(eq(xstoreUsers.phone, phone))
          .limit(1);
        if (phoneOwner && phoneOwner.id !== owner?.id) {
          return { kind: "phone_taken" as const };
        }

        if (owner) {
          await tx
            .update(xstoreUsers)
            .set({
              phone,
              passwordHash,
              sessionVersion: sql`${xstoreUsers.sessionVersion} + 1`,
              isActive: true,
            })
            .where(eq(xstoreUsers.id, owner.id));
        } else {
          await tx.insert(xstoreUsers).values({
            email: tenant.email,
            phone,
            passwordHash,
            name: tenant.ownerName,
            role: "tenant_admin",
            tenantId: tenant.id,
          });
        }
        await tx
          .update(xstoreTenants)
          .set({ phone })
          .where(eq(xstoreTenants.id, tenant.id));
        return { kind: "success" as const };
      });
      if (result.kind === "phone_taken") {
        res.status(409).json({ error: "This phone number already belongs to another account." });
        return;
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "This phone number already belongs to another account." });
        return;
      }
      throw error;
    }

    await audit(
      actor,
      "tenant.credentials_updated",
      tenant.id,
      "tenant",
      tenant.id,
      "Updated the tenant administrator's phone number and password.",
    );
    res.status(204).end();
  },
);

router.get("/xstore/team", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (user.role !== "tenant_admin" || !user.tenantId) {
    res.status(403).json({ error: "Only a store administrator can manage the team." });
    return;
  }
  const rows = await db
    .select()
    .from(xstoreTeamMembers)
    .where(eq(xstoreTeamMembers.tenantId, user.tenantId))
    .orderBy(desc(xstoreTeamMembers.createdAt));
  res.json(
    ListXStoreTeamResponse.parse(
      rows.map((member) => ({
        ...member,
        createdAt: iso(member.createdAt),
      })),
    ),
  );
});

router.post("/xstore/team", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "tenant_admin" || !actor.tenantId) {
    res.status(403).json({ error: "Only a store administrator can assign roles." });
    return;
  }
  const parsed = AddXStoreTeamMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const memberInput = parsed.data;
  const roleName = memberInput.roleName.trim();
  if (!roleName) {
    res.status(400).json({ error: "Enter a name for this custom role." });
    return;
  }
  const permissions = [...new Set(memberInput.permissions)] as XStoreTeamPermission[];
  let phone: string;
  try {
    phone = normalizePhone(memberInput.phone);
  } catch {
    res.status(400).json({ error: "Enter a valid team member phone number." });
    return;
  }
  const email = memberInput.email?.trim().toLowerCase() || null;
  const passwordHash = await hashPassword(memberInput.password);

  let member: typeof xstoreTeamMembers.$inferSelect | undefined;
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${phone}))`);
      const [phoneAccount] = await tx
        .select()
        .from(xstoreUsers)
        .where(eq(xstoreUsers.phone, phone))
        .limit(1);
      const [legacyEmailAccount] = !phoneAccount && email
        ? await tx
            .select()
            .from(xstoreUsers)
            .where(
              and(
                ilike(xstoreUsers.email, email),
                eq(xstoreUsers.tenantId, actor.tenantId!),
                inArray(xstoreUsers.role, [
                  "cashier",
                  "warehouse_manager",
                  "accountant",
                  "custom",
                ]),
              ),
            )
            .limit(1)
        : [];
      const existingAccount = phoneAccount ?? legacyEmailAccount;
      if (
        existingAccount &&
        (existingAccount.role === "platform_admin" ||
          existingAccount.role === "tenant_admin" ||
          existingAccount.tenantId !== actor.tenantId)
      ) {
        return { kind: "phone_taken" as const };
      }

      const [memberByPhone] = await tx
        .select()
        .from(xstoreTeamMembers)
        .where(
          and(
            eq(xstoreTeamMembers.tenantId, actor.tenantId!),
            eq(xstoreTeamMembers.phone, phone),
          ),
        )
        .limit(1);
      const [memberByEmail] = !memberByPhone && email
        ? await tx
            .select()
            .from(xstoreTeamMembers)
            .where(
              and(
                eq(xstoreTeamMembers.tenantId, actor.tenantId!),
                ilike(xstoreTeamMembers.email, email),
              ),
            )
            .limit(1)
        : [];
      const existingMember = memberByPhone ?? memberByEmail;
      const [savedMember] = existingMember
        ? await tx
            .update(xstoreTeamMembers)
            .set({
              phone,
              email,
              name: memberInput.name,
              role: "custom",
              roleName,
              permissions,
              status: "active",
            })
            .where(eq(xstoreTeamMembers.id, existingMember.id))
            .returning()
        : await tx
            .insert(xstoreTeamMembers)
            .values({
              tenantId: actor.tenantId!,
              phone,
              email,
              name: memberInput.name,
              role: "custom",
              roleName,
              permissions,
              status: "active",
            })
            .onConflictDoUpdate({
              target: [xstoreTeamMembers.tenantId, xstoreTeamMembers.phone],
              set: {
                email,
                name: memberInput.name,
                role: "custom",
                roleName,
                permissions,
                status: "active",
              },
            })
            .returning();
      if (!savedMember) return { kind: "failed" as const };

      if (existingAccount) {
        await tx
          .update(xstoreUsers)
          .set({
            email,
            name: memberInput.name,
            role: "custom",
            roleName,
            permissions,
            tenantId: actor.tenantId,
            passwordHash,
            sessionVersion: sql`${xstoreUsers.sessionVersion} + 1`,
            isActive: true,
          })
          .where(eq(xstoreUsers.id, existingAccount.id));
      } else {
        await tx.insert(xstoreUsers).values({
          email,
          phone,
          passwordHash,
          name: memberInput.name,
          role: "custom",
          roleName,
          permissions,
          tenantId: actor.tenantId,
        });
      }
      return { kind: "success" as const, member: savedMember };
    });
    if (result.kind === "phone_taken") {
      res.status(409).json({ error: "This phone number already belongs to another account." });
      return;
    }
    if (result.kind === "success") member = result.member;
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "This phone number already belongs to another account." });
      return;
    }
    throw error;
  }
  if (!member) {
    res.status(500).json({ error: "Unable to add this team member." });
    return;
  }
  await audit(
    actor,
    "team.role_assigned",
    actor.tenantId,
    "team_member",
    member.id,
    `${member.phone} assigned ${member.roleName || member.role} (${member.permissions.join(", ")})`,
  );
  res
    .status(201)
    .json(AddXStoreTeamMemberResponse.parse({ ...member, createdAt: iso(member.createdAt) }));
});

router.patch("/xstore/team/:memberId", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "tenant_admin" || !actor.tenantId) {
    res.status(403).json({ error: "Only a store administrator can manage the team." });
    return;
  }
  const params = UpdateXStoreTeamMemberParams.safeParse(req.params);
  const parsed = UpdateXStoreTeamMemberBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const input = parsed.data;
  const name = input.name.trim();
  if (!name) {
    res.status(400).json({ error: "Enter a name for this team member." });
    return;
  }
  const roleName = input.roleName.trim();
  if (!roleName) {
    res.status(400).json({ error: "Enter a name for this custom role." });
    return;
  }
  let phone: string;
  try {
    phone = normalizePhone(input.phone);
  } catch {
    res.status(400).json({ error: "Enter a valid team member phone number." });
    return;
  }
  const email = input.email?.trim().toLowerCase() || null;
  const permissions = [...new Set(input.permissions)] as XStoreTeamPermission[];
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  type UpdateResult =
    | { kind: "updated"; member: typeof xstoreTeamMembers.$inferSelect }
    | { kind: "not_found" }
    | { kind: "owner" }
    | { kind: "account_missing" }
    | { kind: "phone_taken" };
  let result: UpdateResult;
  try {
    result = await db.transaction(async (tx): Promise<UpdateResult> => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${phone}))`);
      const [member] = await tx
        .select()
        .from(xstoreTeamMembers)
        .where(
          and(
            eq(xstoreTeamMembers.id, params.data.memberId),
            eq(xstoreTeamMembers.tenantId, actor.tenantId!),
          ),
        )
        .limit(1);
      if (!member) return { kind: "not_found" };
      if (member.role === "tenant_admin") return { kind: "owner" };

      const memberRoles = ["cashier", "warehouse_manager", "accountant", "custom"];
      const [accountByPhone] = member.phone
        ? await tx
            .select()
            .from(xstoreUsers)
            .where(
              and(
                eq(xstoreUsers.phone, member.phone),
                eq(xstoreUsers.tenantId, actor.tenantId!),
                inArray(xstoreUsers.role, memberRoles),
              ),
            )
            .limit(1)
        : [];
      const [accountByEmail] = !accountByPhone && member.email
        ? await tx
            .select()
            .from(xstoreUsers)
            .where(
              and(
                ilike(xstoreUsers.email, member.email),
                eq(xstoreUsers.tenantId, actor.tenantId!),
                inArray(xstoreUsers.role, memberRoles),
              ),
            )
            .limit(1)
        : [];
      const account = accountByPhone ?? accountByEmail;
      if (account?.id === actor.id) return { kind: "owner" };
      if (!account && member.status === "active" && !passwordHash) {
        return { kind: "account_missing" };
      }

      const [phoneOwner] = await tx
        .select({ id: xstoreUsers.id })
        .from(xstoreUsers)
        .where(eq(xstoreUsers.phone, phone))
        .limit(1);
      if (phoneOwner && phoneOwner.id !== account?.id) {
        return { kind: "phone_taken" };
      }
      const [duplicateMember] = await tx
        .select({ id: xstoreTeamMembers.id })
        .from(xstoreTeamMembers)
        .where(
          and(
            eq(xstoreTeamMembers.tenantId, actor.tenantId!),
            eq(xstoreTeamMembers.phone, phone),
          ),
        )
        .limit(1);
      if (duplicateMember && duplicateMember.id !== member.id) {
        return { kind: "phone_taken" };
      }

      const [savedMember] = await tx
        .update(xstoreTeamMembers)
        .set({
          phone,
          email,
          name,
          role: "custom",
          roleName,
          permissions,
          status: account || passwordHash ? "active" : member.status,
        })
        .where(eq(xstoreTeamMembers.id, member.id))
        .returning();
      if (!savedMember) return { kind: "not_found" };

      if (account) {
        await tx
          .update(xstoreUsers)
          .set({
            phone,
            email,
            name,
            role: "custom",
            roleName,
            permissions,
            ...(passwordHash ? { passwordHash } : {}),
            sessionVersion: sql`${xstoreUsers.sessionVersion} + 1`,
            isActive: true,
          })
          .where(eq(xstoreUsers.id, account.id));
      } else if (passwordHash) {
        await tx.insert(xstoreUsers).values({
          phone,
          email,
          passwordHash,
          name,
          role: "custom",
          roleName,
          permissions,
          tenantId: actor.tenantId!,
        });
      }
      return { kind: "updated", member: savedMember };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "This phone number already belongs to another account." });
      return;
    }
    throw error;
  }

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Team member not found." });
    return;
  }
  if (result.kind === "owner") {
    res.status(403).json({ error: "The store owner account cannot be managed from this page." });
    return;
  }
  if (result.kind === "account_missing") {
    res.status(409).json({ error: "This member has no active login. Set a new password to create one." });
    return;
  }
  if (result.kind === "phone_taken") {
    res.status(409).json({ error: "This phone number already belongs to another account." });
    return;
  }
  if (result.kind !== "updated") {
    res.status(500).json({ error: "Unable to update this team member." });
    return;
  }
  await audit(
    actor,
    "team.member_updated",
    actor.tenantId,
    "team_member",
    result.member.id,
    `Updated ${result.member.name} (${result.member.phone}) role ${result.member.roleName || result.member.role}; password ${passwordHash ? "changed" : "unchanged"}.`,
  );
  res.json(
    UpdateXStoreTeamMemberResponse.parse({
      ...result.member,
      createdAt: iso(result.member.createdAt),
    }),
  );
});

router.delete("/xstore/team/:memberId", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "tenant_admin" || !actor.tenantId) {
    res.status(403).json({ error: "Only a store administrator can manage the team." });
    return;
  }
  const params = DeleteXStoreTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  type DeleteResult =
    | { kind: "deleted"; member: typeof xstoreTeamMembers.$inferSelect }
    | { kind: "not_found" }
    | { kind: "owner" };
  const result = await db.transaction(async (tx): Promise<DeleteResult> => {
    const [member] = await tx
      .select()
      .from(xstoreTeamMembers)
      .where(
        and(
          eq(xstoreTeamMembers.id, params.data.memberId),
          eq(xstoreTeamMembers.tenantId, actor.tenantId!),
        ),
      )
      .limit(1);
    if (!member) return { kind: "not_found" };
    if (member.role === "tenant_admin") return { kind: "owner" };

    const memberRoles = ["cashier", "warehouse_manager", "accountant", "custom"];
    const [accountByPhone] = member.phone
      ? await tx
          .select()
          .from(xstoreUsers)
          .where(
            and(
              eq(xstoreUsers.phone, member.phone),
              eq(xstoreUsers.tenantId, actor.tenantId!),
              inArray(xstoreUsers.role, memberRoles),
            ),
          )
          .limit(1)
      : [];
    const [accountByEmail] = !accountByPhone && member.email
      ? await tx
          .select()
          .from(xstoreUsers)
          .where(
            and(
              ilike(xstoreUsers.email, member.email),
              eq(xstoreUsers.tenantId, actor.tenantId!),
              inArray(xstoreUsers.role, memberRoles),
            ),
          )
          .limit(1)
      : [];
    const account = accountByPhone ?? accountByEmail;
    if (account?.id === actor.id) return { kind: "owner" };

    if (account) {
      await tx
        .update(xstoreUsers)
        .set({
          phone: null,
          email: null,
          passwordHash: null,
          role: "custom",
          roleName: null,
          permissions: [],
          sessionVersion: sql`${xstoreUsers.sessionVersion} + 1`,
          isActive: false,
        })
        .where(eq(xstoreUsers.id, account.id));
    }
    await tx
      .delete(xstoreTeamMembers)
      .where(eq(xstoreTeamMembers.id, member.id));
    return { kind: "deleted", member };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Team member not found." });
    return;
  }
  if (result.kind === "owner") {
    res.status(403).json({ error: "The store owner account cannot be removed from this page." });
    return;
  }
  if (result.kind !== "deleted") {
    res.status(500).json({ error: "Unable to remove this team member." });
    return;
  }
  await audit(
    actor,
    "team.member_deleted",
    actor.tenantId,
    "team_member",
    result.member.id,
    `Removed ${result.member.name} (${result.member.phone ?? "no phone"}); login access revoked and historical transactions retained.`,
  );
  res.status(204).end();
});

router.get("/xstore/subscription-payments", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (user.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can view billing." });
    return;
  }
  const rows = await db
    .select({
      id: xstoreSubscriptionPayments.id,
      tenantId: xstoreSubscriptionPayments.tenantId,
      tenantName: xstoreTenants.name,
      amount: xstoreSubscriptionPayments.amount,
      plan: xstoreSubscriptionPayments.plan,
      paymentMethod: xstoreSubscriptionPayments.paymentMethod,
      createdAt: xstoreSubscriptionPayments.createdAt,
    })
    .from(xstoreSubscriptionPayments)
    .innerJoin(
      xstoreTenants,
      eq(xstoreSubscriptionPayments.tenantId, xstoreTenants.id),
    )
    .orderBy(desc(xstoreSubscriptionPayments.createdAt))
    .limit(100);
  res.json(
    ListXStoreSubscriptionPaymentsResponse.parse(
      rows.map((payment) => ({
        ...payment,
        amount: toNumber(payment.amount),
        createdAt: iso(payment.createdAt),
      })),
    ),
  );
});

router.post("/xstore/subscription-payments", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can record renewals." });
    return;
  }
  const parsed = CreateXStoreSubscriptionPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  const [tenant] = await db
    .select()
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, input.tenantId))
    .limit(1);
  if (!tenant) {
    res.status(404).json({ error: "Store not found." });
    return;
  }
  const now = new Date();
  const existingEnd =
    tenant.subscriptionEndsAt &&
    new Date(`${tenant.subscriptionEndsAt}T00:00:00Z`) > now
      ? new Date(`${tenant.subscriptionEndsAt}T00:00:00Z`)
      : now;
  const newEnd = planEndDate(input.plan, existingEnd);
  const [payment] = await db
    .insert(xstoreSubscriptionPayments)
    .values({
      tenantId: tenant.id,
      amount: String(roundMoney(input.amount)),
      plan: input.plan,
      paymentMethod: input.paymentMethod,
    })
    .returning();
  await db
    .update(xstoreTenants)
    .set({
      plan: input.plan,
      status: "active",
      subscriptionEndsAt: newEnd,
    })
    .where(eq(xstoreTenants.id, tenant.id));
  if (!payment) {
    res.status(500).json({ error: "Unable to record this payment." });
    return;
  }
  await audit(
    actor,
    "subscription.payment_recorded",
    tenant.id,
    "subscription_payment",
    payment.id,
    `Recorded ${input.plan} renewal`,
  );
  res.status(201).json(
    CreateXStoreSubscriptionPaymentResponse.parse({
      id: payment.id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      amount: toNumber(payment.amount),
      plan: payment.plan,
      paymentMethod: payment.paymentMethod,
      createdAt: iso(payment.createdAt),
    }),
  );
});

router.post("/xstore/offline-licenses/issue", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (actor.role !== "platform_admin") {
    res.status(403).json({ error: "Only the platform owner can issue offline licenses." });
    return;
  }
  const parsed = IssueXStoreOfflineLicenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const privateKeyText = process.env.XSTORE_OFFLINE_LICENSE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .trim();
  if (!privateKeyText) {
    res.status(503).json({
      error: "مفتاح إصدار تراخيص الأوفلاين غير مهيأ على الخادم.",
    });
    return;
  }

  let privateKey: ReturnType<typeof createPrivateKey>;
  try {
    privateKey = createPrivateKey(privateKeyText);
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new Error("The configured offline signing key is not Ed25519.");
    }
  } catch (error) {
    req.log.error({ error }, "Offline license signing key is invalid");
    res.status(503).json({
      error: "إعداد مفتاح إصدار تراخيص الأوفلاين غير صالح على الخادم.",
    });
    return;
  }

  const { request, plan } = parsed.data;
  const deviceFingerprint = {
    version: request.deviceFingerprint.version,
    windowsMachineGuid: request.deviceFingerprint.windowsMachineGuid,
    motherboard: request.deviceFingerprint.motherboard,
    internalDisks: [...request.deviceFingerprint.internalDisks].sort(),
    memoryModules: [...request.deviceFingerprint.memoryModules].sort(),
  };
  if (offlineInstallationIdFromFingerprint(deviceFingerprint) !== request.installationId) {
    res.status(400).json({ error: "معرّف الجهاز لا يطابق تقرير القطع." });
    return;
  }

  const issuedAt = new Date();
  const payload = {
    version: 2 as const,
    licenseId: randomUUID(),
    installationId: request.installationId,
    deviceFingerprint,
    storeName: request.storeName.trim(),
    plan,
    issuedAt: issuedAt.toISOString(),
    expiresAt: offlineLicenseEndDate(plan, issuedAt),
  };
  const signature = signBytes(
    null,
    Buffer.from(JSON.stringify(payload), "utf8"),
    privateKey,
  ).toString("base64");
  const license = { payload, signature };

  await audit(
    actor,
    "offline_license.issued",
    null,
    "offline_license",
    payload.licenseId,
    `Issued ${plan} offline license for ${payload.storeName || "unnamed store"}`,
  );

  res.setHeader("Cache-Control", "no-store");
  res.status(201).json(IssueXStoreOfflineLicenseResponse.parse(license));
});

function offlineInstallationIdFromFingerprint(deviceFingerprint: {
  version: number;
  windowsMachineGuid: string;
  motherboard: string;
  internalDisks: string[];
  memoryModules: string[];
}): string {
  const canonical = {
    version: deviceFingerprint.version,
    windowsMachineGuid: deviceFingerprint.windowsMachineGuid,
    motherboard: deviceFingerprint.motherboard,
    internalDisks: [...deviceFingerprint.internalDisks].sort(),
    memoryModules: [...deviceFingerprint.memoryModules].sort(),
  };
  const digest = createHash("sha256")
    .update(`com.xstore.offline/device-id/v2\0${JSON.stringify(canonical).trim().toLowerCase()}`)
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

router.get("/xstore/products", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (
    !hasRole(user, [
      "platform_admin",
      "tenant_admin",
      "cashier",
      "warehouse_manager",
      "accountant",
    ])
  ) {
    res.status(403).json({ error: "You cannot view products." });
    return;
  }
  const parsed = ListXStoreProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { tenantId, search, category } = parsed.data;
  const scopedTenant = tenantIdFor(user, tenantId);
  if (user.role !== "platform_admin" && !scopedTenant) {
    res.status(403).json({ error: "Select a store before viewing products." });
    return;
  }
  const filters = [
    scopedTenant ? eq(xstoreProducts.tenantId, scopedTenant) : undefined,
    category ? eq(xstoreProducts.category, category) : undefined,
    search
      ? or(
          ilike(xstoreProducts.name, `%${search}%`),
          ilike(xstoreProducts.sku, `%${search}%`),
          ilike(xstoreProducts.barcode, `%${search}%`),
          ilike(xstoreProducts.partNumber, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(xstoreProducts)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(xstoreProducts.name)
    .limit(500);
  res.json(
    ListXStoreProductsResponse.parse(
      rows.map((product) => productDto(product, user)),
    ),
  );
});

router.post("/xstore/products", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!hasRole(actor, inventoryEditors)) {
    res.status(403).json({ error: "You cannot add inventory." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const parsed = CreateXStoreProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.price == null && parsed.data.wholesalePrice == null) {
    res.status(400).json({
      error: "Enter at least a retail price or a wholesale price.",
    });
    return;
  }
  const [tenant] = await db
    .select({
      storeType: xstoreTenants.storeType,
      wholesaleEnabled: xstoreTenants.wholesaleEnabled,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    res.status(404).json({ error: "Store not found." });
    return;
  }
  if (
    parsed.data.wholesalePrice != null &&
    !tenantAllowsWholesale(tenant)
  ) {
    res.status(400).json({
      error: "Wholesale prices are not enabled for this store.",
    });
    return;
  }
  const { ingredients, ...productData } = parsed.data;
  const [product] = await db
    .insert(xstoreProducts)
    .values({
      ...productData,
      tenantId,
      partNumber: tenant.storeType === "cafe" || tenant.storeType === "restaurant"
        ? ingredients?.trim() || null
        : parsed.data.partNumber ?? null,
      price: parsed.data.price == null ? null : String(parsed.data.price),
      wholesalePrice:
        parsed.data.wholesalePrice == null
          ? null
          : String(parsed.data.wholesalePrice),
      costPrice: String(parsed.data.costPrice ?? 0),
      barcode: parsed.data.barcode ?? null,
      color: parsed.data.color ?? null,
      size: parsed.data.size ?? null,
      expiresAt: dbDate(parsed.data.expiresAt) ?? null,
    })
    .returning();
  if (!product) {
    res.status(500).json({ error: "Unable to add this product." });
    return;
  }
  await audit(
    actor,
    "inventory.product_created",
    tenantId,
    "product",
    product.id,
    `Added ${product.name}`,
  );
  res
    .status(201)
    .json(
      CreateXStoreProductResponse.parse(productDto(product, actor)),
    );
});

router.patch("/xstore/products/:productId", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!hasRole(actor, inventoryEditors)) {
    res.status(403).json({ error: "You cannot change inventory." });
    return;
  }
  const params = UpdateXStoreProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateXStoreProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const clauses = [eq(xstoreProducts.id, params.data.productId)];
  if (actor.role !== "platform_admin" && actor.tenantId) {
    clauses.push(eq(xstoreProducts.tenantId, actor.tenantId));
  }
  const [existingProduct] = await db
    .select()
    .from(xstoreProducts)
    .where(and(...clauses))
    .limit(1);
  if (!existingProduct) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (
    hasRole(actor, ["warehouse_manager"]) &&
    Object.keys(parsed.data).some(
      (key) =>
        !["quantity", "price", "wholesalePrice", "costPrice"].includes(key),
    )
  ) {
    res.status(403).json({
      error: "Warehouse managers can only update stock and prices.",
    });
    return;
  }
  const [tenant] = await db
    .select({
      storeType: xstoreTenants.storeType,
      wholesaleEnabled: xstoreTenants.wholesaleEnabled,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, existingProduct.tenantId))
    .limit(1);
  const nextRetailPrice =
    parsed.data.price === undefined
      ? existingProduct.price
      : parsed.data.price;
  const nextWholesalePrice =
    parsed.data.wholesalePrice === undefined
      ? existingProduct.wholesalePrice
      : parsed.data.wholesalePrice;
  if (nextRetailPrice == null && nextWholesalePrice == null) {
    res.status(400).json({
      error: "Enter at least a retail price or a wholesale price.",
    });
    return;
  }
  if (nextWholesalePrice != null && !tenantAllowsWholesale(tenant)) {
    res.status(400).json({
      error: "Wholesale prices are not enabled for this store.",
    });
    return;
  }
  const { ingredients, ...productData } = parsed.data;
  const update = {
    ...productData,
    partNumber: tenant?.storeType === "cafe" || tenant?.storeType === "restaurant"
      ? ingredients === undefined
        ? undefined
        : ingredients?.trim() || null
      : parsed.data.partNumber,
    price:
      parsed.data.price === undefined
        ? undefined
        : parsed.data.price === null
          ? null
          : String(parsed.data.price),
    wholesalePrice:
      parsed.data.wholesalePrice === undefined
        ? undefined
        : parsed.data.wholesalePrice === null
          ? null
          : String(parsed.data.wholesalePrice),
    costPrice:
      parsed.data.costPrice === undefined
        ? undefined
        : String(parsed.data.costPrice),
    expiresAt: dbDate(parsed.data.expiresAt),
  };
  const [product] = await db
    .update(xstoreProducts)
    .set(update)
    .where(and(...clauses))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  await audit(
    actor,
    "inventory.product_updated",
    product.tenantId,
    "product",
    product.id,
    `Updated ${product.name}`,
  );
  res.json(
    UpdateXStoreProductResponse.parse(productDto(product, actor)),
  );
});

router.get("/xstore/sales", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  const hasAllSalesHistory = hasRole(user, saleHistoryRoles);
  if (!hasAllSalesHistory && !canAccessPointOfSale(user)) {
    res.status(403).json({ error: "Sales history is not available to this role." });
    return;
  }
  const parsed = ListXStoreSalesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scopedTenant = tenantIdFor(user, parsed.data.tenantId);
  const rows = await db
    .select({
          sale: xstoreSaleSelectionWithoutTableNumber,
      cashierName: xstoreUsers.name,
      tenantName: xstoreTenants.name,
    })
    .from(xstoreSales)
    .innerJoin(xstoreUsers, eq(xstoreSales.cashierUserId, xstoreUsers.id))
    .innerJoin(xstoreTenants, eq(xstoreSales.tenantId, xstoreTenants.id))
    .where(
      and(
        scopedTenant ? eq(xstoreSales.tenantId, scopedTenant) : undefined,
        hasAllSalesHistory
          ? undefined
          : inArray(xstoreSales.saleType, getAllowedSaleTypes(user)),
      ),
    )
    .orderBy(desc(xstoreSales.createdAt))
    .limit(parsed.data.limit ?? 50);
  const saleIds = rows.map(({ sale }) => sale.id);
  const invoiceLines = saleIds.length
    ? await db
        .select({
          saleId: xstoreSaleItems.saleId,
          productId: xstoreSaleItems.productId,
          name: sql<string>`coalesce(${xstoreSaleItems.productName}, ${xstoreProducts.name})`,
          sku: xstoreProducts.sku,
          unitPrice: xstoreSaleItems.unitPrice,
          quantity: xstoreSaleItems.quantity,
          returnedQuantity: xstoreSaleItems.returnedQuantity,
        })
        .from(xstoreSaleItems)
        .innerJoin(
          xstoreProducts,
          eq(xstoreSaleItems.productId, xstoreProducts.id),
        )
        .where(inArray(xstoreSaleItems.saleId, saleIds))
        .orderBy(xstoreSaleItems.saleId, xstoreProducts.name)
    : [];
  const invoiceLinesBySale = new Map<string, XStoreSaleLineItemDto[]>();
  for (const line of invoiceLines) {
    const items = invoiceLinesBySale.get(line.saleId) ?? [];
    items.push({
      productId: line.productId,
      name: line.name,
      sku: line.sku,
      unitPrice: toNumber(line.unitPrice),
      quantity: line.quantity,
      returnedQuantity: line.returnedQuantity,
    });
    invoiceLinesBySale.set(line.saleId, items);
  }
  const costsBySale = saleIds.length
    ? await db
        .select({
          saleId: xstoreSaleItems.saleId,
          amount: sql<number>`coalesce(sum(${xstoreSaleItems.unitCost} * (${xstoreSaleItems.quantity} - ${xstoreSaleItems.returnedQuantity})), 0)`,
        })
        .from(xstoreSaleItems)
        .where(inArray(xstoreSaleItems.saleId, saleIds))
        .groupBy(xstoreSaleItems.saleId)
    : [];
  const returnsBySale = saleIds.length
    ? await db
        .select({
          saleId: xstoreReturns.saleId,
          amount: sql<number>`coalesce(sum(${xstoreReturns.refundAmount} - (${xstoreReturns.refundAmount} * ${xstoreSales.taxAmount} / nullif(${xstoreSales.subtotal} - ${xstoreSales.discountAmount} + ${xstoreSales.taxAmount}, 0))), 0)`,
        })
        .from(xstoreReturns)
        .innerJoin(xstoreSales, eq(xstoreReturns.saleId, xstoreSales.id))
        .where(inArray(xstoreReturns.saleId, saleIds))
        .groupBy(xstoreReturns.saleId)
    : [];
  const costs = new Map(
    costsBySale.map((row) => [row.saleId, toNumber(row.amount)]),
  );
  const refunds = new Map(
    returnsBySale.map((row) => [row.saleId, toNumber(row.amount)]),
  );
  const exchangeAuditRows = saleIds.length
    ? await db
        .select({
          entityId: xstoreAuditLogs.entityId,
          details: xstoreAuditLogs.details,
          actorName: xstoreAuditLogs.actorName,
          createdAt: xstoreAuditLogs.createdAt,
        })
        .from(xstoreAuditLogs)
        .where(
          and(
            eq(xstoreAuditLogs.action, "sale.exchange"),
            scopedTenant
              ? eq(xstoreAuditLogs.tenantId, scopedTenant)
              : undefined,
          ),
        )
        .orderBy(desc(xstoreAuditLogs.createdAt))
        .limit(500)
    : [];
  const invoiceNumbers = new Set(rows.map(({ sale }) => sale.invoiceNo));
  const exchangeEvents = exchangeAuditRows
    .map(exchangeEventFromAudit)
    .filter(
      (event): event is XStoreExchangeEvent =>
        event !== null &&
        (invoiceNumbers.has(event.originalInvoiceNo) ||
          invoiceNumbers.has(event.exchangeInvoiceNo)),
    );
  res.json(
    ListXStoreSalesResponse.parse(
      rows.map(({ sale, cashierName, tenantName }) =>
        saleDto(
          sale,
          user,
          roundMoney(
            toNumber(sale.subtotal) -
              toNumber(sale.discountAmount) -
              (refunds.get(sale.id) ?? 0) -
              (costs.get(sale.id) ?? 0),
          ),
          cashierName,
          exchangeEvents.filter(
            (event) =>
              event.originalInvoiceNo === sale.invoiceNo ||
              event.exchangeInvoiceNo === sale.invoiceNo,
          ),
          invoiceLinesBySale.get(sale.id) ?? [],
          tenantName,
        ),
      ),
    ),
  );
});

router.get(
  "/xstore/sales/:invoiceNo/items",
  async (req, res): Promise<void> => {
    const user = getXStoreUser(res);
    const hasAllSalesHistory = hasRole(user, saleHistoryRoles);
    if (!hasAllSalesHistory && !canAccessPointOfSale(user)) {
      res.status(403).json({ error: "Sales history is not available to this role." });
      return;
    }
    const params = GetXStoreSaleInvoiceItemsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const tenantId = requireTenant(res, user);
    if (!tenantId) return;

    const [sale] = await db
      .select({
        id: xstoreSales.id,
        saleType: xstoreSales.saleType,
      })
      .from(xstoreSales)
      .where(
        and(
          eq(xstoreSales.invoiceNo, params.data.invoiceNo),
          eq(xstoreSales.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!sale) {
      res.status(404).json({ error: "Invoice not found." });
      return;
    }
    if (!hasAllSalesHistory && !canSellSaleType(user, sale.saleType)) {
      res.status(403).json({ error: "This role cannot access this sale type." });
      return;
    }
    const [saleTotals] = await db
      .select({
        subtotal: xstoreSales.subtotal,
        discountAmount: xstoreSales.discountAmount,
        taxAmount: xstoreSales.taxAmount,
      })
      .from(xstoreSales)
      .where(eq(xstoreSales.id, sale.id))
      .limit(1);
    if (!saleTotals) {
      res.status(404).json({ error: "Invoice not found." });
      return;
    }
    const originalSubtotal = toNumber(saleTotals.subtotal);
    const discountedSubtotal = Math.max(
      0,
      originalSubtotal - toNumber(saleTotals.discountAmount),
    );
    const discountRate =
      originalSubtotal > 0
        ? toNumber(saleTotals.discountAmount) / originalSubtotal
        : 0;
    const taxRate =
      discountedSubtotal > 0
        ? toNumber(saleTotals.taxAmount) / discountedSubtotal
        : 0;

    const items = await db
      .select({
        productId: xstoreSaleItems.productId,
        name: sql<string>`coalesce(${xstoreSaleItems.productName}, ${xstoreProducts.name})`,
        sku: xstoreProducts.sku,
        unitPrice: xstoreSaleItems.unitPrice,
        quantity: xstoreSaleItems.quantity,
        returnedQuantity: xstoreSaleItems.returnedQuantity,
      })
      .from(xstoreSaleItems)
      .innerJoin(
        xstoreProducts,
        eq(xstoreSaleItems.productId, xstoreProducts.id),
      )
      .where(eq(xstoreSaleItems.saleId, sale.id));
    res.json(
      GetXStoreSaleInvoiceItemsResponse.parse(
        items.map((item) => ({
          ...item,
          saleType: sale.saleType,
          unitPrice: toNumber(item.unitPrice),
          refundUnitAmount:
            toNumber(item.unitPrice) *
            (1 - discountRate) *
            (1 + taxRate),
          returnableQuantity: Math.max(
            0,
            item.quantity - item.returnedQuantity,
          ),
        })),
      ),
    );
  },
);

router.get("/xstore/reports/profit-loss", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!hasRole(user, reportRoles)) {
    res.status(403).json({ error: "Financial reports are not available to this role." });
    return;
  }

  const parsed = GetXStoreProfitLossReportQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const to = parsed.data.to ?? new Date().toISOString().slice(0, 10);
  const from = parsed.data.from ?? `${to.slice(0, 7)}-01`;
  if (from > to) {
    res.status(400).json({ error: "The report start date must be on or before its end date." });
    return;
  }

  const scopedTenant =
    user.role === "platform_admin" ? parsed.data.tenantId : user.tenantId;
  if (user.role !== "platform_admin" && !scopedTenant) {
    res.status(403).json({ error: "Select a store before viewing financial reports." });
    return;
  }

  const endExclusive = new Date(`${to}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const saleFilters = and(
    scopedTenant ? eq(xstoreSales.tenantId, scopedTenant) : undefined,
    gte(xstoreSales.createdAt, new Date(`${from}T00:00:00.000Z`)),
    lt(xstoreSales.createdAt, endExclusive),
  );
  const [salesSummary] = await db
    .select({
      salesCount: count(),
      netSales: sql<number>`coalesce(sum(${xstoreSales.subtotal} - ${xstoreSales.discountAmount}), 0)`,
      taxCollected: sql<number>`coalesce(sum(${xstoreSales.taxAmount}), 0)`,
    })
    .from(xstoreSales)
    .where(saleFilters);
  const saleIds = await db
    .select({ id: xstoreSales.id })
    .from(xstoreSales)
    .where(saleFilters);

  let returnAmount = 0;
  let returnedTax = 0;
  let costOfGoodsSold = 0;
  if (saleIds.length) {
    const ids = saleIds.map((sale) => sale.id);
    const [returns] = await db
      .select({
        amount: sql<number>`coalesce(sum(${xstoreReturns.refundAmount} - (${xstoreReturns.refundAmount} * ${xstoreSales.taxAmount} / nullif(${xstoreSales.subtotal} - ${xstoreSales.discountAmount} + ${xstoreSales.taxAmount}, 0))), 0)`,
        taxAmount: sql<number>`coalesce(sum(${xstoreReturns.refundAmount} * ${xstoreSales.taxAmount} / nullif(${xstoreSales.subtotal} - ${xstoreSales.discountAmount} + ${xstoreSales.taxAmount}, 0)), 0)`,
      })
      .from(xstoreReturns)
      .innerJoin(xstoreSales, eq(xstoreReturns.saleId, xstoreSales.id))
      .where(inArray(xstoreReturns.saleId, ids));
    const [costs] = await db
      .select({
        amount: sql<number>`coalesce(sum(${xstoreSaleItems.unitCost} * (${xstoreSaleItems.quantity} - ${xstoreSaleItems.returnedQuantity})), 0)`,
      })
      .from(xstoreSaleItems)
      .where(inArray(xstoreSaleItems.saleId, ids));
    returnAmount = toNumber(returns?.amount);
    returnedTax = toNumber(returns?.taxAmount);
    costOfGoodsSold = toNumber(costs?.amount);
  }

  const netSales = toNumber(salesSummary?.netSales);
  const taxCollected = roundMoney(
    toNumber(salesSummary?.taxCollected) - returnedTax,
  );
  res.json(
    GetXStoreProfitLossReportResponse.parse({
      from,
      to,
      salesCount: Number(salesSummary?.salesCount ?? 0),
      netSales: roundMoney(netSales),
      returnAmount: roundMoney(returnAmount),
      costOfGoodsSold: roundMoney(costOfGoodsSold),
      taxCollected,
      grossProfit: roundMoney(netSales - returnAmount - costOfGoodsSold),
    }),
  );
});

router.post("/xstore/sales", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!canAccessPointOfSale(actor)) {
    res.status(403).json({ error: "This role cannot complete sales." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const parsed = CheckoutXStoreSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const requestedInvoiceNo = parsed.data.invoiceNo?.trim();
  if (requestedInvoiceNo && !/^[A-Za-z0-9_-]{1,80}$/.test(requestedInvoiceNo)) {
    res.status(400).json({ error: "Enter a valid invoice number." });
    return;
  }
  let customerPhone: string | null = null;
  if (parsed.data.customerPhone?.trim()) {
    try {
      customerPhone = normalizePhone(parsed.data.customerPhone);
    } catch {
      res.status(400).json({ error: "Enter a valid customer phone number." });
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(customerPhone)) {
      res.status(400).json({
        error: "Include the country calling code, such as +20.",
      });
      return;
    }
  }
  const transferSender = parsed.data.transferSender?.trim() || null;
  if (
    (parsed.data.paymentMethod === "wallet" ||
      parsed.data.paymentMethod === "instapay") &&
    !transferSender
  ) {
    res.status(400).json({
      error: "Enter the sender number for this transfer.",
    });
    return;
  }
  const vatRate = await getTenantVatRate(tenantId);
  if (vatRate === null) {
    res.status(404).json({ error: "Store settings not found." });
    return;
  }
  const [tenant] = await db
    .select({
      name: xstoreTenants.name,
      storeType: xstoreTenants.storeType,
      wholesaleEnabled: xstoreTenants.wholesaleEnabled,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, tenantId))
    .limit(1);
  const saleType = parsed.data.saleType ?? "retail";
  if (!canSellSaleType(actor, saleType)) {
    res.status(403).json({ error: "You do not have permission for this sale type." });
    return;
  }
  if (saleType === "wholesale" && !tenantAllowsWholesale(tenant)) {
    res.status(403).json({
      error: "Wholesale sales are not enabled for this store.",
    });
    return;
  }
  const isRestaurantOrder = tenant?.storeType === "cafe" || tenant?.storeType === "restaurant";
  if (parsed.data.orderType && !isRestaurantOrder) {
    res.status(403).json({
      error: "Order type is available only for cafes and restaurants.",
    });
    return;
  }
  const orderType = isRestaurantOrder ? (parsed.data.orderType ?? "external") : null;
  try {
    const { sale, items } = await db.transaction(async (tx) => {
      const lines = mergedLines(parsed.data.items);
      const priced: Array<{
        product: XStoreProduct;
        quantity: number;
        unitPrice: number;
      }> = [];
      for (const line of lines) {
        const [product] = await tx
          .select()
          .from(xstoreProducts)
          .where(
            and(
              eq(xstoreProducts.id, line.productId),
              eq(xstoreProducts.tenantId, tenantId),
            ),
          )
          .for("update")
          .limit(1);
        if (!product) {
          throw new DomainError("A product is no longer available.", 409);
        }
        if (product.quantity < line.quantity) {
          throw new DomainError(
            `Not enough stock for ${product.name}. Available: ${product.quantity}.`,
            409,
          );
        }
        const selectedPrice =
          saleType === "wholesale"
            ? product.wholesalePrice
            : product.price;
        if (selectedPrice === null) {
          throw new DomainError(
            `${product.name} has no ${saleType} price.`,
            409,
          );
        }
        priced.push({
          product,
          quantity: line.quantity,
          unitPrice: toNumber(selectedPrice),
        });
      }
      const subtotal = roundMoney(
        priced.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
      );
      const discountAmount = Math.min(
        subtotal,
        roundMoney(parsed.data.discountAmount),
      );
      const taxAmount = roundMoney(
        (subtotal - discountAmount) * vatRate,
      );
      const total = roundMoney(subtotal - discountAmount + taxAmount);
      const amountReceived =
        parsed.data.paymentMethod === "cash"
          ? roundMoney(parsed.data.amountReceived)
          : total;
      if (
        parsed.data.paymentMethod === "cash" &&
        (amountReceived <= 0 || amountReceived < total)
      ) {
        throw new DomainError(
          "Enter the cash amount received and make sure it covers the total.",
          400,
        );
      }
      const [createdSale] = await tx
        .insert(xstoreSales)
        .values({
          tenantId,
          cashierUserId: actor.id,
          invoiceNo: requestedInvoiceNo || invoiceNumber(),
          saleType,
          customerName: parsed.data.customerName?.trim() || null,
          customerPhone,
          ...(parsed.data.tableNumber?.trim()
            ? { tableNumber: parsed.data.tableNumber.trim() }
            : {}),
          orderType,
          itemCount: priced.reduce((sum, line) => sum + line.quantity, 0),
          subtotal: String(subtotal),
          discountAmount: String(discountAmount),
          taxAmount: String(taxAmount),
          total: String(total),
          paymentMethod: parsed.data.paymentMethod,
          transferSender,
          amountReceived: String(amountReceived),
          changeAmount: String(
            roundMoney(Math.max(0, amountReceived - total)),
          ),
          status: "completed",
        })
        .returning({ id: xstoreSales.id });
      if (!createdSale) throw new DomainError("Unable to complete this sale.", 500);
      const [createdSaleRow] = await tx
        .select(xstoreSaleSelectionWithoutTableNumber)
        .from(xstoreSales)
        .where(eq(xstoreSales.id, createdSale.id))
        .limit(1);
      if (!createdSaleRow) throw new DomainError("Unable to load the completed sale.", 500);
      for (const line of priced) {
        await tx
          .update(xstoreProducts)
          .set({ quantity: sql`${xstoreProducts.quantity} - ${line.quantity}` })
          .where(eq(xstoreProducts.id, line.product.id));
        await tx.insert(xstoreSaleItems).values({
          saleId: createdSale.id,
          productId: line.product.id,
          productName: line.product.name,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          unitCost: String(toNumber(line.product.costPrice)),
        });
      }
      return {
        sale: {
          ...createdSaleRow,
          tableNumber: parsed.data.tableNumber?.trim() || null,
        },
        items: priced.map((line) => ({
          productId: line.product.id,
          name: line.product.name,
          sku: line.product.sku,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          returnedQuantity: 0,
        })),
      };
    });
    res
      .status(201)
      .json(
        CheckoutXStoreSaleResponse.parse(
          saleDto(sale, actor, null, actor.name, [], items, tenant?.name ?? null),
        ),
      );
  } catch (error) {
    if (error instanceof DomainError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.get("/xstore/held-sales", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!canAccessPointOfSale(user)) {
    res.status(403).json({ error: "This role cannot access cashier carts." });
    return;
  }
  const tenantId = requireTenant(res, user);
  if (!tenantId) return;
  const rows = await db
    .select()
    .from(xstoreHeldSales)
    .where(
      and(
        eq(xstoreHeldSales.tenantId, tenantId),
        inArray(xstoreHeldSales.saleType, getAllowedSaleTypes(user)),
      ),
    )
    .orderBy(desc(xstoreHeldSales.createdAt));
  res.json(
    ListXStoreHeldSalesResponse.parse(
      rows.map((held) => ({
        ...held,
        estimatedTotal: toNumber(held.estimatedTotal),
        discountAmount: toNumber(held.discountAmount),
        amountReceived: toNumber(held.amountReceived),
        createdAt: iso(held.createdAt),
      })),
    ),
  );
});

router.post("/xstore/held-sales", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!canAccessPointOfSale(actor)) {
    res.status(403).json({ error: "This role cannot hold cashier carts." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const parsed = HoldXStoreSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let customerPhone: string | null = null;
  if (parsed.data.customerPhone?.trim()) {
    try {
      customerPhone = normalizePhone(parsed.data.customerPhone);
    } catch {
      res.status(400).json({ error: "Enter a valid customer phone number." });
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(customerPhone)) {
      res.status(400).json({
        error: "Include the country calling code, such as +20.",
      });
      return;
    }
  }
  const vatRate = await getTenantVatRate(tenantId);
  if (vatRate === null) {
    res.status(404).json({ error: "Store settings not found." });
    return;
  }
  const saleType = parsed.data.saleType ?? "retail";
  if (!canSellSaleType(actor, saleType)) {
    res.status(403).json({ error: "You do not have permission for this sale type." });
    return;
  }
  const [tenant] = await db
    .select({
      storeType: xstoreTenants.storeType,
      wholesaleEnabled: xstoreTenants.wholesaleEnabled,
    })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, tenantId))
    .limit(1);
  if (saleType === "wholesale" && !tenantAllowsWholesale(tenant)) {
    res.status(403).json({
      error: "Wholesale sales are not enabled for this store.",
    });
    return;
  }
  const priced: XStoreLine[] = [];
  let subtotal = 0;
  for (const line of mergedLines(parsed.data.items)) {
    const [product] = await db
      .select()
      .from(xstoreProducts)
      .where(
        and(
          eq(xstoreProducts.id, line.productId),
          eq(xstoreProducts.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!product) {
      res.status(404).json({ error: "A product in the cart was not found." });
      return;
    }
    const selectedPrice =
      saleType === "wholesale" ? product.wholesalePrice : product.price;
    if (selectedPrice === null) {
      res.status(409).json({
        error: `${product.name} has no ${saleType} price.`,
      });
      return;
    }
    priced.push({
      productId: product.id,
      quantity: line.quantity,
      unitPrice: toNumber(selectedPrice),
    });
    subtotal += toNumber(selectedPrice) * line.quantity;
  }
  subtotal = roundMoney(subtotal);
  const discountAmount = Math.min(
    subtotal,
    roundMoney(Math.max(0, parsed.data.discountAmount ?? 0)),
  );
  const taxAmount = roundMoney((subtotal - discountAmount) * vatRate);
  const estimatedTotal = roundMoney(subtotal - discountAmount + taxAmount);
  const [held] = await db
    .insert(xstoreHeldSales)
    .values({
      tenantId,
      cashierUserId: actor.id,
      reference:
        parsed.data.reference?.trim() ||
        `H-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      saleType,
      customerName: parsed.data.customerName?.trim() || null,
      customerPhone,
      items: priced,
      itemCount: priced.reduce((sum, line) => sum + line.quantity, 0),
      estimatedTotal: String(estimatedTotal),
      discountAmount: String(discountAmount),
      paymentMethod: parsed.data.paymentMethod ?? "cash",
      transferSender: parsed.data.transferSender?.trim() || null,
      amountReceived: String(roundMoney(parsed.data.amountReceived ?? 0)),
    })
    .returning();
  if (!held) {
    res.status(500).json({ error: "Unable to hold this cart." });
    return;
  }
  res.status(201).json(
    HoldXStoreSaleResponse.parse({
      ...held,
      estimatedTotal: toNumber(held.estimatedTotal),
      discountAmount: toNumber(held.discountAmount),
      amountReceived: toNumber(held.amountReceived),
      createdAt: iso(held.createdAt),
    }),
  );
});

router.delete("/xstore/held-sales/:heldSaleId", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!canAccessPointOfSale(user)) {
    res.status(403).json({ error: "This role cannot remove cashier carts." });
    return;
  }
  const tenantId = requireTenant(res, user);
  if (!tenantId) return;
  const params = ReleaseXStoreHeldSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [held] = await db
    .select({ saleType: xstoreHeldSales.saleType })
    .from(xstoreHeldSales)
    .where(
      and(
        eq(xstoreHeldSales.id, params.data.heldSaleId),
        eq(xstoreHeldSales.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (!held) {
    res.status(404).json({ error: "Held cart not found." });
    return;
  }
  if (!canSellSaleType(user, held.saleType)) {
    res.status(403).json({ error: "This role cannot access this sale type." });
    return;
  }
  await db
    .delete(xstoreHeldSales)
    .where(
      and(
        eq(xstoreHeldSales.id, params.data.heldSaleId),
        eq(xstoreHeldSales.tenantId, tenantId),
      ),
    );
  res.sendStatus(204);
});

router.post("/xstore/returns", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!canAccessPointOfSale(actor)) {
    res.status(403).json({ error: "This role cannot process returns." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const parsed = CreateXStoreReturnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .select(xstoreSaleSelectionWithoutTableNumber)
        .from(xstoreSales)
        .where(
          and(
            eq(xstoreSales.invoiceNo, parsed.data.invoiceNo),
            eq(xstoreSales.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!sale) throw new DomainError("Invoice not found.", 404);
      if (!canSellSaleType(actor, sale.saleType)) {
        throw new DomainError(
          "This role cannot process returns for this sale type.",
          403,
        );
      }
      const [saleItem] = await tx
        .select()
        .from(xstoreSaleItems)
        .where(
          and(
            eq(xstoreSaleItems.saleId, sale.id),
            eq(xstoreSaleItems.productId, parsed.data.productId),
          ),
        )
        .for("update")
        .limit(1);
      if (
        !saleItem ||
        saleItem.returnedQuantity + parsed.data.quantity > saleItem.quantity
      ) {
        throw new DomainError(
          "The return quantity exceeds the quantity on this invoice.",
          409,
        );
      }
      const originalSubtotal = toNumber(sale.subtotal);
      const discountedSubtotal = Math.max(
        0,
        originalSubtotal - toNumber(sale.discountAmount),
      );
      const discountRate =
        originalSubtotal > 0
          ? toNumber(sale.discountAmount) / originalSubtotal
          : 0;
      const taxRate =
        discountedSubtotal > 0
          ? toNumber(sale.taxAmount) / discountedSubtotal
          : 0;
      const refundAmount = roundMoney(
        toNumber(saleItem.unitPrice) *
          parsed.data.quantity *
          (1 - discountRate) *
          (1 + taxRate),
      );
      const [product] = await tx
        .select()
        .from(xstoreProducts)
        .where(
          and(
            eq(xstoreProducts.id, saleItem.productId),
            eq(xstoreProducts.tenantId, tenantId),
          ),
        )
        .for("update")
        .limit(1);
      if (!product) throw new DomainError("Product not found.", 404);

      const [returned] = await tx
        .insert(xstoreReturns)
        .values({
          saleId: sale.id,
          productId: product.id,
          quantity: parsed.data.quantity,
          refundAmount: String(refundAmount),
          costAmount: String(
            roundMoney(toNumber(saleItem.unitCost) * parsed.data.quantity),
          ),
          reason: parsed.data.reason,
        })
        .returning();
      await tx
        .update(xstoreSaleItems)
        .set({
          returnedQuantity: saleItem.returnedQuantity + parsed.data.quantity,
        })
        .where(eq(xstoreSaleItems.id, saleItem.id));
      await tx
        .update(xstoreProducts)
        .set({
          quantity: sql`${xstoreProducts.quantity} + ${parsed.data.quantity}`,
        })
        .where(eq(xstoreProducts.id, product.id));
      const allItems = await tx
        .select()
        .from(xstoreSaleItems)
        .where(eq(xstoreSaleItems.saleId, sale.id));
      const isFullyReturned = allItems.every(
        (line) =>
          line.returnedQuantity +
            (line.id === saleItem.id ? parsed.data.quantity : 0) >=
          line.quantity,
      );
      await tx
        .update(xstoreSales)
        .set({ status: isFullyReturned ? "returned" : "partially_returned" })
        .where(eq(xstoreSales.id, sale.id));
      if (!returned) throw new DomainError("Unable to record this return.", 500);
      return returned;
    });
    await audit(
      actor,
      "sale.returned",
      tenantId,
      "sale",
      parsed.data.invoiceNo,
      `Returned ${parsed.data.quantity} unit(s) from ${parsed.data.invoiceNo}`,
    );
    res.status(201).json(
      CreateXStoreReturnResponse.parse({
        id: result.id,
        invoiceNo: parsed.data.invoiceNo,
        productId: result.productId,
        quantity: result.quantity,
        refundAmount: toNumber(result.refundAmount),
        createdAt: iso(result.createdAt),
      }),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.post("/xstore/returns/batch", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!canAccessPointOfSale(actor)) {
    res.status(403).json({ error: "This role cannot process returns." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const parsed = CreateXStoreReturnBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .select(xstoreSaleSelectionWithoutTableNumber)
        .from(xstoreSales)
        .where(
          and(
            eq(xstoreSales.invoiceNo, parsed.data.invoiceNo),
            eq(xstoreSales.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!sale) throw new DomainError("Invoice not found.", 404);
      if (!canSellSaleType(actor, sale.saleType)) {
        throw new DomainError(
          "This role cannot process returns for this sale type.",
          403,
        );
      }

      const originalSubtotal = toNumber(sale.subtotal);
      const discountedSubtotal = Math.max(
        0,
        originalSubtotal - toNumber(sale.discountAmount),
      );
      const discountRate =
        originalSubtotal > 0
          ? toNumber(sale.discountAmount) / originalSubtotal
          : 0;
      const taxRate =
        discountedSubtotal > 0
          ? toNumber(sale.taxAmount) / discountedSubtotal
          : 0;
      const returnedItems: Array<{
        productId: string;
        quantity: number;
        refundAmount: number;
      }> = [];
      let createdAt: Date | null = null;

      for (const line of mergedLines(parsed.data.items).sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        const [saleItem] = await tx
          .select()
          .from(xstoreSaleItems)
          .where(
            and(
              eq(xstoreSaleItems.saleId, sale.id),
              eq(xstoreSaleItems.productId, line.productId),
            ),
          )
          .for("update")
          .limit(1);
        if (
          !saleItem ||
          saleItem.returnedQuantity + line.quantity > saleItem.quantity
        ) {
          throw new DomainError(
            "The return quantity exceeds the quantity on this invoice.",
            409,
          );
        }

        const [product] = await tx
          .select()
          .from(xstoreProducts)
          .where(
            and(
              eq(xstoreProducts.id, line.productId),
              eq(xstoreProducts.tenantId, tenantId),
            ),
          )
          .for("update")
          .limit(1);
        if (!product) throw new DomainError("Product not found.", 404);

        const refundAmount = roundMoney(
          toNumber(saleItem.unitPrice) *
            line.quantity *
            (1 - discountRate) *
            (1 + taxRate),
        );
        const costAmount = roundMoney(
          toNumber(saleItem.unitCost) * line.quantity,
        );
        const [createdReturn] = await tx
          .insert(xstoreReturns)
          .values({
            saleId: sale.id,
            productId: product.id,
            quantity: line.quantity,
            refundAmount: String(refundAmount),
            costAmount: String(costAmount),
            reason: parsed.data.reason,
          })
          .returning({ createdAt: xstoreReturns.createdAt });
        if (!createdReturn) {
          throw new DomainError("Unable to record this return.", 500);
        }
        createdAt ??= createdReturn.createdAt;
        await tx
          .update(xstoreSaleItems)
          .set({
            returnedQuantity: saleItem.returnedQuantity + line.quantity,
          })
          .where(eq(xstoreSaleItems.id, saleItem.id));
        await tx
          .update(xstoreProducts)
          .set({ quantity: sql`${xstoreProducts.quantity} + ${line.quantity}` })
          .where(eq(xstoreProducts.id, product.id));
        returnedItems.push({
          productId: product.id,
          quantity: line.quantity,
          refundAmount,
        });
      }

      const allItems = await tx
        .select()
        .from(xstoreSaleItems)
        .where(eq(xstoreSaleItems.saleId, sale.id));
      const isFullyReturned = allItems.every(
        (line) => line.returnedQuantity >= line.quantity,
      );
      await tx
        .update(xstoreSales)
        .set({ status: isFullyReturned ? "returned" : "partially_returned" })
        .where(eq(xstoreSales.id, sale.id));

      return {
        items: returnedItems,
        refundAmount: roundMoney(
          returnedItems.reduce((sum, item) => sum + item.refundAmount, 0),
        ),
        createdAt: createdAt ?? new Date(),
      };
    });
    await audit(
      actor,
      "sale.returned",
      tenantId,
      "sale",
      parsed.data.invoiceNo,
      `Returned ${result.items.reduce((sum, item) => sum + item.quantity, 0)} unit(s) from ${parsed.data.invoiceNo}`,
    );
    res.status(201).json(
      CreateXStoreReturnBatchResponse.parse({
        invoiceNo: parsed.data.invoiceNo,
        items: result.items,
        refundAmount: result.refundAmount,
        createdAt: iso(result.createdAt),
      }),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.post("/xstore/exchanges", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!canAccessPointOfSale(actor)) {
    res.status(403).json({ error: "This role cannot process exchanges." });
    return;
  }
  const tenantId = requireTenant(res, actor);
  if (!tenantId) return;
  const parsed = CreateXStoreExchangeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const vatRate = await getTenantVatRate(tenantId);
  if (vatRate === null) {
    res.status(404).json({ error: "Store settings not found." });
    return;
  }
  try {
    const exchange = await db.transaction(async (tx) => {
      const [original] = await tx
        .select(xstoreSaleSelectionWithoutTableNumber)
        .from(xstoreSales)
        .where(
          and(
            eq(xstoreSales.invoiceNo, parsed.data.invoiceNo),
            eq(xstoreSales.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!original) throw new DomainError("Invoice not found.", 404);
      if (!canSellSaleType(actor, original.saleType)) {
        throw new DomainError(
          "This role cannot process exchanges for this sale type.",
          403,
        );
      }

      let refundAmount = 0;
      const returnedItems: XStoreExchangeEvent["returnedItems"] = [];
      for (const line of mergedLines(parsed.data.returnItems)) {
        const [saleItem] = await tx
          .select()
          .from(xstoreSaleItems)
          .where(
            and(
              eq(xstoreSaleItems.saleId, original.id),
              eq(xstoreSaleItems.productId, line.productId),
            ),
          )
          .for("update")
          .limit(1);
        if (
          !saleItem ||
          saleItem.returnedQuantity + line.quantity > saleItem.quantity
        ) {
          throw new DomainError(
            "The exchange return exceeds the quantity on this invoice.",
            409,
          );
        }
        const [product] = await tx
          .select()
          .from(xstoreProducts)
          .where(
            and(
              eq(xstoreProducts.id, line.productId),
              eq(xstoreProducts.tenantId, tenantId),
            ),
          )
          .for("update")
          .limit(1);
        if (!product) throw new DomainError("Product not found.", 404);
        const originalSubtotal = toNumber(original.subtotal);
        const discountedSubtotal = Math.max(
          0,
          originalSubtotal - toNumber(original.discountAmount),
        );
        const discountRate =
          originalSubtotal > 0
            ? toNumber(original.discountAmount) / originalSubtotal
            : 0;
        const taxRate =
          discountedSubtotal > 0
            ? toNumber(original.taxAmount) / discountedSubtotal
            : 0;
        const lineRefund = roundMoney(
          toNumber(saleItem.unitPrice) *
            line.quantity *
            (1 - discountRate) *
            (1 + taxRate),
        );
        refundAmount += lineRefund;
        returnedItems.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: line.quantity,
        });
        await tx
          .update(xstoreSaleItems)
          .set({
            returnedQuantity: saleItem.returnedQuantity + line.quantity,
          })
          .where(eq(xstoreSaleItems.id, saleItem.id));
        await tx
          .update(xstoreProducts)
          .set({ quantity: sql`${xstoreProducts.quantity} + ${line.quantity}` })
          .where(eq(xstoreProducts.id, product.id));
        await tx.insert(xstoreReturns).values({
          saleId: original.id,
          productId: product.id,
          quantity: line.quantity,
          refundAmount: String(lineRefund),
          costAmount: String(
            roundMoney(toNumber(saleItem.unitCost) * line.quantity),
          ),
          reason: "Exchange",
        });
      }

      const allOriginalLines = await tx
        .select()
        .from(xstoreSaleItems)
        .where(eq(xstoreSaleItems.saleId, original.id));
      const originalFullyReturned = allOriginalLines.every(
        (line) => line.returnedQuantity >= line.quantity,
      );
      await tx
        .update(xstoreSales)
        .set({
          status: originalFullyReturned ? "returned" : "partially_returned",
        })
        .where(eq(xstoreSales.id, original.id));

      const replacementLines: Array<{
        product: XStoreProduct;
        quantity: number;
        unitPrice: number;
      }> = [];
      for (const line of mergedLines(parsed.data.replacementItems)) {
        const [product] = await tx
          .select()
          .from(xstoreProducts)
          .where(
            and(
              eq(xstoreProducts.id, line.productId),
              eq(xstoreProducts.tenantId, tenantId),
            ),
          )
          .for("update")
          .limit(1);
        if (!product) throw new DomainError("Replacement product not found.", 404);
        if (product.quantity < line.quantity) {
          throw new DomainError(`Not enough stock for ${product.name}.`, 409);
        }
        const selectedPrice =
          original.saleType === "wholesale"
            ? product.wholesalePrice
            : product.price;
        if (selectedPrice === null) {
          throw new DomainError(
            `${product.name} has no ${original.saleType} price.`,
            409,
          );
        }
        replacementLines.push({
          product,
          quantity: line.quantity,
          unitPrice: toNumber(selectedPrice),
        });
      }
      const subtotal = roundMoney(
        replacementLines.reduce(
          (sum, line) => sum + line.unitPrice * line.quantity,
          0,
        ),
      );
      const discount = Math.min(subtotal, parsed.data.discountAmount);
      const tax = roundMoney((subtotal - discount) * vatRate);
      const replacementTotal = roundMoney(subtotal - discount + tax);
      const balanceDue = roundMoney(replacementTotal - refundAmount);
      const amountReceived =
        parsed.data.paymentMethod === "cash"
          ? balanceDue > 0
            ? roundMoney(parsed.data.amountReceived)
            : 0
          : Math.max(0, balanceDue);
      if (
        parsed.data.paymentMethod === "cash" &&
        amountReceived < Math.max(0, balanceDue)
      ) {
        throw new DomainError(
          "Enter the cash amount received and make sure it covers the balance due.",
          400,
        );
      }
      const changeAmount =
        balanceDue < 0
          ? roundMoney(Math.abs(balanceDue))
          : roundMoney(
              Math.max(0, amountReceived - Math.max(0, balanceDue)),
            );
      const exchangeInvoiceNo = invoiceNumber();
      if (replacementLines.length) {
        const [replacementSale] = await tx
          .insert(xstoreSales)
          .values({
            tenantId,
            cashierUserId: actor.id,
            invoiceNo: exchangeInvoiceNo,
            saleType: original.saleType,
            itemCount: replacementLines.reduce(
              (sum, line) => sum + line.quantity,
              0,
            ),
            subtotal: String(subtotal),
            discountAmount: String(roundMoney(discount)),
            taxAmount: String(tax),
            total: String(replacementTotal),
            paymentMethod: parsed.data.paymentMethod,
            amountReceived: String(amountReceived),
            changeAmount: String(changeAmount),
            status: "completed",
          })
          .returning({ id: xstoreSales.id });
        if (!replacementSale) {
          throw new DomainError("Unable to complete the replacement sale.", 500);
        }
        for (const line of replacementLines) {
          await tx
            .update(xstoreProducts)
            .set({ quantity: sql`${xstoreProducts.quantity} - ${line.quantity}` })
            .where(eq(xstoreProducts.id, line.product.id));
          await tx.insert(xstoreSaleItems).values({
            saleId: replacementSale.id,
            productId: line.product.id,
            productName: line.product.name,
            quantity: line.quantity,
            unitPrice: String(line.unitPrice),
            unitCost: String(toNumber(line.product.costPrice)),
          });
        }
      }
      return {
        originalInvoiceNo: original.invoiceNo,
        exchangeInvoiceNo,
        returnedItems,
        replacementItems: replacementLines.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity,
        })),
        refundAmount: roundMoney(refundAmount),
        replacementTotal,
        balanceDue,
        changeAmount,
        createdAt: new Date(),
      };
    });
    await audit(
      actor,
      "sale.exchange",
      tenantId,
      "sale",
      exchange.exchangeInvoiceNo,
      JSON.stringify({
        originalInvoiceNo: exchange.originalInvoiceNo,
        returnedItems: exchange.returnedItems,
        replacementItems: exchange.replacementItems,
        refundAmount: exchange.refundAmount,
        replacementTotal: exchange.replacementTotal,
        balanceDue: exchange.balanceDue,
      }),
    );
    res.status(201).json(
      CreateXStoreExchangeResponse.parse({
        ...exchange,
        createdAt: iso(exchange.createdAt),
      }),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.get("/xstore/audit-logs", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (user.role !== "platform_admin") {
    res.status(403).json({ error: "You cannot view this audit log." });
    return;
  }
  const rows = await db
    .select({
      id: xstoreAuditLogs.id,
      actorName: xstoreAuditLogs.actorName,
      action: xstoreAuditLogs.action,
      tenantName: xstoreTenants.name,
      entityType: xstoreAuditLogs.entityType,
      entityId: xstoreAuditLogs.entityId,
      details: xstoreAuditLogs.details,
      createdAt: xstoreAuditLogs.createdAt,
    })
    .from(xstoreAuditLogs)
    .leftJoin(xstoreTenants, eq(xstoreAuditLogs.tenantId, xstoreTenants.id))
    .where(
      user.role === "platform_admin"
        ? undefined
        : eq(xstoreAuditLogs.tenantId, user.tenantId!),
    )
    .orderBy(desc(xstoreAuditLogs.createdAt))
    .limit(200);
  res.json(
    ListXStoreAuditLogsResponse.parse(
      rows.map((log) => ({
        ...log,
        tenantName: log.tenantName ?? null,
        entityId: log.entityId ?? null,
        createdAt: iso(log.createdAt),
      })),
    ),
  );
});

export default router;
