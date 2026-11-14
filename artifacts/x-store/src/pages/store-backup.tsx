import { useState, type ChangeEvent } from "react";
import { Download, Upload, ShieldCheck, Database, CheckCircle2, AlertTriangle } from "lucide-react";

type BackupPayload = {
  format: "xstore-store-backup";
  version: 1;
  tenantId: string;
  createdAt: string;
  tables: Record<string, unknown[]>;
};

export default function StoreBackupPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function downloadBackup() {
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/xstore/store-backup", { credentials: "include" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "تعذر إنشاء النسخة الاحتياطية.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `x-store-store-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("تم إنشاء نسخة المتجر وتنزيلها بنجاح.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء النسخة الاحتياطية.");
    } finally { setBusy(false); }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("استعادة النسخة ستستبدل منتجات المتجر وفواتيره والفواتير المعلقة والمرتجعات الحالية. هل تريد المتابعة؟")) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupPayload;
      if (backup.format !== "xstore-store-backup" || backup.version !== 1) throw new Error("ملف النسخة غير مدعوم.");
      const response = await fetch("/api/xstore/store-backup/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "تعذرت استعادة النسخة.");
      setNotice("تمت استعادة نسخة المتجر بنجاح. أعد تحميل الصفحة لتحديث البيانات.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذرت قراءة النسخة الاحتياطية.");
    } finally { setBusy(false); }
  }

  return <div dir="rtl">
    <div className="page-title">
      <div><div className="eyebrow">حماية بيانات متجرك</div><h1>النسخ الاحتياطي</h1><p>احفظ نسخة من منتجاتك وفواتيرك وبيانات التشغيل الخاصة بمتجرك فقط.</p></div>
      <div className="backup-secure-tag"><ShieldCheck size={16}/> نسخة خاصة بمتجرك</div>
    </div>
    <div className="backup-workflow-grid">
      <section className="panel backup-action-panel">
        <div className="backup-panel-heading"><span className="backup-heading-icon"><Download size={18}/></span><div><span className="backup-panel-kicker">حفظ نسخة خارجية</span><h2>تنزيل نسخة المتجر</h2></div></div>
        <p>تشمل المنتجات والمبيعات وتفاصيل الفواتير والفواتير المعلقة والمرتجعات. لا تتضمن بيانات متاجر أخرى أو كلمات المرور.</p>
        <button className="button button-primary backup-download-button" onClick={() => void downloadBackup()} disabled={busy}><Download size={17}/>{busy ? "جارٍ التنفيذ…" : "إنشاء وتنزيل النسخة"}</button>
      </section>
      <section className="panel backup-action-panel">
        <div className="backup-panel-heading"><span className="backup-heading-icon"><Upload size={18}/></span><div><span className="backup-panel-kicker">استعادة</span><h2>استعادة نسخة المتجر</h2></div></div>
        <p>الاستعادة تخص بيانات هذا المتجر فقط. يُنصح بإنشاء نسخة جديدة قبل الاستعادة.</p>
        <label className="backup-file-picker">
          <span className="backup-file-icon"><Database size={20}/></span><span><b>اختر ملف النسخة</b><small>JSON · نسخة X-Store للمتجر</small></span>
          <span className="button button-quiet button-small">استعراض الملفات</span>
          <input type="file" accept=".json,application/json" onChange={restoreBackup} disabled={busy}/>
        </label>
      </section>
    </div>
    {error && <div className="backup-inline-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
    {notice && <div className="backup-inline-success" role="status"><CheckCircle2 size={15}/>{notice}</div>}
    <section className="panel" style={{marginTop:16}}>
      <div className="backup-meta"><ShieldCheck size={14}/> النسخة خاصة بمتجرك ولا تشمل بيانات المتاجر الأخرى أو كلمات المرور.</div>
    </section>
  </div>;
}
