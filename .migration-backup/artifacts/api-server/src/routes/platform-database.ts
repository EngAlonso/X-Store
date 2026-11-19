import { Router, type IRouter, type Request, type Response } from "express";
import {
  DeleteXStorePlatformDatabaseRowBody,
  DeleteXStorePlatformDatabaseRowParams,
  DeleteXStorePlatformDatabaseRowResponse,
  ListXStorePlatformDatabaseRowsQueryParams,
  ListXStorePlatformDatabaseRowsResponse,
  ListXStorePlatformDatabaseTablesResponse,
} from "@workspace/api-zod";
import { pool, type XStoreUser } from "@workspace/db";
import {
  denyRole,
  getXStoreUser,
  requireXStoreUser,
} from "../middlewares/xstoreAuth";

type SqlClient = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount?: number | null }>;
  release(): void;
};

type RawColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
};

type TableDefinition = {
  name: string;
  label: string;
  deletable: boolean;
  deleteWarning: string | null;
};

type DatabaseError = Error & { code?: string };

const router: IRouter = Router();
const CONFIRMATION_PREFIX = "حذف";
const SENSITIVE_COLUMN = /(password|secret|token|hash|credential|clerk_user_id)/i;

const tables: TableDefinition[] = [
  {
    name: "xstore_tenants",
    label: "المتاجر",
    deletable: true,
    deleteWarning:
      "حذف المتجر يزيل بياناته المرتبطة مثل المنتجات والمبيعات والفريق وحسابات أعضائه، وقد يتعذر إذا وُجدت بيانات مرتبطة لا يمكن حذفها.",
  },
  {
    name: "xstore_users",
    label: "حسابات المستخدمين",
    deletable: true,
    deleteWarning:
      "لا يمكن حذف حساب مالك المنصة أو الحساب المستخدم حاليًا. وقد تمنع الفواتير المرتبطة حذف حساب آخر.",
  },
  {
    name: "xstore_team_members",
    label: "أعضاء فريق المتجر",
    deletable: false,
    deleteWarning: "إدارة أعضاء الفرق تتم من صفحة فريق العمل للحفاظ على ربط الحسابات.",
  },
  {
    name: "xstore_platform_settings",
    label: "إعدادات المنصة",
    deletable: false,
    deleteWarning: "إعدادات المنصة محمية من الحذف.",
  },
  {
    name: "xstore_subscription_payments",
    label: "دفعات الاشتراك",
    deletable: true,
    deleteWarning: "حذف سجل الدفعة لا يغيّر حالة الاشتراك أو تاريخ انتهائه.",
  },
  {
    name: "xstore_products",
    label: "المنتجات والمخزون",
    deletable: true,
    deleteWarning:
      "لا يمكن حذف منتج مرتبط بفواتير أو مرتجعات. حذف المنتج يزيل رصيد مخزونه.",
  },
  {
    name: "xstore_sales",
    label: "فواتير المبيعات",
    deletable: true,
    deleteWarning:
      "حذف الفاتورة يحذف بنودها ويعيد الكميات غير المرتجعة إلى المخزون. الفواتير التي لها مرتجعات أو استبدالات محمية.",
  },
  {
    name: "xstore_sale_items",
    label: "بنود الفواتير",
    deletable: false,
    deleteWarning: "حذف بنود منفردة قد يغيّر إجماليات الفواتير؛ تُحذف البنود مع الفاتورة.",
  },
  {
    name: "xstore_held_sales",
    label: "الفواتير المعلّقة",
    deletable: true,
    deleteWarning: "حذف الفاتورة المعلّقة لا يغيّر المخزون.",
  },
  {
    name: "xstore_returns",
    label: "المرتجعات",
    deletable: false,
    deleteWarning: "سجلات المرتجعات مرتبطة بحركة المخزون؛ تُدار من شاشة المبيعات.",
  },
  {
    name: "xstore_audit_logs",
    label: "سجل التدقيق",
    deletable: false,
    deleteWarning: "سجل التدقيق للقراءة فقط ولا يمكن حذفه من هذه الصفحة.",
  },
];

const quoteIdentifier = (value: string) =>
  `"${value.replaceAll('"', '""')}"`;

const qualifiedTable = (tableName: string) =>
  `${quoteIdentifier("public")}.${quoteIdentifier(tableName)}`;

function findTable(tableName: string): TableDefinition | undefined {
  return tables.find((table) => table.name === tableName);
}

function platformOwner(res: Response): XStoreUser | null {
  const user = getXStoreUser(res);
  return denyRole(res, user, ["platform_admin"]) ? null : user;
}

function getParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isSensitiveColumn(name: string): boolean {
  return SENSITIVE_COLUMN.test(name);
}

async function getColumns(
  client: SqlClient,
  tableName: string,
): Promise<RawColumn[]> {
  const result = await client.query<RawColumn>(
    `
      SELECT
        c.column_name AS name,
        c.data_type AS "dataType",
        (c.is_nullable = 'YES') AS nullable,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_catalog = kcu.constraint_catalog
            AND tc.constraint_schema = kcu.constraint_schema
            AND tc.constraint_name = kcu.constraint_name
            AND tc.table_name = kcu.table_name
          WHERE tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = c.column_name
        ) AS "primaryKey"
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = $1
      ORDER BY c.ordinal_position
    `,
    [tableName],
  );
  return result.rows;
}

function responseColumns(columns: RawColumn[]) {
  return columns
    .filter((column) => !isSensitiveColumn(column.name))
    .map((column) => ({
      name: column.name,
      dataType: column.dataType,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
    }));
}

async function getRowCount(
  client: SqlClient,
  tableName: string,
): Promise<number> {
  const result = await client.query<{ rowCount: string }>(
    `SELECT COUNT(*)::text AS "rowCount" FROM ${qualifiedTable(tableName)}`,
  );
  return Number(result.rows[0]?.rowCount ?? 0);
}

function rowDeleteBlock(
  table: TableDefinition,
  user: XStoreUser,
  values: Record<string, unknown>,
): string | null {
  if (!table.deletable) return table.deleteWarning;
  if (
    table.name === "xstore_users" &&
    (values.id === user.id || values.role === "platform_admin")
  ) {
    return "لا يمكن حذف حساب مالك المنصة أو الحساب المستخدم حاليًا.";
  }
  return null;
}

function isForeignKeyError(error: unknown): boolean {
  return (error as DatabaseError | null)?.code === "23503";
}

class AdminDatabaseError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "AdminDatabaseError";
  }
}

async function writeDeleteAudit(
  client: SqlClient,
  user: XStoreUser,
  table: TableDefinition,
  rowId: string,
  tenantId: string | null,
): Promise<void> {
  await client.query(
    `
      INSERT INTO ${qualifiedTable("xstore_audit_logs")}
        (actor_user_id, actor_name, action, tenant_id, entity_type, entity_id, details)
      VALUES ($1, $2, 'platform_database_record_deleted', $3, 'database_record', $4, $5)
    `,
    [
      user.id,
      user.name,
      tenantId,
      rowId,
      `حذف مالك المنصة سجلًا من جدول ${table.label} (${table.name}).`,
    ],
  );
}

router.use("/xstore/platform-database", requireXStoreUser);

router.get(
  "/xstore/platform-database/tables",
  async (_req, res): Promise<void> => {
    const user = platformOwner(res);
    if (!user) return;

    const client = (await pool.connect()) as unknown as SqlClient;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const tableRows = [];
      for (const table of tables) {
        const [columns, rowCount] = await Promise.all([
          getColumns(client, table.name),
          getRowCount(client, table.name),
        ]);
        tableRows.push({
          ...table,
          rowCount,
          columns: responseColumns(columns),
        });
      }
      const totalRows = tableRows.reduce(
        (sum, table) => sum + table.rowCount,
        0,
      );
      await client.query("COMMIT");
      res.json(
        ListXStorePlatformDatabaseTablesResponse.parse({
          tables: tableRows,
          tableCount: tableRows.length,
          totalRows,
        }),
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      res.status(500).json({ error: "تعذر تحميل جداول قاعدة البيانات." });
      _req.log.error({ error }, "Unable to list platform database tables");
    } finally {
      client.release();
    }
  },
);

router.get(
  "/xstore/platform-database/rows",
  async (req, res): Promise<void> => {
    const user = platformOwner(res);
    if (!user) return;
    const parsed = ListXStorePlatformDatabaseRowsQueryParams.safeParse(
      req.query,
    );
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const table = findTable(parsed.data.tableName);
    if (!table) {
      res.status(404).json({ error: "الجدول غير متاح لإدارة المنصة." });
      return;
    }

    const client = (await pool.connect()) as unknown as SqlClient;
    try {
      const allColumns = await getColumns(client, table.name);
      if (
        !allColumns.some((column) => column.name === "id" && column.primaryKey)
      ) {
        res.status(409).json({ error: "الجدول لا يحتوي معرّفًا آمنًا لعرضه." });
        return;
      }
      const visibleColumns = allColumns.filter(
        (column) => !isSensitiveColumn(column.name),
      );
      const searchableColumns = visibleColumns.filter(
        (column) =>
          !["json", "jsonb", "bytea"].includes(column.dataType.toLowerCase()),
      );
      const searchTerm = parsed.data.search ?? "";
      const searchClause = searchableColumns.length
        ? `WHERE ($1 = '' OR (${searchableColumns
            .map(
              (column) =>
                `${quoteIdentifier(column.name)}::text ILIKE '%' || $1 || '%'`,
            )
            .join(" OR ")}))`
        : "WHERE $1 = ''";
      const countResult = await client.query<{ rowCount: string }>(
        `SELECT COUNT(*)::text AS "rowCount" FROM ${qualifiedTable(table.name)} ${searchClause}`,
        [searchTerm],
      );
      const totalRows = Number(countResult.rows[0]?.rowCount ?? 0);
      const page = parsed.data.page;
      const pageSize = parsed.data.pageSize;
      const offset = (page - 1) * pageSize;
      const sensitiveColumns = allColumns
        .filter((column) => isSensitiveColumn(column.name))
        .map((column) => column.name);
      const where = searchClause.replaceAll("$1", "$2");
      const sortColumn = allColumns.some(
        (column) => column.name === "created_at",
      )
        ? "created_at"
        : "id";
      const rowsResult = await client.query<{
        id: string;
        row_values: Record<string, unknown>;
      }>(
        `
          SELECT
            row_data.id::text AS id,
            to_jsonb(row_data) - $1::text[] AS row_values
          FROM ${qualifiedTable(table.name)} AS row_data
          ${where}
          ORDER BY ${quoteIdentifier(sortColumn)} DESC, ${quoteIdentifier("id")} DESC
          LIMIT $3 OFFSET $4
        `,
        [sensitiveColumns, searchTerm, pageSize, offset],
      );
      const rows = rowsResult.rows.map((row) => {
        const values = row.row_values ?? {};
        const blockedReason = rowDeleteBlock(table, user, {
          ...values,
          id: row.id,
        });
        return {
          id: row.id,
          values,
          canDelete: blockedReason === null,
          deleteBlockedReason: blockedReason,
        };
      });

      res.json(
        ListXStorePlatformDatabaseRowsResponse.parse({
          tableName: table.name,
          label: table.label,
          page,
          pageSize,
          totalRows,
          totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
          columns: responseColumns(allColumns),
          rows,
        }),
      );
    } catch (error) {
      req.log.error(
        { error, tableName: table.name },
        "Unable to list platform database rows",
      );
      res.status(500).json({ error: "تعذر تحميل سجلات الجدول." });
    } finally {
      client.release();
    }
  },
);

router.delete(
  "/xstore/platform-database/tables/:tableName/rows/:rowId",
  async (req: Request, res: Response): Promise<void> => {
    const user = platformOwner(res);
    if (!user) return;
    const params = DeleteXStorePlatformDatabaseRowParams.safeParse({
      tableName: getParam(req.params.tableName),
      rowId: getParam(req.params.rowId),
    });
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = DeleteXStorePlatformDatabaseRowBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const table = findTable(params.data.tableName);
    if (!table) {
      res.status(404).json({ error: "الجدول غير متاح لإدارة المنصة." });
      return;
    }
    if (!table.deletable) {
      res.status(409).json({
        error: table.deleteWarning ?? "هذا الجدول محمي من الحذف.",
      });
      return;
    }
    if (
      parsed.data.confirmation !==
      `${CONFIRMATION_PREFIX} ${params.data.rowId}`
    ) {
      res.status(400).json({
        error: `اكتب «${CONFIRMATION_PREFIX} ${params.data.rowId}» لتأكيد الحذف.`,
      });
      return;
    }

    const client = (await pool.connect()) as unknown as SqlClient;
    let inTransaction = false;
    try {
      await client.query("BEGIN");
      inTransaction = true;
      const [row] = await client.query<{
        id: string;
        values: Record<string, unknown>;
      }>(
        `SELECT id::text AS id, to_jsonb(record_data) AS values FROM ${qualifiedTable(table.name)} AS record_data WHERE id::text = $1 FOR UPDATE`,
        [params.data.rowId],
      ).then((result) => result.rows);
      if (!row) {
        throw new AdminDatabaseError("السجل غير موجود أو حُذف مسبقًا.", 404);
      }
      const blockReason = rowDeleteBlock(table, user, {
        ...row.values,
        id: row.id,
      });
      if (blockReason) throw new AdminDatabaseError(blockReason, 409);

      let auditTenantId: string | null =
        typeof row.values.tenant_id === "string"
          ? row.values.tenant_id
          : null;

      if (table.name === "xstore_sales") {
        const invoiceNo = String(row.values.invoice_no ?? "");
        const returns = await client.query<{ id: string }>(
          `SELECT id::text AS id FROM ${qualifiedTable("xstore_returns")} WHERE sale_id::text = $1 LIMIT 1`,
          [row.id],
        );
        const exchangeEvents = await client.query<{ id: string }>(
          `
            SELECT id::text AS id
            FROM ${qualifiedTable("xstore_audit_logs")}
            WHERE action = 'sale.exchange'
              AND (
                entity_id = $1
                OR details LIKE '%' || $1 || '%'
              )
            LIMIT 1
          `,
          [invoiceNo],
        );
        if (returns.rows.length || exchangeEvents.rows.length) {
          throw new AdminDatabaseError(
            "لا يمكن حذف فاتورة لها مرتجعات أو استبدالات مسجلة.",
            409,
          );
        }

        const items = await client.query<{
          productId: string;
          quantity: number;
          returnedQuantity: number;
        }>(
          `
            SELECT
              product_id::text AS "productId",
              quantity,
              returned_quantity AS "returnedQuantity"
            FROM ${qualifiedTable("xstore_sale_items")}
            WHERE sale_id::text = $1
          `,
          [row.id],
        );
        for (const item of items.rows) {
          const restoreQuantity = Math.max(
            0,
            Number(item.quantity) - Number(item.returnedQuantity),
          );
          if (restoreQuantity === 0) continue;
          const updated = await client.query(
            `UPDATE ${qualifiedTable("xstore_products")} SET quantity = quantity + $1 WHERE id::text = $2`,
            [restoreQuantity, item.productId],
          );
          if (updated.rowCount !== 1) {
            throw new AdminDatabaseError(
              "تعذر إعادة كمية أحد المنتجات إلى المخزون؛ لم تُحذف الفاتورة.",
              409,
            );
          }
        }
      } else if (table.name === "xstore_tenants") {
        const users = await client.query<{ id: string }>(
          `SELECT id::text AS id FROM ${qualifiedTable("xstore_users")} WHERE tenant_id::text = $1 AND role <> 'platform_admin'`,
          [row.id],
        );
        const tenantDeleted = await client.query(
          `DELETE FROM ${qualifiedTable(table.name)} WHERE id::text = $1`,
          [row.id],
        );
        if (tenantDeleted.rowCount !== 1) {
          throw new AdminDatabaseError("تعذر حذف المتجر.", 409);
        }
        for (const tenantUser of users.rows) {
          await client.query(
            `DELETE FROM ${qualifiedTable("xstore_users")} WHERE id::text = $1`,
            [tenantUser.id],
          );
        }
        auditTenantId = null;
      } else if (table.name === "xstore_users") {
        if (
          row.values.id === user.id ||
          row.values.role === "platform_admin"
        ) {
          throw new AdminDatabaseError(
            "لا يمكن حذف حساب مالك المنصة أو الحساب المستخدم حاليًا.",
            409,
          );
        }
        const deleted = await client.query(
          `DELETE FROM ${qualifiedTable(table.name)} WHERE id::text = $1`,
          [row.id],
        );
        if (deleted.rowCount !== 1) {
          throw new AdminDatabaseError("تعذر حذف الحساب.", 409);
        }
      } else if (table.name === "xstore_sales") {
        const deleted = await client.query(
          `DELETE FROM ${qualifiedTable(table.name)} WHERE id::text = $1`,
          [row.id],
        );
        if (deleted.rowCount !== 1) {
          throw new AdminDatabaseError("تعذر حذف الفاتورة.", 409);
        }
      } else {
        const deleted = await client.query(
          `DELETE FROM ${qualifiedTable(table.name)} WHERE id::text = $1`,
          [row.id],
        );
        if (deleted.rowCount !== 1) {
          throw new AdminDatabaseError("السجل غير موجود أو حُذف مسبقًا.", 404);
        }
      }

      await writeDeleteAudit(client, user, table, row.id, auditTenantId);
      await client.query("COMMIT");
      inTransaction = false;
      res.json(
        DeleteXStorePlatformDatabaseRowResponse.parse({
          tableName: table.name,
          recordId: row.id,
          deletedAt: new Date(),
        }),
      );
    } catch (error) {
      if (inTransaction) await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof AdminDatabaseError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      if (isForeignKeyError(error)) {
        res.status(409).json({
          error:
            "لا يمكن حذف السجل لأنه مرتبط ببيانات أخرى. لم يتم تطبيق أي تغيير.",
        });
        return;
      }
      req.log.error(
        {
          error,
          tableName: table.name,
          recordId: params.data.rowId,
        },
        "Unable to delete platform database row",
      );
      res.status(500).json({ error: "تعذر حذف السجل. لم يتم تطبيق أي تغيير." });
    } finally {
      client.release();
    }
  },
);

export default router;
