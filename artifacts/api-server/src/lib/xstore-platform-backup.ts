import { pool } from "@workspace/db";
import type {
  XStorePlatformBackup,
  XStorePlatformBackupSummary,
} from "@workspace/api-zod";

type BackupSqlClient = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: any[],
  ): Promise<{ rows: Row[] }>;
  release(): void;
};

type PublicColumn = {
  name: string;
  dataType: string;
  udtName: string;
  ordinalPosition: number;
  isGenerated: "ALWAYS" | "NEVER";
  isIdentity: "YES" | "NO";
};

type ColumnQueryRow = {
  [key: string]: unknown;
  name: string;
  dataType: string;
  udtName: string;
  ordinalPosition: number;
  isGenerated: "ALWAYS" | "NEVER";
  isIdentity: "YES" | "NO";
};

type ForeignKeyEdge = {
  [key: string]: unknown;
  childTable: string;
  parentTable: string;
};

const BINARY_BACKUP_FIELD = "$xstoreBinaryBase64";
const RESTORE_LOCK_NAME = "xstore-platform-backup-restore";
export const MAX_XSTORE_PLATFORM_BACKUP_BYTES = 128 * 1024 * 1024;

export class PlatformBackupError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 409 | 413,
  ) {
    super(message);
    this.name = "PlatformBackupError";
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function qualifiedTable(tableName: string): string {
  return `${quoteIdentifier("public")}.${quoteIdentifier(tableName)}`;
}

async function getPublicTableNames(client: BackupSqlClient): Promise<string[]> {
  const result = await client.query<{ [key: string]: unknown; tableName: string }>(`
    SELECT c.relname AS "tableName"
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
      AND c.relname NOT IN ('__drizzle_migrations', 'drizzle_migrations')
    ORDER BY c.relname
  `);
  return result.rows.map((row) => String(row.tableName));
}

async function getPublicColumns(
  client: BackupSqlClient,
  tableNames: string[],
): Promise<Map<string, PublicColumn[]>> {
  const columnsByTable = new Map<string, PublicColumn[]>(
    tableNames.map((tableName) => [tableName, []]),
  );
  if (tableNames.length === 0) return columnsByTable;

  const result = await client.query<ColumnQueryRow>(
    `
      SELECT
        table_name AS "tableName",
        column_name AS "name",
        data_type AS "dataType",
        udt_name AS "udtName",
        ordinal_position AS "ordinalPosition",
        is_generated AS "isGenerated",
        is_identity AS "isIdentity"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position
    `,
    [tableNames],
  );

  for (const row of result.rows) {
    columnsByTable.get(String(row.tableName))?.push({
      name: row.name,
      dataType: row.dataType,
      udtName: row.udtName,
      ordinalPosition: Number(row.ordinalPosition),
      isGenerated: row.isGenerated,
      isIdentity: row.isIdentity,
    });
  }
  return columnsByTable;
}

async function beginReadSnapshot(client: BackupSqlClient): Promise<void> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
}

async function finishReadSnapshot(client: BackupSqlClient, failed: boolean): Promise<void> {
  if (failed) {
    await client.query("ROLLBACK").catch(() => undefined);
  } else {
    await client.query("COMMIT");
  }
}

async function countRows(client: BackupSqlClient, tableName: string): Promise<number> {
  const result = await client.query<{ [key: string]: unknown; rowCount: string }>(
    `SELECT COUNT(*)::text AS "rowCount" FROM ${qualifiedTable(tableName)}`,
  );
  return Number(result.rows[0]?.rowCount ?? 0);
}

export async function getXStorePlatformBackupSummary(): Promise<XStorePlatformBackupSummary> {
  const client = (await pool.connect()) as unknown as BackupSqlClient;
  let failed = false;
  try {
    await beginReadSnapshot(client);
    const tableNames = await getPublicTableNames(client);
    const tables = await Promise.all(
      tableNames.map(async (name) => ({
        name,
        rowCount: await countRows(client, name),
      })),
    );
    return {
      tableCount: tables.length,
      rowCount: tables.reduce((total, table) => total + table.rowCount, 0),
      tables,
      maxBackupBytes: MAX_XSTORE_PLATFORM_BACKUP_BYTES,
    };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await finishReadSnapshot(client, failed);
    } finally {
      client.release();
    }
  }
}

function getSerializedBackupByteLength(backup: XStorePlatformBackup): number {
  const envelopeBytes = Buffer.byteLength(
    JSON.stringify({
      format: backup.format,
      version: backup.version,
      createdAt: backup.createdAt,
      tableCount: backup.tableCount,
      rowCount: backup.rowCount,
      tables: [],
    }),
    "utf8",
  );

  return backup.tables.reduce((total, table, tableIndex) => {
    const emptyRowsTableBytes = Buffer.byteLength(
      JSON.stringify({ ...table, rows: [] }),
      "utf8",
    );
    const rowsBytes = table.rows.reduce(
      (rowTotal, row, rowIndex) =>
        rowTotal +
        Buffer.byteLength(JSON.stringify(row), "utf8") +
        (rowIndex === 0 ? 0 : 1),
      0,
    );
    return (
      total +
      (tableIndex === 0 ? 0 : 1) +
      emptyRowsTableBytes +
      rowsBytes
    );
  }, envelopeBytes);
}

function encodeBinary(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return { [BINARY_BACKUP_FIELD]: value.toString("base64") };
  }
  if (Array.isArray(value)) return value.map(encodeBinary);
  return value;
}

export async function createXStorePlatformBackup(): Promise<XStorePlatformBackup> {
  const client = (await pool.connect()) as unknown as BackupSqlClient;
  let failed = false;
  try {
    await beginReadSnapshot(client);
    const tableNames = await getPublicTableNames(client);
    const columnsByTable = await getPublicColumns(client, tableNames);
    const tables = [];

    for (const name of tableNames) {
      const columns = columnsByTable.get(name) ?? [];
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM ${qualifiedTable(name)}`,
      );
      const rows = result.rows.map((row) => {
        const encoded: Record<string, unknown> = {};
        for (const column of columns) {
          const value = row[column.name];
          encoded[column.name] =
            column.dataType === "bytea" || column.udtName === "_bytea"
              ? encodeBinary(value)
              : value;
        }
        return encoded;
      });
      tables.push({
        name,
        columns: columns.map((column) => column.name),
        rows,
      });
    }

    const backup: XStorePlatformBackup = {
      format: "xstore-platform-backup",
      version: 1,
      createdAt: new Date(),
      tableCount: tables.length,
      rowCount: tables.reduce((total, table) => total + table.rows.length, 0),
      tables,
    };
    if (getSerializedBackupByteLength(backup) > MAX_XSTORE_PLATFORM_BACKUP_BYTES) {
      throw new PlatformBackupError(
        "حجم النسخة يتجاوز الحد الأقصى البالغ 128 ميبيبايت. لم يتم إنشاء ملف.",
        413,
      );
    }
    return backup;
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await finishReadSnapshot(client, failed);
    } finally {
      client.release();
    }
  }
}

function assertBackupMatchesSchema(
  backup: XStorePlatformBackup,
  tableNames: string[],
  columnsByTable: Map<string, PublicColumn[]>,
): Map<string, XStorePlatformBackup["tables"][number]> {
  if (
    backup.tableCount !== backup.tables.length ||
    backup.rowCount !== backup.tables.reduce((sum, table) => sum + table.rows.length, 0)
  ) {
    throw new PlatformBackupError(
      "ملف النسخة غير مكتمل أو تم تعديله. لم يتم تغيير أي بيانات.",
      400,
    );
  }

  const currentTables = new Set(tableNames);
  if (backup.tables.length !== tableNames.length) {
    throw new PlatformBackupError(
      "النسخة لا تحتوي جميع جداول قاعدة البيانات الحالية. لم يتم تغيير أي بيانات.",
      409,
    );
  }
  const backupTables = new Map<string, XStorePlatformBackup["tables"][number]>();
  for (const table of backup.tables) {
    if (backupTables.has(table.name)) {
      throw new PlatformBackupError(
        "ملف النسخة يحتوي على جدول مكرر. لم يتم تغيير أي بيانات.",
        400,
      );
    }
    if (!currentTables.has(table.name)) {
      throw new PlatformBackupError(
        "النسخة صادرة من مخطط أحدث أو مختلف عن قاعدة البيانات الحالية.",
        409,
      );
    }

    const currentColumns = new Set(
      (columnsByTable.get(table.name) ?? []).map((column) => column.name),
    );
    const backupColumns = new Set(table.columns);
    if (
      backupColumns.size !== table.columns.length ||
      backupColumns.size !== currentColumns.size ||
      Array.from(currentColumns).some((columnName) => !backupColumns.has(columnName))
    ) {
      throw new PlatformBackupError(
        `أعمدة جدول ${table.name} لا تتطابق مع قاعدة البيانات الحالية.`,
        409,
      );
    }

    for (const row of table.rows) {
      const rowColumns = Object.keys(row);
      if (
        rowColumns.length !== table.columns.length ||
        rowColumns.some((columnName) => !backupColumns.has(columnName))
      ) {
        throw new PlatformBackupError(
          `بيانات جدول ${table.name} غير مكتملة أو تحتوي على أعمدة غير معروفة.`,
          400,
        );
      }
    }
    backupTables.set(table.name, table);
  }
  if (tableNames.some((tableName) => !backupTables.has(tableName))) {
    throw new PlatformBackupError(
      "النسخة لا تحتوي جميع جداول قاعدة البيانات الحالية. لم يتم تغيير أي بيانات.",
      409,
    );
  }
  return backupTables;
}

async function getForeignKeyEdges(client: BackupSqlClient): Promise<ForeignKeyEdge[]> {
  const result = await client.query<ForeignKeyEdge>(`
    SELECT
      child.relname AS "childTable",
      parent.relname AS "parentTable"
    FROM pg_catalog.pg_constraint fk
    JOIN pg_catalog.pg_class child ON child.oid = fk.conrelid
    JOIN pg_catalog.pg_namespace child_schema ON child_schema.oid = child.relnamespace
    JOIN pg_catalog.pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_catalog.pg_namespace parent_schema ON parent_schema.oid = parent.relnamespace
    WHERE fk.contype = 'f'
      AND child_schema.nspname = 'public'
      AND parent_schema.nspname = 'public'
    GROUP BY child.relname, parent.relname
  `);
  return result.rows;
}

function parentFirstOrder(
  tableNames: string[],
  edges: ForeignKeyEdge[],
): string[] {
  const remaining = new Set(tableNames);
  const parents = new Map(tableNames.map((name) => [name, new Set<string>()]));
  for (const edge of edges) {
    if (remaining.has(edge.childTable) && remaining.has(edge.parentTable)) {
      parents.get(edge.childTable)?.add(edge.parentTable);
    }
  }

  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = Array.from(remaining)
      .filter((name) =>
        Array.from(parents.get(name) ?? []).every((parent) => !remaining.has(parent)),
      )
      .sort();
    if (ready.length === 0) {
      throw new PlatformBackupError(
        "تحتوي قاعدة البيانات على علاقات دائرية لا يمكن استعادتها بأمان.",
        409,
      );
    }
    for (const name of ready) {
      ordered.push(name);
      remaining.delete(name);
    }
  }
  return ordered;
}

function decodeBinary(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeBinary);
  if (
    value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>)[BINARY_BACKUP_FIELD] === "string"
  ) {
    return Buffer.from(
      (value as Record<string, string>)[BINARY_BACKUP_FIELD],
      "base64",
    );
  }
  return value;
}

function valueForColumn(value: unknown, column: PublicColumn): unknown {
  if (value === null) return null;
  if (column.dataType === "json" || column.dataType === "jsonb") {
    return JSON.stringify(value);
  }
  if (column.dataType === "bytea" || column.udtName === "_bytea") {
    return decodeBinary(value);
  }
  return value;
}

async function insertBackupTable(
  client: BackupSqlClient,
  tableName: string,
  table: XStorePlatformBackup["tables"][number],
  columnsByTable: Map<string, PublicColumn[]>,
): Promise<void> {
  if (table.rows.length === 0) return;
  const currentColumns = columnsByTable.get(tableName) ?? [];
  const currentColumnsByName = new Map(
    currentColumns.map((column) => [column.name, column]),
  );
  const insertColumns = table.columns
    .map((name) => currentColumnsByName.get(name))
    .filter((column): column is PublicColumn => Boolean(column))
    .filter((column) => column.isGenerated !== "ALWAYS");
  const target = qualifiedTable(tableName);

  if (insertColumns.length === 0) {
    for (const _row of table.rows) {
      await client.query(`INSERT INTO ${target} DEFAULT VALUES`);
    }
    return;
  }

  const batchSize = Math.max(1, Math.floor(60_000 / insertColumns.length));
  const overridingSystemValue = insertColumns.some(
    (column) => column.isIdentity === "YES",
  )
    ? " OVERRIDING SYSTEM VALUE"
    : "";
  for (let offset = 0; offset < table.rows.length; offset += batchSize) {
    const batch = table.rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const valueRows = batch.map((row) => {
      const placeholders = insertColumns.map((column) => {
        values.push(valueForColumn(row[column.name], column));
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${target} (${insertColumns
        .map((column) => quoteIdentifier(column.name))
        .join(", ")})${overridingSystemValue} VALUES ${valueRows.join(", ")}`,
      values,
    );
  }
}

async function resetSequences(
  client: BackupSqlClient,
  tableNames: string[],
  columnsByTable: Map<string, PublicColumn[]>,
): Promise<void> {
  for (const tableName of tableNames) {
    for (const column of columnsByTable.get(tableName) ?? []) {
      const sequenceResult = await client.query<{ [key: string]: unknown; sequenceName: string | null }>(
        "SELECT pg_get_serial_sequence($1, $2) AS \"sequenceName\"",
        [`public.${quoteIdentifier(tableName)}`, column.name],
      );
      const sequenceName = sequenceResult.rows[0]?.sequenceName;
      if (!sequenceName) continue;

      const maxResult = await client.query<{ [key: string]: unknown; maxValue: string | null }>(
        `SELECT MAX(${quoteIdentifier(column.name)})::text AS "maxValue" FROM ${qualifiedTable(tableName)}`,
      );
      const maxValue = maxResult.rows[0]?.maxValue;
      if (maxValue === null || maxValue === undefined) continue;
      const validSequenceValue = BigInt(maxValue) >= 1n;
      await client.query(
        "SELECT setval($1::regclass, $2::bigint, $3)",
        [sequenceName, validSequenceValue ? maxValue : "1", validSequenceValue],
      );
    }
  }
}

export async function restoreXStorePlatformBackup(
  backup: XStorePlatformBackup,
): Promise<{ restoredTableCount: number; restoredRowCount: number; restoredAt: Date }> {
  const client = (await pool.connect()) as unknown as BackupSqlClient;
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [RESTORE_LOCK_NAME],
    );

    const tableNames = await getPublicTableNames(client);
    const columnsByTable = await getPublicColumns(client, tableNames);
    const backupTables = assertBackupMatchesSchema(
      backup,
      tableNames,
      columnsByTable,
    );
    const order = parentFirstOrder(tableNames, await getForeignKeyEdges(client));

    if (tableNames.length > 0) {
      await client.query(
        `TRUNCATE TABLE ${tableNames
          .map((tableName) => qualifiedTable(tableName))
          .join(", ")} RESTART IDENTITY`,
      );
    }

    for (const tableName of order) {
      const table = backupTables.get(tableName);
      if (table) {
        await insertBackupTable(client, tableName, table, columnsByTable);
      }
    }
    await resetSequences(client, tableNames, columnsByTable);
    await client.query("COMMIT");
    transactionStarted = false;

    return {
      restoredTableCount: tableNames.length,
      restoredRowCount: backup.rowCount,
      restoredAt: new Date(),
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
}
