import { useState, type ChangeEvent } from "react";
import { Download, Upload, ShieldCheck, Database, CheckCircle2, AlertTriangle, FileArchive, Boxes, ReceiptText } from "lucide-react";

type BackupType = "full" | "invoices" | "inventory";
type BackupPayload = {
  format: "xstore-store-backup";
  version: 2;
  backupType: BackupType;
  tenantId: string;
  createdAt: string;
  tables: Record<string, unknown[]>;
};

const backupOptions: Array<{
  type: BackupType;
  title: string;
  description: string;
  icon: typeof Database;
}> = [
  {
    type: "full",
    title: "نسخة كاملة",
    description: "المنتجات + الفواتير + الفواتير المعلقة + المرتجعات.",
    icon: Database,
  },
  {
    type: "invoices",
    title: "نسخة الفواتير",
    description: "المبيعات وتفاصيل الفواتير والفواتير المعلقة والمرتجعات فقط.",
    icon: ReceiptText,
  },
  {
    type: "inventory",
    title: "نسخة المخزون",
    description: "المنتجات وكميات وأسعار المخزون فقط.",
    icon: Boxes,
  },
];

export default function StoreBackupPage() {
  const [busyType, setBusyType] = useState<BackupType | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function downloadBackup(type: BackupType) {
    setBusyType(type); setNotice(""); setError("");
    try {
      const response = await fetch(`/api/xstore/store-backup?type=${type}`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "تعذر إنشاء النسخة الاحتياطية.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `x-store-${type}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(type === "full" ? "تم إنشاء النسخة الكاملة وتنزيلها بنجاح." : type === "invoices" ? "تم إنشاء نسخة الفواتير وتنزيلها بنجاح." : "تم إنشاء نسخة المخزون وتنزيلها بنجاح.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء النسخة الاحتياطية.");
    } finally { setBusyType(null); }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusyType("full"); setNotice(""); setError("");
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupPayload;
      if (backup.format !== "xstore-store-backup" || backup.version !== 2 || !["full", "invoices", "inventory"].includes(backup.backupType)) {
        throw new Error("ملف النسخة غير مدعوم. استخدم نسخة صادرة من قسم النسخ الاحتياطي الحالي.");
      }
      const labels: Record<BackupType, string> = {
        full: "النسخة الكاملة وستستبدل بيانات المتجر الحالية.",
        invoices: "الفواتير فقط وستستبدل الفواتير والمرتجعات والفواتير المعلقة الحالية.",
        inventory: "المخزون فقط وسيستبدل المنتجات الحالية.",
      };
      if (!window.confirm(`استعادة ${labels[backup.backupType]} هل تريد المتابعة؟`)) return;

      const response = await fetch("/api/xstore/store-backup/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "تعذرت استعادة النسخة.");
      setNotice("تمت استعادة النسخة بنجاح. أعد تحميل الصفحة لتحديث البيانات.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذرت قراءة النسخة الاحتياطية.");
    } finally { setBusyType(null); }
  }

  return <div dir="rtl">
    <div className="page-title">
      <div>
        <div className="eyebrow">حماية بيانات متجرك</div>
        <h1>النسخ الاحتياطي</h1>
        <p>اختر نوع البيانات التي تريد حفظها أو استعادتها.</p>
      </div>
      <div className="backup-secure-tag"><ShieldCheck size={16}/> نسخة خاصة بمتجرك</div>
    </div>

    <div className="backup-workflow-grid">
      {backupOptions.map(({ type, title, description, icon: Icon }) => (
        <section className="panel backup-action-panel" key={type}>
          <div className="backup-panel-heading">
            <span className="backup-heading-icon"><Icon size={18}/></span>
            <div><span className="backup-panel-kicker">نسخة {type === "full" ? "شاملة" : type === "invoices" ? "جزئية" : "جزئية"}</span><h2>{title}</h2></div>
          </div>
          <p>{description}</p>
          <button className="button button-primary backup-download-button" onClick={() => void downloadBackup(type)} disabled={busyType !== null}>
            <Download size={17}/>{busyType === type ? "جارٍ التنفيذ…" : "إنشاء وتنزيل النسخة"}
          </button>
        </section>
      ))}
    </div>

    <section className="panel backup-action-panel" style={{ marginTop: 16 }}>
      <div className="backup-panel-heading">
        <span className="backup-heading-icon"><Upload size={18}/></span>
        <div><span className="backup-panel-kicker">استعادة</span><h2>استعادة نسخة</h2></div>
      </div>
      <p>اختر ملف النسخة. النظام يحدد تلقائيًا هل هي نسخة كاملة أو فواتير أو مخزون، ويستعيد النوع الموجود في الملف فقط.</p>
      <label className="backup-file-picker">
        <span className="backup-file-icon"><FileArchive size={20}/></span>
        <span><b>اختر ملف النسخة</b><small>JSON · نسخة X-Store</small></span>
        <span className="button button-quiet button-small">استعراض الملفات</span>
        <input type="file" accept=".json,application/json" onChange={restoreBackup} disabled={busyType !== null}/>
      </label>
    </section>

    {error && <div className="backup-inline-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
    {notice && <div className="backup-inline-success" role="status"><CheckCircle2 size={15}/>{notice}</div>}

    <section className="panel" style={{marginTop:16}}>
      <div className="backup-meta"><ShieldCheck size={14}/> النسخة خاصة بمتجرك ولا تشمل بيانات المتاجر الأخرى أو كلمات المرور.</div>
    </section>
  </div>;
}
