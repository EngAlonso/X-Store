import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListXStorePlatformDatabaseRowsQueryKey,
  getListXStorePlatformDatabaseTablesQueryKey,
  useDeleteXStorePlatformDatabaseRow,
  useListXStorePlatformDatabaseRows,
  useListXStorePlatformDatabaseTables,
  type PlatformDatabaseRow,
  type PlatformDatabaseTable,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Database,
  Eye,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import "./platform-database.css";

const PAGE_SIZE = 25;
const fmt = (value: number) => new Intl.NumberFormat("ar-EG").format(value);

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

function compactValue(value: unknown): string {
  const formatted = formatValue(value);
  return formatted.length > 96 ? `${formatted.slice(0, 93)}…` : formatted;
}

function getApiError(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === "string" && message) return message;
    }
  }
  return "تعذر إكمال العملية. حاول مرة أخرى.";
}

export default function PlatformDatabasePage() {
  const queryClient = useQueryClient();
  const tableQuery = useListXStorePlatformDatabaseTables();
  const deleteRow = useDeleteXStorePlatformDatabaseRow();

  const [selectedTableName, setSelectedTableName] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<PlatformDatabaseRow | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<PlatformDatabaseRow | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!selectedTableName && tableQuery.data?.tables[0]) {
      setSelectedTableName(tableQuery.data.tables[0].name);
    }
  }, [selectedTableName, tableQuery.data?.tables]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [selectedTableName, settledSearch]);

  const rowsParams = useMemo(
    () => ({
      tableName: selectedTableName || "xstore_tenants",
      page,
      pageSize: PAGE_SIZE,
      ...(settledSearch ? { search: settledSearch } : {}),
    }),
    [page, selectedTableName, settledSearch],
  );
  const rowsQuery = useListXStorePlatformDatabaseRows(rowsParams, {
    query: {
      enabled: !!selectedTableName,
      queryKey: getListXStorePlatformDatabaseRowsQueryKey(rowsParams),
    },
  });

  useEffect(() => {
    const totalPages = rowsQuery.data?.totalPages;
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, rowsQuery.data?.totalPages]);

  useEffect(() => {
    if (!selectedRow && !deleteTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deleteTarget && !deleteRow.isPending) {
        setDeleteTarget(null);
        setConfirmation("");
        setDeleteError("");
        deleteRow.reset();
      } else if (selectedRow && !deleteTarget) {
        setSelectedRow(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteRow, deleteTarget, selectedRow]);

  const activeTable: PlatformDatabaseTable | undefined =
    tableQuery.data?.tables.find((table) => table.name === selectedTableName);
  const rows = rowsQuery.data?.rows ?? [];
  const columns = (rowsQuery.data?.columns ?? activeTable?.columns ?? []).filter(
    (column) => !column.primaryKey,
  );
  const expectedConfirmation = deleteTarget
    ? `حذف ${deleteTarget.id}`
    : "";

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setConfirmation("");
    setDeleteError("");
    deleteRow.reset();
  }

  function confirmDelete() {
    if (!deleteTarget || !activeTable || confirmation !== expectedConfirmation) {
      return;
    }
    setDeleteError("");
    deleteRow.mutate(
      {
        tableName: activeTable.name,
        rowId: deleteTarget.id,
        data: { confirmation },
      },
      {
        onSuccess: () => {
          setNotice(`تم حذف السجل ${deleteTarget.id}.`);
          setSelectedRow(null);
          closeDeleteDialog();
          void queryClient.invalidateQueries({
            queryKey: getListXStorePlatformDatabaseTablesQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getListXStorePlatformDatabaseRowsQueryKey(rowsParams),
          });
        },
        onError: (error) => setDeleteError(getApiError(error)),
      },
    );
  }

  return (
    <div className="platform-database-page" dir="rtl">
      <header className="platform-database-heading">
        <div>
          <div className="platform-database-eyebrow">
            <span className="platform-database-live-dot" />
            أدوات مالك المنصة
          </div>
          <h1>إدارة قاعدة البيانات</h1>
          <p>
            استعرض سجلات جميع المتاجر وابحث فيها. الحذف نهائي ويحتاج تأكيد
            المعرّف قبل التنفيذ.
          </p>
        </div>
        <div className="platform-database-owner-tag">
          <ShieldCheck size={16} />
          <span>صلاحية مالك المنصة</span>
        </div>
      </header>

      <section className="platform-database-summary" aria-label="ملخص قاعدة البيانات">
        <div className="platform-database-summary-icon">
          <Database size={21} />
        </div>
        <div>
          <span>نطاق الإدارة</span>
          <strong>
            {tableQuery.data
              ? `${fmt(tableQuery.data.tableCount)} جدول · ${fmt(tableQuery.data.totalRows)} سجل`
              : "بيانات جميع المتاجر"}
          </strong>
        </div>
        <div className="platform-database-summary-note">
          <LockKeyhole size={17} />
          <span>البيانات السرية مثل كلمات المرور لا تظهر في هذه الصفحة.</span>
        </div>
      </section>

      <div className="platform-database-workspace">
        <aside className="platform-database-table-panel">
          <div className="platform-database-panel-heading">
            <div>
              <span>المصدر</span>
              <h2>جداول النظام</h2>
            </div>
            <Database size={18} />
          </div>

          {tableQuery.isLoading ? (
            <div className="platform-database-table-skeleton" aria-label="جار تحميل الجداول">
              <i />
              <i />
              <i />
              <i />
            </div>
          ) : tableQuery.isError ? (
            <div className="platform-database-inline-state" role="alert">
              <AlertTriangle size={18} />
              <span>تعذر تحميل الجداول.</span>
              <button
                type="button"
                onClick={() => void tableQuery.refetch()}
                data-testid="button-retry-platform-database-tables"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <nav className="platform-database-table-list" aria-label="اختيار جدول">
              {(tableQuery.data?.tables ?? []).map((table) => (
                <button
                  key={table.name}
                  type="button"
                  className={`platform-database-table-option ${
                    selectedTableName === table.name
                      ? "platform-database-table-option-active"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedTableName(table.name);
                    setSelectedRow(null);
                    setNotice("");
                  }}
                  aria-current={selectedTableName === table.name ? "page" : undefined}
                  data-testid={`button-select-database-table-${table.name}`}
                >
                  <span className="platform-database-table-option-copy">
                    <strong>{table.label}</strong>
                    <small>{table.name}</small>
                  </span>
                  <span className="platform-database-table-count">
                    {fmt(table.rowCount)}
                  </span>
                </button>
              ))}
            </nav>
          )}
        </aside>

        <main className="platform-database-record-panel">
          <div className="platform-database-record-heading">
            <div>
              <span>عرض البيانات</span>
              <h2>{activeTable?.label ?? "اختر جدولًا"}</h2>
              <p>
                {activeTable
                  ? `${activeTable.name} · ${fmt(rowsQuery.data?.totalRows ?? activeTable.rowCount)} سجل مطابق`
                  : "حدد جدولًا لعرض سجلاته."}
              </p>
            </div>
            <button
              type="button"
              className="platform-database-refresh"
              onClick={() => {
                void tableQuery.refetch();
                if (selectedTableName) void rowsQuery.refetch();
              }}
              disabled={tableQuery.isFetching || rowsQuery.isFetching}
              aria-label="تحديث بيانات قاعدة البيانات"
              data-testid="button-refresh-platform-database"
            >
              <RefreshCw
                size={16}
                className={
                  tableQuery.isFetching || rowsQuery.isFetching
                    ? "platform-database-spinning"
                    : ""
                }
              />
              تحديث
            </button>
          </div>

          <div className="platform-database-controls">
            <label className="platform-database-search">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في سجلات الجدول الحالي..."
                aria-label="البحث في سجلات الجدول"
                data-testid="input-platform-database-search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="مسح البحث"
                  data-testid="button-clear-platform-database-search"
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <span className="platform-database-page-size">
              {fmt(PAGE_SIZE)} سجل في الصفحة
            </span>
          </div>

          {notice && (
            <div className="platform-database-notice" role="status">
              <ShieldCheck size={17} />
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="إغلاق الإشعار"
                data-testid="button-dismiss-platform-database-notice"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {!selectedTableName ? (
            <div className="platform-database-empty-state">
              <Database size={23} />
              <strong>
                {tableQuery.isLoading ? "جار تحميل الجداول..." : "اختر جدولًا"}
              </strong>
              <span>ستظهر سجلات الجدول المحدد هنا.</span>
            </div>
          ) : rowsQuery.isLoading ? (
            <div className="platform-database-loading">
              <i />
              <i />
              <i />
              <span>جار تحميل السجلات...</span>
            </div>
          ) : rowsQuery.isError ? (
            <div className="platform-database-empty-state" role="alert">
              <AlertTriangle size={22} />
              <strong>تعذر تحميل سجلات هذا الجدول</strong>
              <span>تحقق من الاتصال ثم أعد المحاولة.</span>
              <button
                type="button"
                onClick={() => void rowsQuery.refetch()}
                data-testid="button-retry-platform-database-rows"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="platform-database-empty-state">
              <Database size={23} />
              <strong>
                {settledSearch ? "لا توجد نتائج مطابقة" : "هذا الجدول فارغ"}
              </strong>
              <span>
                {settledSearch
                  ? "جرّب كلمة بحث أخرى."
                  : "ستظهر السجلات هنا عند توفرها."}
              </span>
            </div>
          ) : (
            <>
              {activeTable?.deleteWarning && (
                <div
                  className={`platform-database-table-warning ${
                    activeTable.deletable
                      ? "platform-database-table-warning-caution"
                      : "platform-database-table-warning-locked"
                  }`}
                >
                  {activeTable.deletable ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <LockKeyhole size={16} />
                  )}
                  <span>{activeTable.deleteWarning}</span>
                </div>
              )}
              <div className="platform-database-grid-wrap">
                <table className="platform-database-grid">
                  <thead>
                    <tr>
                      <th scope="col">المعرّف</th>
                      {columns.map((column) => (
                        <th key={column.name} scope="col">
                          {column.name}
                        </th>
                      ))}
                      <th scope="col">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={
                          selectedRow?.id === row.id
                            ? "platform-database-row-selected"
                            : ""
                        }
                        data-testid={`row-platform-database-${row.id}`}
                      >
                        <td className="platform-database-id-cell" title={row.id}>
                          <span>{row.id}</span>
                        </td>
                        {columns.map((column) => (
                          <td
                            key={`${row.id}-${column.name}`}
                            title={formatValue(row.values[column.name])}
                          >
                            {compactValue(row.values[column.name])}
                          </td>
                        ))}
                        <td className="platform-database-actions-cell">
                          <button
                            type="button"
                            className="platform-database-view-button"
                            onClick={() => setSelectedRow(row)}
                            data-testid={`button-view-database-row-${row.id}`}
                          >
                            <Eye size={15} />
                            <span>عرض</span>
                          </button>
                          {row.canDelete ? (
                            <button
                              type="button"
                              className="platform-database-delete-button"
                              onClick={() => {
                                setDeleteError("");
                                setConfirmation("");
                                setDeleteTarget(row);
                              }}
                              data-testid={`button-delete-database-row-${row.id}`}
                            >
                              <Trash2 size={15} />
                              <span>حذف</span>
                            </button>
                          ) : (
                            <span
                              className="platform-database-protected-badge"
                              title={row.deleteBlockedReason ?? "سجل محمي"}
                            >
                              <LockKeyhole size={14} />
                              محمي
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="platform-database-pagination">
                <span>
                  صفحة {fmt(rowsQuery.data?.page ?? page)} من{" "}
                  {fmt(rowsQuery.data?.totalPages ?? 1)}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || rowsQuery.isFetching}
                    aria-label="الصفحة السابقة"
                    data-testid="button-platform-database-previous-page"
                  >
                    <ArrowRight size={16} />
                    السابق
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) =>
                        Math.min(rowsQuery.data?.totalPages ?? 1, current + 1),
                      )
                    }
                    disabled={
                      page >= (rowsQuery.data?.totalPages ?? 1) ||
                      rowsQuery.isFetching
                    }
                    aria-label="الصفحة التالية"
                    data-testid="button-platform-database-next-page"
                  >
                    التالي
                    <ArrowLeft size={16} />
                  </button>
                </div>
              </footer>
            </>
          )}
        </main>
      </div>

      {selectedRow && activeTable && (
        <div
          className="platform-database-detail-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedRow(null);
          }}
        >
          <section
            className="platform-database-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-database-detail-title"
          >
            <header>
              <div>
                <span>{activeTable.label}</span>
                <h2 id="platform-database-detail-title">تفاصيل السجل</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                aria-label="إغلاق التفاصيل"
                data-testid="button-close-database-row-details"
              >
                <X size={18} />
              </button>
            </header>
            <div className="platform-database-detail-id">
              <small>المعرّف</small>
              <code>{selectedRow.id}</code>
            </div>
            <dl className="platform-database-detail-fields">
              {columns.map((column) => (
                <div key={column.name}>
                  <dt>{column.name}</dt>
                  <dd>{formatValue(selectedRow.values[column.name])}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {deleteTarget && activeTable && (
        <div className="platform-database-detail-scrim">
          <section
            className="platform-database-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="platform-database-delete-title"
          >
            <div className="platform-database-delete-icon">
              <Trash2 size={22} />
            </div>
            <h2 id="platform-database-delete-title">تأكيد الحذف النهائي</h2>
            <p>
              سيتم حذف السجل من جدول <b>{activeTable.label}</b>. هذا الإجراء
              نهائي وقد يؤثر على بيانات مرتبطة حسب نوع السجل.
            </p>
            {activeTable.deleteWarning && (
              <div className="platform-database-delete-warning">
                <AlertTriangle size={16} />
                <span>{activeTable.deleteWarning}</span>
              </div>
            )}
            <label className="platform-database-confirmation-field">
              <span>
                اكتب <code>{expectedConfirmation}</code> للمتابعة
              </span>
              <input
                type="text"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                data-testid="input-confirm-platform-database-delete"
              />
            </label>
            {deleteError && (
              <div className="platform-database-delete-error" role="alert">
                {deleteError}
              </div>
            )}
            {deleteRow.isError && !deleteError && (
              <div className="platform-database-delete-error" role="alert">
                {getApiError(deleteRow.error)}
              </div>
            )}
            <div className="platform-database-delete-actions">
              <button
                type="button"
                className="platform-database-cancel-button"
                onClick={closeDeleteDialog}
                disabled={deleteRow.isPending}
                data-testid="button-cancel-platform-database-delete"
              >
                إلغاء
              </button>
              <button
                type="button"
                className="platform-database-confirm-delete-button"
                onClick={confirmDelete}
                disabled={
                  deleteRow.isPending || confirmation !== expectedConfirmation
                }
                data-testid="button-confirm-platform-database-delete"
              >
                <Trash2 size={16} />
                {deleteRow.isPending ? "جارٍ الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
