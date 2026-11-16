import { useState, type ChangeEvent } from 'react';
import { CheckCircle2, Database, Download, FileArchive, ShieldCheck, Upload, AlertTriangle } from 'lucide-react';

type PoultryBackup = {
  format: 'xstore-poultry-backup';
  version: 1;
  backupType: 'full';
  tenantId: string;
  createdAt: string;
  tables: Record<string, unknown[]>;
};

export default function PoultryBackupPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function downloadBackup() {
    setBusy(true); setNotice(''); setError('');
    try {
      const response = await fetch('/api/xstore/poultry/backup', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'تعذر إنشاء نسخة الدواجن.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'x-store-poultry-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('تم إنشاء نسخة الدواجن الكاملة وتنزيلها بنجاح.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء النسخة الاحتياطية.');
    } finally { setBusy(false); }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setNotice(''); setError('');
    try {
      const backup = JSON.parse(await file.text()) as PoultryBackup;
      if (backup.format !== 'xstore-poultry-backup' || backup.version !== 1 || backup.backupType !== 'full' || !backup.tables) {
        throw new Error('ملف النسخة غير مدعوم. استخدم نسخة الدواجن الصادرة من هذا القسم.');
      }
      if (!window.confirm('استعادة نسخة الدواجن ستستبدل بيانات العملاء والفواتير والتحصيلات والسجل الخاص بهذا المتجر. هل تريد المتابعة؟')) return;
      setBusy(true);
      const response = await fetch('/api/xstore/poultry/backup/restore', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(backup),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'تعذرت استعادة نسخة الدواجن.');
      setNotice('تمت استعادة نسخة الدواجن بنجاح. أعد تحميل الصفحة لتحديث البيانات.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذرت قراءة النسخة الاحتياطية.');
    } finally { setBusy(false); }
  }

  return <div dir="rtl">
    <div className="page-title">
      <div><div className="eyebrow">حماية بيانات الدواجن</div><h1>النسخة الاحتياطية</h1><p>نسخة مستقلة لنظام الدواجن تشمل بيانات حساب متجرك فقط، بدون خلطها مع نسخ المتاجر الأخرى.</p></div>
      <div className="backup-secure-tag"><ShieldCheck size={16}/> نسخة دواجن خاصة بمتجرك</div>
    </div>
    <section className="panel backup-action-panel">
      <div className="backup-panel-heading"><span className="backup-heading-icon"><Database size={18}/></span><div><span className="backup-panel-kicker">نسخة كاملة</span><h2>كل بيانات نظام الدواجن</h2></div></div>
      <p>النسخة تشمل العملاء والفواتير وتفاصيل الأصناف والتحصيلات وسجل العمليات المرتبط بحساب هذا المتجر فقط.</p>
      <button className="button button-primary backup-download-button" onClick={() => void downloadBackup()} disabled={busy}>
        <Download size={17}/>{busy ? 'جارٍ إنشاء النسخة…' : 'إنشاء وتنزيل النسخة'}
      </button>
    </section>
    <section className="panel backup-action-panel" style={{ marginTop: 16 }}>
      <div className="backup-panel-heading"><span className="backup-heading-icon"><Upload size={18}/></span><div><span className="backup-panel-kicker">استعادة</span><h2>استعادة نسخة الدواجن</h2></div></div>
      <p>اختر ملف نسخة الدواجن. النظام يرفض تلقائيًا أي نسخة تخص متجرًا أو حسابًا آخر.</p>
      <label className="backup-file-picker">
        <span className="backup-file-icon"><FileArchive size={20}/></span><span><b>اختر ملف النسخة</b><small>JSON · نسخة X-Store للدواجن</small></span>
        <span className="button button-quiet button-small">استعراض الملفات</span>
        <input type="file" accept=".json,application/json" onChange={restoreBackup} disabled={busy}/>
      </label>
    </section>
    {error && <div className="backup-inline-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
    {notice && <div className="backup-inline-success" role="status"><CheckCircle2 size={15}/>{notice}</div>}
    <section className="panel" style={{marginTop:16}}><div className="backup-meta"><ShieldCheck size={14}/> النسخة لا تشمل بيانات المتاجر الأخرى، ولا تسمح باستعادة نسخة بحساب مختلف.</div></section>
  </div>;
}
