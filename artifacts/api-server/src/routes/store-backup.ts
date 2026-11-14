import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  xstoreHeldSales,
  xstoreProducts,
  xstoreReturns,
  xstoreSaleItems,
  xstoreSales,
} from "@workspace/db";
import { getXStoreUser, denyRole, requireXStoreUser } from "../middlewares/xstoreAuth";

const router = Router();

const { tableNumber: _xstoreTableNumber, ...xstoreSaleColumnsWithoutTableNumber } =
  getColumns(xstoreSales);
const xstoreSaleSelectionWithoutTableNumber = {
  ...xstoreSaleColumnsWithoutTableNumber,
  tableNumber: sql<string | null>`NULL`.as("table_number"),
};
const MEDIA_TYPE = "application/vnd.xstore.store-backup+json";
const MAX_BYTES = 64 * 1024 * 1024;
const TABLES = ["xstore_products","xstore_sales","xstore_sale_items","xstore_held_sales","xstore_returns"] as const;
type BackupType = "full" | "invoices" | "inventory";
type BackupTables = {
  xstore_products: unknown[]; xstore_sales: unknown[]; xstore_sale_items: unknown[];
  xstore_held_sales: unknown[]; xstore_returns: unknown[];
};

function validateBackup(value: any, tenantId: string): asserts value is {
  format: "xstore-store-backup"; version: 2; backupType: BackupType; tenantId: string;
  createdAt: string; tables: BackupTables;
} {
  if (!value || value.format !== "xstore-store-backup" || value.version !== 2 ||
      !["full","invoices","inventory"].includes(value.backupType) ||
      value.tenantId !== tenantId || typeof value.createdAt !== "string" ||
      !value.tables || typeof value.tables !== "object") {
    throw new Error("ملف النسخة الاحتياطية غير صالح أو يخص متجرًا آخر.");
  }
  for (const table of TABLES) {
    if (!Array.isArray(value.tables[table])) throw new Error("النسخة غير مكتملة ولا تحتوي جميع بيانات المتجر.");
  }
}

router.use("/xstore/store-backup", requireXStoreUser, (req, res, next) => {
  const user = getXStoreUser(res);
  if (denyRole(res, user, ["tenant_admin"])) return;
  next();
});

router.get("/xstore/store-backup", async (req, res) => {
  const tenantId = getXStoreUser(res).tenantId;
  if (!tenantId) return res.status(400).json({ error: "حساب المتجر غير مرتبط بمتجر." });
  const backupType = (req.query.type === "invoices" || req.query.type === "inventory" ? req.query.type : "full") as BackupType;

  try {
    const emptyProducts: (typeof xstoreProducts.$inferSelect)[] = [];
    const emptySales: (typeof xstoreSales.$inferSelect)[] = [];
    const emptyHeldSales: (typeof xstoreHeldSales.$inferSelect)[] = [];
    const emptySaleItems: (typeof xstoreSaleItems.$inferSelect)[] = [];
    const emptyReturns: (typeof xstoreReturns.$inferSelect)[] = [];

    const [products, sales, heldSales, saleItems, returns] = await Promise.all([
      backupType === "invoices" ? Promise.resolve(emptyProducts) : db.select().from(xstoreProducts).where(eq(xstoreProducts.tenantId, tenantId)),
      backupType === "inventory" ? Promise.resolve(emptySales) : db.select(xstoreSaleSelectionWithoutTableNumber).from(xstoreSales).where(eq(xstoreSales.tenantId, tenantId)),
      backupType === "inventory" ? Promise.resolve(emptyHeldSales) : db.select().from(xstoreHeldSales).where(eq(xstoreHeldSales.tenantId, tenantId)),
      backupType === "inventory" ? Promise.resolve(emptySaleItems) : db.select().from(xstoreSaleItems),
      backupType === "inventory" ? Promise.resolve(emptyReturns) : db.select().from(xstoreReturns),
    ]);
    const saleIds = new Set(sales.map((sale) => sale.id));
    const tables: BackupTables = {
      xstore_products: products,
      xstore_sales: sales,
      xstore_sale_items: saleItems.filter((item) => saleIds.has(item.saleId)),
      xstore_held_sales: heldSales,
      xstore_returns: returns.filter((item) => saleIds.has(item.saleId)),
    };
    const backup = {
      format: "xstore-store-backup" as const, version: 2 as const, backupType, tenantId,
      createdAt: new Date().toISOString(), tables,
      counts: Object.fromEntries(TABLES.map((table) => [table, tables[table].length])),
    };
    if (Buffer.byteLength(JSON.stringify(backup), "utf8") > MAX_BYTES) {
      return res.status(413).json({ error: "حجم نسخة المتجر أكبر من الحد المسموح به وهو 64 ميبيبايت." });
    }
    res.setHeader("Content-Type", MEDIA_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="x-store-${backupType}-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.json(backup);
  } catch (error) {
    req.log.error({ error }, "Unable to create store backup");
    return res.status(500).json({ error: "تعذر إنشاء نسخة المتجر الاحتياطية." });
  }
});

router.post("/xstore/store-backup/restore", async (req, res) => {
  const tenantId = getXStoreUser(res).tenantId;
  if (!tenantId) return res.status(400).json({ error: "حساب المتجر غير مرتبط بمتجر." });
  try {
    validateBackup(req.body, tenantId);
    const { backupType, tables } = req.body;
    await db.transaction(async (tx) => {
      if (backupType === "full" || backupType === "invoices") {
        const sales = await tx.select({ id: xstoreSales.id }).from(xstoreSales).where(eq(xstoreSales.tenantId, tenantId));
        const saleIds = sales.map((sale) => sale.id);
        if (saleIds.length) {
          await tx.delete(xstoreReturns).where(inArray(xstoreReturns.saleId, saleIds));
          await tx.delete(xstoreSaleItems).where(inArray(xstoreSaleItems.saleId, saleIds));
          await tx.delete(xstoreSales).where(eq(xstoreSales.tenantId, tenantId));
        }
        await tx.delete(xstoreHeldSales).where(eq(xstoreHeldSales.tenantId, tenantId));
      }
      if (backupType === "full" || backupType === "inventory") {
        await tx.delete(xstoreProducts).where(eq(xstoreProducts.tenantId, tenantId));
      }
      if (backupType === "full" || backupType === "inventory") {
        if (tables.xstore_products.length) await tx.insert(xstoreProducts).values(tables.xstore_products as any);
      }
      if (backupType === "full" || backupType === "invoices") {
        if (tables.xstore_sales.length) await tx.insert(xstoreSales).values(tables.xstore_sales as any);
        if (tables.xstore_sale_items.length) await tx.insert(xstoreSaleItems).values(tables.xstore_sale_items as any);
        if (tables.xstore_held_sales.length) await tx.insert(xstoreHeldSales).values(tables.xstore_held_sales as any);
        if (tables.xstore_returns.length) await tx.insert(xstoreReturns).values(tables.xstore_returns as any);
      }
    });
    return res.json({ restored: true, backupType });
  } catch (error) {
    req.log.error({ error }, "Unable to restore store backup");
    return res.status(400).json({ error: error instanceof Error ? error.message : "تعذرت استعادة نسخة المتجر." });
  }
});

export default router;
