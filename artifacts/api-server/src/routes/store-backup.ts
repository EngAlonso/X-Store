import { Router } from "express";
import { pool } from "@workspace/db";
import { getXStoreUser, denyRole } from "../middlewares/xstoreAuth";

const router = Router();
const MEDIA_TYPE = "application/vnd.xstore.store-backup+json";
const MAX_BYTES = 64 * 1024 * 1024;
const TABLES = ["xstore_products", "xstore_sales", "xstore_sale_items", "xstore_held_sales", "xstore_returns"] as const;

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
function tableName(name: string) {
  return `public.${quoteIdentifier(name)}`;
}
function tenantColumn(name: string) {
  return name === "xstore_sale_items" || name === "xstore_returns" ? null : "tenant_id";
}
async function readRows(client: any, table: string, tenantId: string) {
  if (tenantColumn(table)) {
    const result = await client.query(`SELECT * FROM ${tableName(table)} WHERE "tenant_id" = $1 ORDER BY 1`, [tenantId]);
    return result.rows;
  }
  if (table === "xstore_sale_items") {
    const result = await client.query(
      `SELECT si.* FROM ${tableName(table)} si JOIN ${tableName("xstore_sales")} s ON s.id = si.sale_id WHERE s.tenant_id = $1 ORDER BY si.id`,
      [tenantId],
    );
    return result.rows;
  }
  const result = await client.query(
    `SELECT r.* FROM ${tableName(table)} r JOIN ${tableName("xstore_sales")} s ON s.id = r.sale_id WHERE s.tenant_id = $1 ORDER BY r.id`,
    [tenantId],
  );
  return result.rows;
}
function validateBackup(value: any, tenantId: string) {
  if (!value || value.format !== "xstore-store-backup" || value.version !== 1 || value.tenantId !== tenantId || !value.createdAt || !value.tables || typeof value.tables !== "object") {
    throw new Error("ملف النسخة الاحتياطية غير صالح أو يخص متجرًا آخر.");
  }
  for (const table of TABLES) {
    if (!Array.isArray(value.tables[table])) throw new Error("النسخة غير مكتملة ولا تحتوي جميع بيانات المتجر.");
  }
}
async function insertRows(client: any, table: string, rows: any[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const placeholders = rows.map((row: any, rowIndex: number) =>
    `(${columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(", ")})`,
  ).join(", ");
  const values = rows.flatMap((row: any) => columns.map(column => row[column]));
  await client.query(
    `INSERT INTO ${tableName(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES ${placeholders}`,
    values,
  );
}
router.use("/xstore/store-backup", (req, res, next) => {
  const user = getXStoreUser(res);
  if (denyRole(res, user, ["tenant_admin"])) return;
  next();
});
router.get("/xstore/store-backup", async (req, res) => {
  const tenantId = getXStoreUser(res).tenantId;
  if (!tenantId) return res.status(400).json({ error: "حساب المتجر غير مرتبط بمتجر." });
  const client = await pool.connect();
  try {
    const tables: Record<string, any[]> = {};
    for (const table of TABLES) tables[table] = await readRows(client, table, tenantId);
    const backup = {
      format: "xstore-store-backup",
      version: 1,
      tenantId,
      createdAt: new Date().toISOString(),
      tables,
      counts: Object.fromEntries(TABLES.map(table => [table, tables[table].length])),
    };
    const bytes = Buffer.byteLength(JSON.stringify(backup), "utf8");
    if (bytes > MAX_BYTES) return res.status(413).json({ error: "حجم نسخة المتجر أكبر من الحد المسموح به وهو 64 ميبيبايت." });
    res.setHeader("Content-Type", MEDIA_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="x-store-store-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(backup);
  } catch (error) {
    req.log.error({ error }, "Unable to create store backup");
    res.status(500).json({ error: "تعذر إنشاء نسخة المتجر الاحتياطية." });
  } finally {
    client.release();
  }
});
router.post("/xstore/store-backup/restore", async (req, res) => {
  const tenantId = getXStoreUser(res).tenantId;
  if (!tenantId) return res.status(400).json({ error: "حساب المتجر غير مرتبط بمتجر." });
  try {
    validateBackup(req.body, tenantId);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM ${tableName("xstore_returns")} WHERE sale_id IN (SELECT id FROM ${tableName("xstore_sales")} WHERE tenant_id = $1)`, [tenantId]);
      await client.query(`DELETE FROM ${tableName("xstore_sale_items")} WHERE sale_id IN (SELECT id FROM ${tableName("xstore_sales")} WHERE tenant_id = $1)`, [tenantId]);
      await client.query(`DELETE FROM ${tableName("xstore_sales")} WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM ${tableName("xstore_held_sales")} WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM ${tableName("xstore_products")} WHERE tenant_id = $1`, [tenantId]);
      await insertRows(client, "xstore_products", req.body.tables.xstore_products);
      await insertRows(client, "xstore_sales", req.body.tables.xstore_sales);
      await insertRows(client, "xstore_sale_items", req.body.tables.xstore_sale_items);
      await insertRows(client, "xstore_held_sales", req.body.tables.xstore_held_sales);
      await insertRows(client, "xstore_returns", req.body.tables.xstore_returns);
      await client.query("COMMIT");
      res.json({ restored: true });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    req.log.error({ error }, "Unable to restore store backup");
    res.status(400).json({ error: error instanceof Error ? error.message : "تعذرت استعادة نسخة المتجر." });
  }
});
export default router;
