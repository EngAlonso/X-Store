import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  getDownloadXStorePlatformBackupQueryKey,
  useDownloadXStorePlatformBackup,
  useGetXStorePlatformBackupSummary,
  useRestoreXStorePlatformBackup,
} from '@workspace/api-client-react';
import type { XStorePlatformBackup } from '@workspace/api-client-react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  FileJson2,
  HardDriveDownload,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

const CONFIRMATION_PHRASE = 'استعادة المنصة';
const fmt = (value: number) => new Intl.NumberFormat('ar-SA').format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat('ar-SA', {
  dateStyle: 'long',
  timeStyle: 'short',
}).format(new Date(value));

function parseBackup(value: unknown): XStorePlatformBackup {
  if (!value || typeof value !== 'object') throw new Error('الملف لا يحتوي على نسخة احتياطية صالحة.');
  const backup = value as Partial<XStorePlatformBackup>;
  if (
    backup.format !== 'xstore-platform-backup' ||
    backup.version !== 1 ||
    typeof backup.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(backup.createdAt)) ||
    !Array.isArray(backup.tables)
  ) throw new Error('تنسيق الملف غير مدعوم أو أن بياناته غير مكتملة.');

  const validTables = backup.tables.every(table =>
    !!table &&
    typeof table.name === 'string' &&
    Array.isArray(table.columns) &&
    table.columns.every(column => typeof column === 'string') &&
    Array.isArray(table.rows) &&
    table.rows.every(row => !!row && typeof row === 'object' && !Array.isArray(row)),
  );
  if (!validTables) throw new Error('بنية الجداول في الملف غير صالحة.');

  const actualRows = backup.tables.reduce((total, table) => total + table.rows.length, 0);
  if (
    backup.tableCount !== backup.tables.length ||
    backup.rowCount !== actualRows ||
    !Number.isInteger(backup.tableCount) ||
    !Number.isInteger(backup.rowCount)
  ) throw new Error('أعداد الجداول أو السجلات لا تطابق محتوى الملف.');
  if (new Set(backup.tables.map(table => table.name)).size !== backup.tables.length) {
    throw new Error('الملف يحتوي أسماء جداول مكررة.');
  }

  return backup as XStorePlatformBackup;
}

export default function PlatformBackupPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const summary = useGetXStorePlatformBackupSummary();
  const [downloadRequested, setDownloadRequested] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const downloadBaseline = useRef<XStorePlatformBackup | undefined>(undefined);
  const lastDownloadedAt = useRef(0);
  const download = useDownloadXStorePlatformBackup({
    query: {
      enabled: false,
      queryKey: getDownloadXStorePlatformBackupQueryKey(),
      staleTime: 0,
      refetchOnMount: false,
    },
  });

  const [selectedBackup, setSelectedBackup] = useState<XStorePlatformBackup | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [restoreWarningAccepted, setRestoreWarningAccepted] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const restore = useRestoreXStorePlatformBackup();

  useEffect(() => {
    if (
      !downloadRequested ||
      download.isFetching ||
      !download.data ||
      download.data === downloadBaseline.current ||
      download.dataUpdatedAt === lastDownloadedAt.current
    ) return;
    lastDownloadedAt.current = download.dataUpdatedAt;
    const blob = new Blob([JSON.stringify(download.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `x-store-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadMessage('تم إنشاء ملف النسخة الاحتياطية وتنزيله.');
    setDownloadRequested(false);
  }, [download.data, download.dataUpdatedAt, download.isFetching, downloadRequested]);

  useEffect(() => {
    if (!downloadRequested || !download.isError) return;
    setDownloadMessage('');
    setDownloadRequested(false);
  }, [download.isError, downloadRequested]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError('');
    setSelectedBackup(null);
    setFileName('');
    setRestoreWarningAccepted(false);
    setTypedConfirmation('');
    setRestoreSuccess('');
    if (!file) return;
    const currentSummary = summary.data;
    const maxBackupBytes = currentSummary?.maxBackupBytes;
    if (!currentSummary || !maxBackupBytes) {
      setFileError('تعذر تحميل حد حجم النسخة. أعد تحميل نطاق النسخ ثم حاول مرة أخرى.');
      event.target.value = '';
      return;
    }
    if (file.size > maxBackupBytes) {
      setFileError(`حجم الملف يتجاوز الحد المسموح به (${fmt(Math.ceil(maxBackupBytes / (1024 * 1024)))} ميبيبايت).`);
      event.target.value = '';
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validBackup = parseBackup(parsed);
      const currentTableNames = new Set(currentSummary.tables.map(table => table.name));
      const backupTableNames = new Set(validBackup.tables.map(table => table.name));
      if (
        backupTableNames.size !== currentTableNames.size ||
        Array.from(currentTableNames).some(tableName => !backupTableNames.has(tableName))
      ) {
        throw new Error('النسخة لا تحتوي جميع جداول قاعدة البيانات الحالية. لم يتم تغيير أي بيانات.');
      }
      setSelectedBackup(validBackup);
      setFileName(file.name);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'تعذرت قراءة ملف النسخة الاحتياطية.');
    }
    event.target.value = '';
  }

  function requestDownload() {
    setDownloadMessage('');
    downloadBaseline.current = download.data;
    setDownloadRequested(true);
    void download.refetch();
  }

  function submitRestore() {
    if (!selectedBackup || !restoreWarningAccepted || typedConfirmation !== CONFIRMATION_PHRASE || restore.isPending) return;
    setRestoreSuccess('');
    restore.mutate(
      { data: { backup: selectedBackup, confirmation: typedConfirmation } },
      {
        onSuccess: result => {
          setRestoreSuccess(`اكتملت الاستعادة: ${fmt(result.restoredTableCount)} جدولاً و${fmt(result.restoredRowCount)} سجلاً. سيتم مسح جلستك الحالية ثم توجيهك إلى تسجيل الدخول.`);
          window.setTimeout(() => {
            queryClient.clear();
            setLocation('/sign-in');
          }, 1800);
        },
      },
    );
  }

  const restoreReady = !!selectedBackup && restoreWarningAccepted && typedConfirmation === CONFIRMATION_PHRASE;

  return <div className="backup-page" dir="rtl" data-testid="page-platform-backup">
    <div className="page-title backup-page-title">
      <div>
        <div className="eyebrow"><span className="backup-live-dot"/> حماية بيانات المنصة</div>
        <h1>النسخ الاحتياطي والاستعادة</h1>
        <p>إدارة نسخة موثوقة من بيانات جميع المتاجر وسجلاتها، من مساحة مالك المنصة.</p>
      </div>
      <div className="backup-secure-tag"><ShieldCheck size={16}/> تحكم محمي لمالك المنصة</div>
    </div>

    <section className="backup-overview" aria-label="ملخص بيانات النسخة">
      <div className="backup-overview-copy">
        <span className="backup-kicker"><Database size={15}/> النطاق الحالي</span>
        <h2>كل بيانات المتاجر في نقطة استعادة واحدة.</h2>
        <p>تشمل النسخة جداول المنصة وسجلاتها كما هي الآن. أنشئ ملفاً محفوظاً خارج النظام قبل أي تغيير واسع.</p>
        <div className="backup-summary-numbers">
          <div><span>الجداول المشمولة</span><b data-testid="text-backup-table-count">{summary.data ? fmt(summary.data.tableCount) : '—'}</b></div>
          <div><span>إجمالي السجلات</span><b data-testid="text-backup-row-count">{summary.data ? fmt(summary.data.rowCount) : '—'}</b></div>
        </div>
      </div>
      <div className="backup-overview-art" aria-hidden="true">
        <div className="backup-orbit backup-orbit-outer"/>
        <div className="backup-orbit backup-orbit-inner"/>
        <div className="backup-vault"><HardDriveDownload size={33}/><span/></div>
        <span className="backup-art-index">X / SAFE</span>
      </div>
    </section>

    {summary.isLoading
      ? <section className="panel backup-table-panel" aria-label="جار تحميل نطاق النسخة"><div className="backup-skeleton-heading"/><div className="backup-skeleton-rows"><i/><i/><i/></div></section>
      : summary.isError
        ? <section className="panel backup-table-panel" role="alert" data-testid="status-backup-summary-error">
          <div className="backup-state backup-state-error"><AlertTriangle size={21}/><b>تعذر تحميل نطاق النسخة الاحتياطية</b><span>تحقق من الاتصال ثم أعد المحاولة.</span><button className="button button-quiet button-small" type="button" onClick={() => void summary.refetch()} data-testid="button-retry-backup-summary"><RefreshCw size={14}/> إعادة المحاولة</button></div>
        </section>
        : <section className="panel backup-table-panel">
          <div className="section-head">
            <div><h2>الجداول والسجلات المشمولة</h2><span data-testid="text-backup-scope-detail">{fmt(summary.data?.tableCount ?? 0)} جداول · {fmt(summary.data?.rowCount ?? 0)} سجلاً في النطاق الحالي</span></div>
            <span className="backup-included-badge"><Check size={14}/> النطاق الكامل</span>
          </div>
          {!summary.data?.tables.length
            ? <div className="backup-empty" data-testid="empty-backup-scope"><Database size={22}/><b>لا توجد جداول لعرضها</b><span>سيظهر نطاق النسخة هنا عندما تتوفر بيانات.</span></div>
            : <div className="backup-table-list" data-testid="list-backup-tables">
              {summary.data.tables.map(table => <div key={table.name} className="backup-table-row" data-testid={`row-backup-table-${table.name}`}>
                <span className="backup-table-icon"><Database size={15}/></span>
                <b>{table.name}</b>
                <span className="backup-row-count">{fmt(table.rowCount)} <small>سجل</small></span>
              </div>)}
            </div>}
        </section>}

    <div className="backup-workflow-grid">
      <section className="panel backup-action-panel">
        <div className="backup-panel-heading">
          <span className="backup-step">١</span>
          <div><span className="backup-panel-kicker">حفظ نسخة خارجية</span><h2>تنزيل نسخة المنصة</h2></div>
          <span className="backup-heading-icon"><ArrowDownToLine size={18}/></span>
        </div>
        <p>سيُنشأ ملف JSON جديد من البيانات الحالية عند الطلب، ويمكنك حفظه في مكان آمن.</p>
        <button type="button" className="button button-primary backup-download-button" onClick={requestDownload} disabled={downloadRequested || download.isFetching} data-testid="button-download-platform-backup">
          <HardDriveDownload size={17}/>{downloadRequested || download.isFetching ? 'جارٍ تجهيز النسخة…' : 'إنشاء وتنزيل ملف النسخة'}
        </button>
        {download.isError && <div className="backup-inline-error" role="alert" data-testid="status-backup-download-error">{getErrorMessage(download.error, 'تعذر إنشاء الملف.')} <button type="button" onClick={requestDownload} data-testid="button-retry-backup-download">أعد المحاولة</button></div>}
        {downloadMessage && <div className="backup-inline-success" role="status" data-testid="status-backup-download-success"><CheckCircle2 size={15}/>{downloadMessage}</div>}
        <div className="backup-meta"><LockKeyhole size={13}/> يتضمن بيانات الحسابات وكلمات المرور المشفّرة وسجلات المبيعات؛ احفظه في مكان آمن</div>
      </section>

      <section className="panel backup-action-panel restore-panel">
        <div className="backup-panel-heading">
          <span className="backup-step">٢</span>
          <div><span className="backup-panel-kicker">استعادة من ملف</span><h2>اختيار نسخة احتياطية</h2></div>
          <span className="backup-heading-icon"><Upload size={18}/></span>
        </div>
        <p>اختر ملف X-Store JSON صالحاً لعرض تفاصيله قبل بدء الاستعادة.</p>
        <label className="backup-file-picker" htmlFor="platform-backup-file" data-testid="label-backup-file-picker">
          <span className="backup-file-icon"><FileJson2 size={20}/></span>
          <span><b>{fileName || 'اختر ملف النسخة الاحتياطية'}</b><small>JSON · الحد الأقصى {summary.data ? fmt(Math.ceil(summary.data.maxBackupBytes / (1024 * 1024))) : '—'} ميبيبايت</small></span>
          <span className="button button-quiet button-small">استعراض الملفات</span>
          <input id="platform-backup-file" type="file" accept=".json,application/json" onChange={handleFileChange} disabled={!summary.data} data-testid="input-platform-backup-file"/>
        </label>
        {fileError && <div className="backup-inline-error" role="alert" data-testid="status-backup-file-error">{fileError}</div>}
        {selectedBackup && <div className="backup-selected-file" data-testid="content-selected-backup">
            <div className="backup-selected-heading"><CheckCircle2 size={16}/><b>تم التحقق من التنسيق ونطاق الجداول</b><span>{fileName}</span></div>
          <div className="backup-file-facts">
            <div><Clock3 size={14}/><span>تاريخ اللقطة</span><b data-testid="text-selected-backup-date">{dateLabel(selectedBackup.createdAt)}</b></div>
            <div><Database size={14}/><span>عدد الجداول</span><b data-testid="text-selected-backup-table-count">{fmt(selectedBackup.tableCount)}</b></div>
            <div><FileJson2 size={14}/><span>عدد السجلات</span><b data-testid="text-selected-backup-row-count">{fmt(selectedBackup.rowCount)}</b></div>
          </div>
        </div>}
      </section>
    </div>

    <section className="backup-restore-zone" aria-labelledby="backup-restore-title">
      <div className="backup-restore-heading">
        <span className="backup-danger-icon"><AlertTriangle size={20}/></span>
        <div><span className="backup-panel-kicker">إجراء غير قابل للتراجع</span><h2 id="backup-restore-title">استعادة بيانات المنصة</h2></div>
      </div>
      <div className="backup-warning" role="note" data-testid="content-restore-warning">
        <b>تنبيه مهم قبل المتابعة</b>
        <p>ستستبدل الاستعادة بيانات المنصة الحالية بالكامل، بما في ذلك المتاجر والحسابات وسجلاتها. لا يمكن التراجع عن هذا الإجراء. بعد نجاحه ستُنهى جلستك ويجب تسجيل الدخول بحساب موجود في النسخة.</p>
      </div>
      {!selectedBackup && <div className="backup-restore-prerequisite"><LockKeyhole size={15}/> اختر ملفاً صالحاً أولاً لفتح تأكيد الاستعادة.</div>}
      <label className={`backup-checkbox-row ${!selectedBackup ? 'is-disabled' : ''}`}>
        <input type="checkbox" checked={restoreWarningAccepted} onChange={event => setRestoreWarningAccepted(event.target.checked)} disabled={!selectedBackup || restore.isPending} data-testid="checkbox-accept-restore-warning"/>
        <span>أفهم أن هذه العملية ستستبدل بيانات المنصة الحالية بالكامل.</span>
      </label>
      <label className={`field backup-confirm-field ${!selectedBackup ? 'is-disabled' : ''}`}>
        <span>اكتب عبارة التأكيد كما هي: <b>{CONFIRMATION_PHRASE}</b></span>
        <input type="text" value={typedConfirmation} onChange={event => setTypedConfirmation(event.target.value)} disabled={!selectedBackup || restore.isPending} autoComplete="off" aria-label={`اكتب ${CONFIRMATION_PHRASE}`} placeholder="اكتب عبارة التأكيد هنا" data-testid="input-restore-confirmation"/>
      </label>
      {restore.isError && <div className="backup-inline-error restore-error" role="alert" data-testid="status-restore-error">{getErrorMessage(restore.error)}</div>}
      {restoreSuccess && <div className="backup-restore-success" role="status" data-testid="status-restore-success"><CheckCircle2 size={19}/><span>{restoreSuccess}</span></div>}
      <div className="backup-restore-footer">
        <span><ShieldCheck size={14}/> يتطلب تأكيدين منفصلين لحماية بيانات المتاجر</span>
        <button type="button" className="button backup-restore-button" onClick={submitRestore} disabled={!restoreReady || restore.isPending || !!restoreSuccess} data-testid="button-restore-platform-backup">
          {restore.isPending ? <><RefreshCw size={16} className="backup-spin"/> جارٍ استعادة البيانات…</> : <><AlertTriangle size={16}/> استعادة المنصة الآن</>}
        </button>
      </div>
    </section>
  </div>;
}

function getErrorMessage(error: unknown, fallback = 'تعذرت استعادة بيانات المنصة. تحقق من الملف وحاول مرة أخرى.'): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}
