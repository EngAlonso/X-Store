import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type XStoreLine = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export const xstoreTenants = pgTable("xstore_tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  businessType: text("business_type").notNull(),
  currency: text("currency").notNull().default("SAR"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0.15"),
  status: text("status").notNull().default("trial"),
  plan: text("plan").notNull().default("monthly"),
  subscriptionEndsAt: date("subscription_ends_at", { mode: "string" }),
  branchCount: integer("branch_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const xstoreUsers = pgTable(
  "xstore_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").unique(),
    email: text("email"),
    phone: text("phone").unique(),
    passwordHash: text("password_hash"),
    sessionVersion: integer("session_version").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    name: text("name").notNull(),
    role: text("role").notNull(),
    tenantId: uuid("tenant_id").references(() => xstoreTenants.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("xstore_users_tenant_idx").on(table.tenantId),
    index("xstore_users_email_idx").on(table.email),
  ],
);

export const xstoreTeamMembers = pgTable(
  "xstore_team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => xstoreTenants.id, { onDelete: "cascade" }),
    phone: text("phone"),
    email: text("email"),
    name: text("name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("invited"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("xstore_team_members_tenant_phone_idx").on(
      table.tenantId,
      table.phone,
    ),
    index("xstore_team_members_email_idx").on(table.email),
  ],
);

export const xstorePlatformSettings = pgTable("xstore_platform_settings", {
  id: text("id").primaryKey().default("global"),
  supportPhone: text("support_phone"),
  supportWhatsapp: text("support_whatsapp"),
  supportEmail: text("support_email"),
  socialLinks: jsonb("social_links")
    .$type<XStoreSocialLinks>()
    .notNull()
    .default({
      facebook: null,
      instagram: null,
      tiktok: null,
      snapchat: null,
      x: null,
      youtube: null,
      linkedin: null,
      telegram: null,
      threads: null,
      pinterest: null,
    }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type XStoreSocialLinks = {
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  snapchat: string | null;
  x: string | null;
  youtube: string | null;
  linkedin: string | null;
  telegram: string | null;
  threads: string | null;
  pinterest: string | null;
};

export const xstoreSubscriptionPayments = pgTable(
  "xstore_subscription_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => xstoreTenants.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    plan: text("plan").notNull(),
    paymentMethod: text("payment_method").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("xstore_subscription_payments_tenant_idx").on(table.tenantId),
    index("xstore_subscription_payments_created_idx").on(table.createdAt),
  ],
);

export const xstoreProducts = pgTable(
  "xstore_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => xstoreTenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    category: text("category").notNull(),
    price: numeric("price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    quantity: integer("quantity").notNull().default(0),
    color: text("color"),
    size: text("size"),
    partNumber: text("part_number"),
    expiresAt: date("expires_at", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("xstore_products_tenant_sku_idx").on(
      table.tenantId,
      table.sku,
    ),
    index("xstore_products_tenant_category_idx").on(
      table.tenantId,
      table.category,
    ),
    index("xstore_products_tenant_barcode_idx").on(
      table.tenantId,
      table.barcode,
    ),
  ],
);

export const xstoreSales = pgTable(
  "xstore_sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => xstoreTenants.id, { onDelete: "cascade" }),
    cashierUserId: uuid("cashier_user_id")
      .notNull()
      .references(() => xstoreUsers.id),
    invoiceNo: text("invoice_no").notNull(),
    customerPhone: text("customer_phone"),
    itemCount: integer("item_count").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),
    amountReceived: numeric("amount_received", {
      precision: 12,
      scale: 2,
    }).notNull(),
    changeAmount: numeric("change_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("xstore_sales_tenant_invoice_idx").on(
      table.tenantId,
      table.invoiceNo,
    ),
    index("xstore_sales_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
  ],
);

export const xstoreSaleItems = pgTable(
  "xstore_sale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => xstoreSales.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => xstoreProducts.id),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    returnedQuantity: integer("returned_quantity").notNull().default(0),
  },
  (table) => [
    index("xstore_sale_items_sale_idx").on(table.saleId),
    index("xstore_sale_items_product_idx").on(table.productId),
  ],
);

export const xstoreHeldSales = pgTable(
  "xstore_held_sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => xstoreTenants.id, { onDelete: "cascade" }),
    cashierUserId: uuid("cashier_user_id")
      .notNull()
      .references(() => xstoreUsers.id),
    reference: text("reference").notNull(),
    customerName: text("customer_name"),
    items: jsonb("items").$type<XStoreLine[]>().notNull(),
    itemCount: integer("item_count").notNull(),
    estimatedTotal: numeric("estimated_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("xstore_held_sales_tenant_idx").on(table.tenantId)],
);

export const xstoreReturns = pgTable(
  "xstore_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => xstoreSales.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => xstoreProducts.id),
    quantity: integer("quantity").notNull(),
    refundAmount: numeric("refund_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    costAmount: numeric("cost_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("xstore_returns_sale_idx").on(table.saleId)],
);

export const xstoreAuditLogs = pgTable(
  "xstore_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => xstoreUsers.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    tenantId: uuid("tenant_id").references(() => xstoreTenants.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: text("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("xstore_audit_created_idx").on(table.createdAt)],
);

export const insertXStoreTenantSchema = createInsertSchema(xstoreTenants).omit({
  id: true,
  createdAt: true,
});
export const insertXStoreProductSchema = createInsertSchema(
  xstoreProducts,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertXStoreSaleSchema = createInsertSchema(xstoreSales).omit({
  id: true,
  createdAt: true,
});

export type InsertXStoreTenant = z.infer<typeof insertXStoreTenantSchema>;
export type InsertXStoreProduct = z.infer<typeof insertXStoreProductSchema>;
export type InsertXStoreSale = z.infer<typeof insertXStoreSaleSchema>;
export type XStoreTenant = typeof xstoreTenants.$inferSelect;
export type XStoreUser = typeof xstoreUsers.$inferSelect;
export type XStoreTeamMember = typeof xstoreTeamMembers.$inferSelect;
export type XStoreSubscriptionPayment =
  typeof xstoreSubscriptionPayments.$inferSelect;
export type XStoreProduct = typeof xstoreProducts.$inferSelect;
export type XStoreSale = typeof xstoreSales.$inferSelect;
export type XStoreSaleItem = typeof xstoreSaleItems.$inferSelect;
export type XStoreHeldSale = typeof xstoreHeldSales.$inferSelect;
export type XStoreReturn = typeof xstoreReturns.$inferSelect;
export type XStoreAuditLog = typeof xstoreAuditLogs.$inferSelect;
