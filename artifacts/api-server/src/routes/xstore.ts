import { clerkClient } from "@clerk/express";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
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
  CreateXStoreSubscriptionPaymentBody,
  CreateXStoreSubscriptionPaymentResponse,
  CreateXStoreTenantBody,
  CreateXStoreTenantResponse,
  GetXStoreDashboardResponse,
  GetXStoreProfitLossReportQueryParams,
  GetXStoreProfitLossReportResponse,
  GetXStoreSessionResponse,
  HoldXStoreSaleBody,
  HoldXStoreSaleResponse,
  ListXStoreAuditLogsResponse,
  ListXStoreHeldSalesResponse,
  ListXStoreProductsQueryParams,
  ListXStoreProductsResponse,
  ListXStoreSalesQueryParams,
  ListXStoreSalesResponse,
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
} from "@workspace/api-zod";
import {
  db,
  xstoreAuditLogs,
  xstoreHeldSales,
  xstoreProducts,
  xstoreReturns,
  xstoreSaleItems,
  xstoreSales,
  xstoreSubscriptionPayments,
  xstoreTeamMembers,
  xstoreTenants,
  xstoreUsers,
  type XStoreLine,
  type XStoreProduct,
  type XStoreTenant,
} from "@workspace/db";
import { getXStoreUser, hasRole, requireXStoreUser } from "../middlewares/xstoreAuth";

const router: IRouter = Router();
const platformAdmin = ["platform_admin"] as const;
const tenantManagers = ["tenant_admin"] as const;
const inventoryEditors = ["platform_admin", "tenant_admin", "warehouse_manager"] as const;
const cashierRoles = ["platform_admin", "tenant_admin", "cashier"] as const;
const reportRoles = ["platform_admin", "tenant_admin", "accountant"] as const;
const saleHistoryRoles = [
  "platform_admin",
  "tenant_admin",
  "cashier",
  "accountant",
] as const;

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

function saleDto(
  sale: typeof xstoreSales.$inferSelect,
  role: string,
  grossProfit: number | null = null,
) {
  return {
    ...sale,
    subtotal: toNumber(sale.subtotal),
    discountAmount: toNumber(sale.discountAmount),
    taxAmount: toNumber(sale.taxAmount),
    total: toNumber(sale.total),
    grossProfit: role === "cashier" ? null : grossProfit,
    amountReceived: toNumber(sale.amountReceived),
    changeAmount: toNumber(sale.changeAmount),
    createdAt: iso(sale.createdAt),
  };
}

function productDto(product: XStoreProduct, role?: string) {
  return {
    ...product,
    price: role === "warehouse_manager" ? 0 : toNumber(product.price),
    costPrice:
      role === "cashier" || role === "warehouse_manager"
        ? null
        : toNumber(product.costPrice),
    barcode: product.barcode ?? null,
    color: product.color ?? null,
    size: product.size ?? null,
    partNumber: product.partNumber ?? null,
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

router.use("/xstore", requireXStoreUser);

router.get("/xstore/session", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  const [tenant] = user.tenantId
    ? await db
        .select({ name: xstoreTenants.name })
        .from(xstoreTenants)
        .where(eq(xstoreTenants.id, user.tenantId))
        .limit(1)
    : [];
  res.json(
    GetXStoreSessionResponse.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: tenant?.name ?? null,
    }),
  );
});

router.get("/xstore/dashboard", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  const isPlatformAdmin = user.role === "platform_admin";
  const isFinancial = hasRole(user, reportRoles);
  const tenantWhere = user.tenantId
    ? eq(xstoreTenants.id, user.tenantId)
    : undefined;
  const productWhere = user.tenantId
    ? eq(xstoreProducts.tenantId, user.tenantId)
    : undefined;
  const saleWhere = user.tenantId
    ? eq(xstoreSales.tenantId, user.tenantId)
    : undefined;
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
        .select()
        .from(xstoreSales)
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
    latestSales: latestSales.map((sale) => saleDto(sale, user.role)),
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
  const requestedEnd = dbDate(input.subscriptionEndsAt);
  const subscriptionEndsAt =
    requestedEnd === undefined
      ? planEndDate(input.plan, new Date())
      : requestedEnd;
  const [tenant] = await db
    .insert(xstoreTenants)
    .values({
      name: input.name,
      ownerName: input.ownerName,
      email: input.email.trim().toLowerCase(),
      businessType: input.businessType,
      status: "trial",
      plan: input.plan,
      subscriptionEndsAt,
      branchCount: 1,
    })
    .returning();
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
    res.status(403).json({ error: "Only the platform owner can change subscriptions." });
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
  const update = {
    ...parsed.data,
    subscriptionEndsAt: dbDate(parsed.data.subscriptionEndsAt),
  };
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
    `Updated status or subscription for ${tenant.name}`,
  );
  res.json(UpdateXStoreTenantResponse.parse(tenantDto(tenant)));
});

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
  const email = memberInput.email.trim().toLowerCase();
  const [existingAccount] = await db
    .select()
    .from(xstoreUsers)
    .where(ilike(xstoreUsers.email, email))
    .limit(1);
  if (
    existingAccount &&
    (existingAccount.role === "platform_admin" ||
      existingAccount.role === "tenant_admin" ||
      existingAccount.tenantId !== actor.tenantId)
  ) {
    res.status(409).json({
      error: "This email already belongs to another X-Store account.",
    });
    return;
  }
  const [member] = await db
    .insert(xstoreTeamMembers)
    .values({
      tenantId: actor.tenantId,
      email,
      name: memberInput.name,
      role: memberInput.role,
      status: "invited",
    })
    .onConflictDoUpdate({
      target: [xstoreTeamMembers.tenantId, xstoreTeamMembers.email],
      set: { name: memberInput.name, role: memberInput.role },
    })
    .returning();
  if (!member) {
    res.status(500).json({ error: "Unable to add this team member." });
    return;
  }
  await db
    .update(xstoreUsers)
    .set({ name: member.name, role: member.role, tenantId: actor.tenantId })
    .where(
      and(
        eq(xstoreUsers.tenantId, actor.tenantId),
        ilike(xstoreUsers.email, email),
      ),
    );
  await audit(
    actor,
    "team.role_assigned",
    actor.tenantId,
    "team_member",
    member.id,
    `${member.email} assigned ${member.role}`,
  );
  res
    .status(201)
    .json(AddXStoreTeamMemberResponse.parse({ ...member, createdAt: iso(member.createdAt) }));
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
      rows.map((product) => productDto(product, user.role)),
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
  if (
    actor.role === "warehouse_manager" &&
    ((parsed.data.price !== undefined && parsed.data.price !== 0) ||
      (parsed.data.costPrice !== undefined && parsed.data.costPrice !== 0))
  ) {
    res.status(403).json({
      error: "Warehouse managers can add stock but cannot set selling prices.",
    });
    return;
  }
  const [product] = await db
    .insert(xstoreProducts)
    .values({
      ...parsed.data,
      tenantId,
      price: String(actor.role === "warehouse_manager" ? 0 : parsed.data.price),
      costPrice: String(
        actor.role === "warehouse_manager" ? 0 : (parsed.data.costPrice ?? 0),
      ),
      barcode: parsed.data.barcode ?? null,
      color: parsed.data.color ?? null,
      size: parsed.data.size ?? null,
      partNumber: parsed.data.partNumber ?? null,
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
      CreateXStoreProductResponse.parse(productDto(product, actor.role)),
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
  if (
    actor.role === "warehouse_manager" &&
    Object.keys(parsed.data).some((key) => key !== "quantity")
  ) {
    res.status(403).json({
      error: "Warehouse managers can only adjust product quantities.",
    });
    return;
  }
  const clauses = [eq(xstoreProducts.id, params.data.productId)];
  if (actor.role !== "platform_admin" && actor.tenantId) {
    clauses.push(eq(xstoreProducts.tenantId, actor.tenantId));
  }
  const update = {
    ...parsed.data,
    price:
      parsed.data.price === undefined ? undefined : String(parsed.data.price),
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
    UpdateXStoreProductResponse.parse(productDto(product, actor.role)),
  );
});

router.get("/xstore/sales", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!hasRole(user, saleHistoryRoles)) {
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
    .select()
    .from(xstoreSales)
    .where(scopedTenant ? eq(xstoreSales.tenantId, scopedTenant) : undefined)
    .orderBy(desc(xstoreSales.createdAt))
    .limit(parsed.data.limit ?? 50);
  const saleIds = rows.map((sale) => sale.id);
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
  res.json(
    ListXStoreSalesResponse.parse(
      rows.map((sale) =>
        saleDto(
          sale,
          user.role,
          roundMoney(
            toNumber(sale.subtotal) -
              toNumber(sale.discountAmount) -
              (refunds.get(sale.id) ?? 0) -
              (costs.get(sale.id) ?? 0),
          ),
        ),
      ),
    ),
  );
});

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
  if (!hasRole(actor, cashierRoles)) {
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
  try {
    const sale = await db.transaction(async (tx) => {
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
        priced.push({
          product,
          quantity: line.quantity,
          unitPrice: toNumber(product.price),
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
        (subtotal - discountAmount) * parsed.data.vatRate,
      );
      const total = roundMoney(subtotal - discountAmount + taxAmount);
      if (
        parsed.data.paymentMethod === "cash" &&
        parsed.data.amountReceived < total
      ) {
        throw new DomainError("The amount received is less than the total.", 400);
      }
      const [createdSale] = await tx
        .insert(xstoreSales)
        .values({
          tenantId,
          cashierUserId: actor.id,
          invoiceNo: invoiceNumber(),
          itemCount: priced.reduce((sum, line) => sum + line.quantity, 0),
          subtotal: String(subtotal),
          discountAmount: String(discountAmount),
          taxAmount: String(taxAmount),
          total: String(total),
          paymentMethod: parsed.data.paymentMethod,
          amountReceived: String(parsed.data.amountReceived),
          changeAmount: String(
            roundMoney(Math.max(0, parsed.data.amountReceived - total)),
          ),
          status: "completed",
        })
        .returning();
      if (!createdSale) throw new DomainError("Unable to complete this sale.", 500);
      for (const line of priced) {
        await tx
          .update(xstoreProducts)
          .set({ quantity: sql`${xstoreProducts.quantity} - ${line.quantity}` })
          .where(eq(xstoreProducts.id, line.product.id));
        await tx.insert(xstoreSaleItems).values({
          saleId: createdSale.id,
          productId: line.product.id,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          unitCost: String(toNumber(line.product.costPrice)),
        });
      }
      return createdSale;
    });
    res
      .status(201)
      .json(CheckoutXStoreSaleResponse.parse(saleDto(sale, actor.role)));
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
  if (!hasRole(user, cashierRoles)) {
    res.status(403).json({ error: "This role cannot access cashier carts." });
    return;
  }
  const tenantId = requireTenant(res, user);
  if (!tenantId) return;
  const rows = await db
    .select()
    .from(xstoreHeldSales)
    .where(eq(xstoreHeldSales.tenantId, tenantId))
    .orderBy(desc(xstoreHeldSales.createdAt));
  res.json(
    ListXStoreHeldSalesResponse.parse(
      rows.map((held) => ({
        ...held,
        estimatedTotal: toNumber(held.estimatedTotal),
        createdAt: iso(held.createdAt),
      })),
    ),
  );
});

router.post("/xstore/held-sales", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!hasRole(actor, cashierRoles)) {
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
  const priced: XStoreLine[] = [];
  let estimatedTotal = 0;
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
    priced.push({
      productId: product.id,
      quantity: line.quantity,
      unitPrice: toNumber(product.price),
    });
    estimatedTotal += toNumber(product.price) * line.quantity;
  }
  const [held] = await db
    .insert(xstoreHeldSales)
    .values({
      tenantId,
      cashierUserId: actor.id,
      reference: `H-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      customerName: parsed.data.customerName ?? null,
      items: priced,
      itemCount: priced.reduce((sum, line) => sum + line.quantity, 0),
      estimatedTotal: String(roundMoney(estimatedTotal)),
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
      createdAt: iso(held.createdAt),
    }),
  );
});

router.delete("/xstore/held-sales/:heldSaleId", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!hasRole(user, cashierRoles)) {
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
    .delete(xstoreHeldSales)
    .where(
      and(
        eq(xstoreHeldSales.id, params.data.heldSaleId),
        eq(xstoreHeldSales.tenantId, tenantId),
      ),
    )
    .returning({ id: xstoreHeldSales.id });
  if (!held) {
    res.status(404).json({ error: "Held cart not found." });
    return;
  }
  res.sendStatus(204);
});

router.post("/xstore/returns", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!hasRole(actor, cashierRoles)) {
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
        .select()
        .from(xstoreSales)
        .where(
          and(
            eq(xstoreSales.invoiceNo, parsed.data.invoiceNo),
            eq(xstoreSales.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!sale) throw new DomainError("Invoice not found.", 404);
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

router.post("/xstore/exchanges", async (req, res): Promise<void> => {
  const actor = getXStoreUser(res);
  if (!hasRole(actor, cashierRoles)) {
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
  try {
    const exchange = await db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(xstoreSales)
        .where(
          and(
            eq(xstoreSales.invoiceNo, parsed.data.invoiceNo),
            eq(xstoreSales.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!original) throw new DomainError("Invoice not found.", 404);

      let refundAmount = 0;
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
        replacementLines.push({
          product,
          quantity: line.quantity,
          unitPrice: toNumber(product.price),
        });
      }
      const subtotal = roundMoney(
        replacementLines.reduce(
          (sum, line) => sum + line.unitPrice * line.quantity,
          0,
        ),
      );
      const discount = Math.min(subtotal, parsed.data.discountAmount);
      const tax = roundMoney((subtotal - discount) * parsed.data.vatRate);
      const replacementTotal = roundMoney(subtotal - discount + tax);
      const balanceDue = roundMoney(replacementTotal - refundAmount);
      const changeAmount =
        balanceDue < 0
          ? roundMoney(Math.abs(balanceDue))
          : roundMoney(
              Math.max(0, parsed.data.amountReceived - Math.max(0, balanceDue)),
            );
      const exchangeInvoiceNo = invoiceNumber();
      if (replacementLines.length) {
        const [replacementSale] = await tx
          .insert(xstoreSales)
          .values({
            tenantId,
            cashierUserId: actor.id,
            invoiceNo: exchangeInvoiceNo,
            itemCount: replacementLines.reduce(
              (sum, line) => sum + line.quantity,
              0,
            ),
            subtotal: String(subtotal),
            discountAmount: String(roundMoney(discount)),
            taxAmount: String(tax),
            total: String(replacementTotal),
            paymentMethod: parsed.data.paymentMethod,
            amountReceived: String(parsed.data.amountReceived),
            changeAmount: String(changeAmount),
            status: "completed",
          })
          .returning();
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
            quantity: line.quantity,
            unitPrice: String(line.unitPrice),
            unitCost: String(toNumber(line.product.costPrice)),
          });
        }
      }
      return {
        originalInvoiceNo: original.invoiceNo,
        exchangeInvoiceNo,
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
      `Exchange for ${exchange.originalInvoiceNo}`,
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
  if (
    !hasRole(user, ["platform_admin", "tenant_admin"]) ||
    (!user.tenantId && user.role !== "platform_admin")
  ) {
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
