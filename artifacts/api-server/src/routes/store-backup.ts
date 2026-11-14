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
const MEDIA_TYPE = "application/vnd.xstore.store-backup+json";
const MAX_BYTES = 64 * 1024 * 1024;
const TABLES = [
  "xstore_products",
  "xstore_sales",
  "xstore_sale_items",
  "xstore_held_sales",
  "xstore_returns",
] as const;

type BackupTables = {
  xstore_products: unknown[];
  xstore_sales: unknown[];
  xstore_sale_items: unknown[];
  xstore_held_sales: unknown[];
  xstore_returns: unknown[];
};

function validateBackup(value: any, tenantId: string): asserts value is {
  format: "xstore-store-backup";
  version: 1;
  tenantId: string;
  createdAt: string;
  tables: BackupTables;
} {
  if (
    !value ||
    value.format !== "xstore-store-backup" ||
    value.version !== 1 ||
    value.tenantId !== tenantId ||
    typeof value.createdAt !== "string" ||
    !value.tables ||
    typeof value.tables !== "object"
  ) {
    throw new Error("ملف النسخة الاحتياطية غير صالح أو يخص متجرًا آخر.");
  }

  for (const table of TABLES) {
    if (!Array.isArray(value.tables[table])) {
      throw new Error("النسخة غير مكتملة ولا تحتوي جميع بيانات المتجر.");
    }
  }
}

// This router is mounted before the main X-Store router, so it must
// authenticate the session itself before reading res.locals.xstoreUser.
router.use("/xstore/store-backup", requireXStoreUser, (req, res, next) => {
  const user = getXStoreUser(res);
  if (denyRole(res, user, ["tenant_admin"])) return;
  next();
});

router.get("/xstore/store-backup", async (req, res) => {
  const tenantId = getXStoreUser(res).tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: "حساب المتجر غير مرتبط بمتجر." });
  }

  try {
    const [products, sales, heldSales, saleItems, returns] = await Promise.all([
      db.select().from(xstoreProducts).where(eq(xstoreProducts.tenantId, tenantId)),
      db.select().from(xstoreSales).where(eq(xstoreSales.tenantId, tenantId)),
      db.select().from(xstoreHeldSales).where(eq(xstoreHeldSales.tenantId, tenantId)),
      db.select().from(xstoreSaleItems),
      db.select().from(xstoreReturns),
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
      format: "xstore-store-backup" as const,
      version: 1 as const,
      tenantId,
      createdAt: new Date().toISOString(),
      tables,
      counts: Object.fromEntries(
        TABLES.map((table) => [table, tables[table].length]),
      ),
    };

    const bytes = Buffer.byteLength(JSON.stringify(backup), "utf8");
    if (bytes > MAX_BYTES) {
      return res.status(413).json({
        error: "حجم نسخة المتجر أكبر من الحد المسموح به وهو 64 ميبيبايت.",
      });
    }

    res.setHeader("Content-Type", MEDIA_TYPE);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="x-store-store-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    );
    return res.json(backup);
  } catch (error) {
    req.log.error({ error }, "Unable to create store backup");
    return res.status(500).json({
      error: "تعذر إنشاء نسخة المتجر الاحتياطية.",
    });
  }
});

router.post("/xstore/store-backup/restore", async (req, res) => {
  const tenantId = getXStoreUser(res).tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: "حساب المتجر غير مرتبط بمتجر." });
  }

  try {
    validateBackup(req.body, tenantId);

    await db.transaction(async (tx) => {
      const sales = await tx
        .select({ id: xstoreSales.id })
        .from(xstoreSales)
        .where(eq(xstoreSales.tenantId, tenantId));

      const saleIds = sales.map((sale) => sale.id);

      if (saleIds.length) {
        await tx.delete(xstoreReturns).where(inArray(xstoreReturns.saleId, saleIds));
        await tx.delete(xstoreSaleItems).where(inArray(xstoreSaleItems.saleId, saleIds));
        await tx.delete(xstoreSales).where(eq(xstoreSales.tenantId, tenantId));
      }

      await tx.delete(xstoreHeldSales).where(eq(xstoreHeldSales.tenantId, tenantId));
      await tx.delete(xstoreProducts).where(eq(xstoreProducts.tenantId, tenantId));

      if (req.body.tables.xstore_products.length) {
        await tx.insert(xstoreProducts).values(req.body.tables.xstore_products as any);
      }
      if (req.body.tables.xstore_sales.length) {
        await tx.insert(xstoreSales).values(req.body.tables.xstore_sales as any);
      }
      if (req.body.tables.xstore_sale_items.length) {
        await tx.insert(xstoreSaleItems).values(req.body.tables.xstore_sale_items as any);
      }
      if (req.body.tables.xstore_held_sales.length) {
        await tx.insert(xstoreHeldSales).values(req.body.tables.xstore_held_sales as any);
      }
      if (req.body.tables.xstore_returns.length) {
        await tx.insert(xstoreReturns).values(req.body.tables.xstore_returns as any);
      }
    });

    return res.json({ restored: true });
  } catch (error) {
    req.log.error({ error }, "Unable to restore store backup");
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "تعذرت استعادة نسخة المتجر.",
    });
  }
});

export default router;
