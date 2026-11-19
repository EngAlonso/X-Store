import { useRef, useState } from 'react';
import { Database, Download, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function PoultryBackupPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function downloadBackup() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/xstore/poultry/backup', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'تعذر إنشاء النسخة الاحتياطية.');
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `x-store-poultry-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setMessage('تم تنزيل نسخة الدواجن الاحتياطية بنجاح.');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء النسخة الاحتياطية.'); }
    finally { setBusy(false); }
  }
  async function restoreBackup(file: File) {
    setBusy(true); setError(''); setMessage('');
    try {
      const backup = JSON.parse(await file.text());
      if (!window.confirm('سيتم استبدال بيانات نظام الدواجن الحالية بالبيانات الموجودة في النسخة. هل تريد المتابعة؟')) return;
      const response = await fetch('/api/xstore/poultry/backup/restore', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(backup) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'تعذرت استعادة النسخة الاحتياطية.');
      setMessage('تمت استعادة نسخة الدواجن بنجاح. حدّث الصفحات لعرض البيانات المستعادة.');
    } catch (e) { setError(e instanceof Error ? e.message : 'ملف النسخة الاحتياطية غير صالح.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }
  return <div className="poultry-backup-page" dir="rtl">
    <div className="poultry-backup-head"><div><span>نظام الدواجن</span><h1>النسخة الاحتياطية</h1><p>نسخة مستقلة لبيانات متجر الدواجن، بدون خلطها ببيانات أنظمة المتاجر الأخرى.</p></div><Database size={36}/></div>
    <div className="poultry-backup-card"><div className="poultry-backup-actions"><button className="poultry-backup-primary" onClick={() => void downloadBackup()} disabled={busy}><Download size={17}/> تنزيل نسخة احتياطية</button><button className="poultry-backup-secondary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={17}/> استعادة نسخة</button><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={e => { const file=e.target.files?.[0]; if(file) void restoreBackup(file); }} /></div>
      <div className="poultry-backup-notes"><div><ShieldCheck size={18}/><span><b>مخصصة لمتجر الدواجن</b><small>النسخة مرتبطة بالمتجر الحالي ولا يمكن استعادتها على متجر آخر.</small></span></div><div><AlertTriangle size={18}/><span><b>الاستعادة تستبدل بيانات الدواجن الحالية</b><small>نزّل نسخة حالية قبل الاستعادة إذا كنت تريد الاحتفاظ بها.</small></span></div></div>
      {message && <div className="poultry-backup-success">{message}</div>}{error && <div className="poultry-backup-error">{error}</div>}
    </div>
  </div>;
}
