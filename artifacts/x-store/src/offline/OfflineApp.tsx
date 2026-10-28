import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Archive, ArrowDownToLine, ArrowLeft, ArrowUpRight, BarChart3, Check,
  ChevronDown, CircleAlert, Clock3, CreditCard, FileText, FolderOpen,
  LayoutDashboard, LifeBuoy, LockKeyhole, Package, Plus, Printer, Receipt,
  Search, Settings, ShieldCheck, ShoppingCart, Store, Trash2, Upload, Wallet,
  X,
} from "lucide-react";
import {
  addMonthsToDate, createEmptyOfflineState, isLicenseActive, isOfflineState,
  LICENSE_DURATIONS, OFFLINE_CURRENCIES, OFFLINE_STORE_TYPES,
  type OfflineProduct, type OfflineSale, type OfflineState,
} from "./model";
import {
  chooseOfflineBackupFolder, createManualOfflineBackup, isDesktopEdition,
  loadOfflineState, restoreOfflineBackup, saveOfflineState,
} from "./storage";
import "./offline.css";

type Page = "dashboard" | "products" | "pos" | "sales" | "backup" | "settings";
type CartRow = { product: OfflineProduct; quantity: number };
const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { id: "products", label: "المنتجات والمخزون", icon: Package },
  { id: "pos", label: "نقطة البيع", icon: ShoppingCart },
  { id: "sales", label: "سجل المبيعات", icon: Receipt },
  { id: "backup", label: "النسخ الاحتياطي", icon: Archive },
  { id: "settings", label: "الإعدادات والترخيص", icon: Settings },
];
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const digits = (value: number | string) => String(value).replace(/[٠-٩]/g, (n) => String("٠١٢٣٤٥٦٧٨٩".indexOf(n)));
const money = (value: number, currency: string) => `${digits(new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value))} ${currency}`;
const dateTime = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className={`offline-brand ${compact ? "compact" : ""}`} dir="ltr">
    <img src="./x-store-mark.png" alt="" />
    <span>X-Store<small>OFFLINE</small></span>
  </div>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="of-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function OfflineSetup({ onComplete }: { onComplete: (state: OfflineState) => Promise<void> }) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [storeType, setStoreType] = useState<(typeof OFFLINE_STORE_TYPES)[number]["value"]>("clothing_shoes");
  const [currency, setCurrency] = useState<(typeof OFFLINE_CURRENCIES)[number]["value"]>("EGP");
  const [vatRate, setVatRate] = useState("0");
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [months, setMonths] = useState<number>(12);
  const [folder, setFolder] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const desktop = isDesktopEdition();
  const supportsWholesale = OFFLINE_STORE_TYPES.find((item) => item.value === storeType)?.supportsWholesale ?? false;
  async function selectFolder() {
    try { setFolder(await chooseOfflineBackupFolder()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر اختيار مجلد النسخ."); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !businessType.trim()) { setError("أدخل اسم المتجر ونشاطه للمتابعة."); return; }
    if (desktop && !folder) { setError("اختر مجلدًا خارج مجلد البرنامج لحفظ النسخ الاحتياطية."); return; }
    setSaving(true); setError("");
    const startedAt = localDate();
    const initial = createEmptyOfflineState();
    initial.setupComplete = true;
    initial.store = { name: name.trim(), businessType: businessType.trim(), storeType, currency, vatRate: Number(vatRate) || 0, wholesaleEnabled: supportsWholesale && wholesaleEnabled };
    initial.license = { startedAt, months, expiresAt: addMonthsToDate(startedAt, months) };
    initial.backup.backupFolder = folder;
    try { await onComplete(initial); } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الإعدادات."); }
    finally { setSaving(false); }
  }
  return <main className="of-setup" dir="rtl">
    <header className="of-setup-top"><BrandMark /><span className="of-local-badge"><ShieldCheck size={15} /> بياناتك محفوظة على هذا الجهاز</span></header>
    <section className="of-setup-card">
      <div className="of-setup-intro"><div className="of-setup-icon"><Store size={23} /></div><div><span className="of-kicker">إعداد أول مرة</span><h1>لنجهّز متجرك للعمل</h1><p>خطوات بسيطة، ثم ابدأ البيع وإدارة المخزون مباشرة دون اتصال بالإنترنت.</p></div></div>
      <form onSubmit={submit}>
        <div className="of-form-grid">
          <Field label="اسم المتجر"><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: متجر النخبة" /></Field>
          <Field label="النشاط التجاري"><input required value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="مثال: بيع بالتجزئة" /></Field>
          <Field label="نوع المتجر"><select value={storeType} onChange={(e) => { setStoreType(e.target.value as typeof storeType); setWholesaleEnabled(false); }}>{OFFLINE_STORE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="العملة"><select value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>{OFFLINE_CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}</select></Field>
          <Field label="نسبة ضريبة القيمة المضافة" hint="اكتب 0 إذا لم تكن الضريبة مطبقة."><div className="of-input-suffix"><input type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} /><b>%</b></div></Field>
          <Field label="مدة الترخيص المحلي"><select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{LICENSE_DURATIONS.map((duration) => <option key={duration} value={duration}>{digits(duration)} {duration === 1 ? "شهر" : "أشهر"}</option>)}</select></Field>
        </div>
        {supportsWholesale && <label className="of-toggle-row"><span><b>تفعيل البيع بالجملة</b><small>إضافة سعر جملة للمنتجات وإتاحته عند البيع.</small></span><input type="checkbox" checked={wholesaleEnabled} onChange={(e) => setWholesaleEnabled(e.target.checked)} /><i /></label>}
        <div className="of-folder-choice"><div className="of-folder-copy"><span className="of-folder-icon"><FolderOpen size={18} /></span><span><b>مجلد النسخ الاحتياطي</b><small>{folder || (desktop ? "اختر مكان حفظ النسخ الاحتياطية" : "معاينة: النسخ محفوظة داخل المتصفح فقط")}</small></span></div><button type="button" className="of-button of-button-secondary" onClick={selectFolder}><FolderOpen size={15} /> اختيار مجلد</button></div>
        {!desktop && <div className="of-preview-note"><CircleAlert size={15} /> معاينة المتصفح لا تتيح اختيار مجلد ويندوز أو إنشاء ملف نسخ احتياطي فعلي. تتوفر هذه الوظائف في إصدار Windows.</div>}
        {error && <div className="of-error"><CircleAlert size={16} />{error}</div>}
        <div className="of-setup-footer"><span><LockKeyhole size={15} /> تبقى سجلاتك على هذا الجهاز</span><button type="submit" className="of-button of-button-primary" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ وبدء الاستخدام"}<ArrowLeft size={16} /></button></div>
      </form>
    </section>
    <p className="of-setup-footnote">X-Store Offline <i /> يعمل دون إنترنت ويحفظ بياناتك محليًا</p>
  </main>;
}

export default function OfflineApp() {
  const [state, setState] = useState<OfflineState | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [saleDetail, setSaleDetail] = useState<OfflineSale | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const desktop = isDesktopEdition();

  useEffect(() => { loadOfflineState().then(setState).catch((e) => setLoadError(e instanceof Error ? e.message : "تعذر تحميل بيانات المتجر.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3500); return () => window.clearTimeout(timer); }, [notice]);

  async function persist(next: OfflineState) {
    setSaveError("");
    try {
      const saved = await saveOfflineState(next);
      setState(saved);
      return saved;
    } catch (e) {
      const message = e instanceof Error ? e.message : "تعذر حفظ البيانات على هذا الجهاز.";
      setSaveError(message);
      throw new Error(message);
    }
  }
  async function completeSetup(initial: OfflineState) {
    await persist(initial);
    setPage("dashboard");
  }

  if (loading) return <div className="of-loading" dir="rtl"><div className="of-skeleton-mark" /><div className="of-skeleton-line" /><div className="of-skeleton-block" /><span>جارٍ فتح بيانات المتجر...</span></div>;
  if (loadError) return <main className="of-failure" dir="rtl"><BrandMark /><div className="of-failure-card"><CircleAlert size={26} /><h1>تعذر فتح بيانات المتجر</h1><p>{loadError}</p><button className="of-button of-button-primary" onClick={() => { setLoading(true); setLoadError(""); loadOfflineState().then(setState).catch((e) => setLoadError(e instanceof Error ? e.message : "تعذر تحميل البيانات.")).finally(() => setLoading(false)); }}>إعادة المحاولة</button></div></main>;
  if (!state?.setupComplete || !state.store) return <OfflineSetup onComplete={completeSetup} />;

  const currentState = state as OfflineState;
  const active = isLicenseActive(currentState.license);
  const currency = currentState.store!.currency;
  const todaySales = currentState.sales.filter((sale) => sale.createdAt.slice(0, 10) === localDate());
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const lowStock = currentState.products.filter((product) => product.quantity <= 5);
  const title = navItems.find((item) => item.id === page)?.label ?? "الرئيسية";

  async function updateProduct(product: OfflineProduct, editingId?: string) {
    const next = { ...currentState, products: editingId ? currentState.products.map((item) => item.id === editingId ? { ...product, id: editingId } : item) : [product, ...currentState.products] };
    await persist(next);
    setNotice(editingId ? "تم تحديث المنتج." : "تمت إضافة المنتج.");
  }
  async function removeProduct(id: string) {
    if (!window.confirm("هل تريد حذف هذا المنتج؟")) return;
    await persist({ ...currentState, products: currentState.products.filter((product) => product.id !== id) });
    setNotice("تم حذف المنتج.");
  }
  async function completeSale(sale: OfflineSale) {
    if (!active) throw new Error("انتهت مدة الترخيص المحلي. تواصل مع مورّد النظام لتجديده.");
    const nextProducts = currentState.products.map((product) => {
      const sold = sale.items.find((item) => item.productId === product.id);
      return sold ? { ...product, quantity: Math.max(0, product.quantity - sold.quantity) } : product;
    });
    await persist({ ...currentState, products: nextProducts, sales: [sale, ...currentState.sales] });
    setNotice(`تم حفظ الفاتورة ${sale.invoiceNumber}.`);
    setPage("sales");
  }
  async function chooseFolder() {
    try {
      const folder = await chooseOfflineBackupFolder();
      if (!folder) return;
      await persist({ ...currentState, backup: { ...currentState.backup, backupFolder: folder, lastError: null } });
      setNotice(desktop ? "تم تحديث مجلد النسخ الاحتياطي." : "هذه معاينة؛ لا يمثل المسار مجلدًا حقيقيًا على ويندوز.");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "تعذر اختيار المجلد."); }
  }
  async function manualBackup() {
    try { const saved = await createManualOfflineBackup(); setState(saved); setNotice(desktop ? "تم إنشاء النسخة الاحتياطية." : "تم حفظ نسخة معاينة داخل المتصفح؛ ليست ملفًا على الجهاز."); }
    catch (e) { setSaveError(e instanceof Error ? e.message : "تعذر إنشاء النسخة الاحتياطية."); }
  }
  async function restoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isOfflineState(parsed)) { setSaveError("ملف غير صالح أو غير متوافق مع X-Store Offline."); return; }
      if (!window.confirm("سيتم استبدال بيانات المتجر الحالية بمحتوى الملف. هل تريد المتابعة؟")) return;
      const restored = await restoreOfflineBackup(parsed);
      setState(restored); setNotice("تم استرجاع البيانات بنجاح.");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "تعذر قراءة ملف النسخة الاحتياطية."); }
  }
  async function updateSettings(store: OfflineState["store"]) {
    if (!store) return;
    await persist({ ...currentState, store });
    setNotice("تم حفظ إعدادات المتجر.");
  }
  return <div className="of-app" dir="rtl">
    <aside className="of-sidebar">
      <div className="of-sidebar-brand"><BrandMark /><span className="of-edition">نسخة مستقلة · Windows</span></div>
      <div className="of-shop-chip"><span className="of-shop-avatar"><Store size={18} /></span><span><b>{state.store.name}</b><small>{state.store.businessType}</small></span><ChevronDown size={15} /></div>
      <nav className="of-nav">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`of-nav-item ${page === id ? "selected" : ""}`} onClick={() => { setPage(id); setSaleDetail(null); }}><Icon size={18} /><span>{label}</span>{id === "products" && lowStock.length > 0 && <i>{digits(lowStock.length)}</i>}</button>)}</nav>
       <div className="of-sidebar-bottom"><div className={`of-license-chip ${active ? "" : "expired"}`}><span className="of-license-status"><ShieldCheck size={16} /></span><span><b>{active ? "الترخيص نشط" : "انتهى الترخيص"}</b><small>{state.license ? `ينتهي ${state.license.expiresAt}` : "غير محدد"}</small></span></div><div className="of-device-note"><LockKeyhole size={14} /> لا توجد مزامنة أو اتصال سحابي</div></div>
    </aside>
    <div className="of-main">
      <header className="of-topbar"><div className="of-mobile-brand"><BrandMark compact /></div><div className="of-breadcrumb"><span>المتجر</span><i>/</i><b>{title}</b></div><div className="of-top-right"><span className="of-online-state"><i /> يعمل دون إنترنت</span><span className="of-top-date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span><button className="of-avatar" title={state.store.name}>{state.store.name.slice(0, 1)}</button></div></header>
      {(saveError || state.backup.lastError) && <div className="of-alert"><CircleAlert size={17} /><span>{saveError || state.backup.lastError}</span><button aria-label="إغلاق" onClick={() => { setSaveError(""); if (state.backup.lastError) void persist({ ...state, backup: { ...state.backup, lastError: null } }); }}><X size={15} /></button></div>}
      <main className="of-content">
        {page === "dashboard" && <Dashboard state={state} todaySales={todaySales} todayRevenue={todayRevenue} lowStock={lowStock} currency={currency} onNavigate={setPage} onSale={setSaleDetail} />}
        {page === "products" && <ProductsPage state={state} currency={currency} onSave={updateProduct} onRemove={removeProduct} />}
        {page === "pos" && <PosPage state={state} licenseActive={active} onComplete={completeSale} />}
        {page === "sales" && <SalesPage state={state} currency={currency} onSelect={setSaleDetail} />}
        {page === "backup" && <BackupPage state={state} desktop={desktop} onChooseFolder={chooseFolder} onBackup={manualBackup} onRestore={() => fileInput.current?.click()} />}
        {page === "settings" && <SettingsPage state={state} onSave={updateSettings} />}
      </main>
      <footer className="of-footer"><span><ShieldCheck size={14} /> بيانات المتجر محفوظة محليًا على هذا الجهاز</span><span> X-Store Offline <b>·</b> إصدار مستقل</span></footer>
    </div>
    <input ref={fileInput} type="file" accept="application/json,.json" className="of-hidden-file" onChange={restoreFile} />
    {notice && <div role="status" className="of-toast"><Check size={16} />{notice}</div>}
    {saleDetail && <InvoiceDialog sale={saleDetail} store={state.store} currency={currency} onClose={() => setSaleDetail(null)} />}
  </div>;
}

function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="of-page-heading"><div><span className="of-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ state, todaySales, todayRevenue, lowStock, currency, onNavigate, onSale }: { state: OfflineState; todaySales: OfflineSale[]; todayRevenue: number; lowStock: OfflineProduct[]; currency: string; onNavigate: (p: Page) => void; onSale: (sale: OfflineSale) => void }) {
  const units = state.products.reduce((sum, p) => sum + p.quantity, 0);
  const inventoryValue = state.products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0);
  const latest = [...state.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return <section className="of-page">
    <PageHeading kicker="ملخص المتجر" title={`مرحبًا بك في ${state.store?.name}`} description="نظرة سريعة على حركة متجرك اليوم." action={<button className="of-button of-button-primary" onClick={() => onNavigate("pos")}><Plus size={16} /> عملية بيع جديدة</button>} />
    <div className="of-stats-grid">
      <StatCard label="مبيعات اليوم" value={money(todayRevenue, currency)} caption={`${digits(todaySales.length)} فاتورة اليوم`} icon={Wallet} tone="green" />
      <StatCard label="عدد المنتجات" value={digits(state.products.length)} caption={`${digits(units)} وحدة في المخزون`} icon={Package} tone="blue" />
      <StatCard label="قيمة المخزون بالتكلفة" value={money(inventoryValue, currency)} caption="قيمة تقديرية للكمية المتاحة" icon={BarChart3} tone="gold" />
      <StatCard label="منتجات منخفضة" value={digits(lowStock.length)} caption="الكمية 5 أو أقل" icon={Activity} tone={lowStock.length ? "red" : "green"} />
    </div>
    <div className="of-dashboard-grid">
      <section className="of-panel of-sales-panel"><div className="of-panel-head"><div><h2>آخر المبيعات</h2><p>أحدث الفواتير المسجلة محليًا</p></div><button className="of-text-button" onClick={() => onNavigate("sales")}>عرض سجل المبيعات <ArrowUpRight size={15} /></button></div>
        {latest.length ? <div className="of-table-scroll"><table className="of-table"><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th><th>الإجمالي</th><th /></tr></thead><tbody>{latest.map((sale) => <tr key={sale.id} onClick={() => onSale(sale)}><td><b className="of-invoice-number">{sale.invoiceNumber}</b></td><td>{sale.customerName || "عميل نقدي"}</td><td>{dateTime(sale.createdAt)}</td><td className="of-number">{money(sale.total, currency)}</td><td><ArrowUpRight size={15} /></td></tr>)}</tbody></table></div> : <EmptyState icon={Receipt} title="لا توجد مبيعات بعد" copy="ستظهر الفواتير هنا بعد إتمام أول عملية بيع." action={<button className="of-button of-button-secondary" onClick={() => onNavigate("pos")}>ابدأ أول عملية بيع</button>} />}
      </section>
      <section className="of-panel of-low-panel"><div className="of-panel-head"><div><h2>تنبيه المخزون</h2><p>تابع المنتجات التي قاربت على النفاد</p></div><span className="of-counter">{digits(lowStock.length)}</span></div>
        {lowStock.length ? <div className="of-low-list">{lowStock.slice(0, 5).map((product) => <div className="of-low-item" key={product.id}><span className="of-product-mark"><Package size={17} /></span><span className="of-low-name"><b>{product.name}</b><small>{product.sku || "بدون رمز"}</small></span><span className={`of-stock-pill ${product.quantity === 0 ? "empty" : ""}`}>{product.quantity === 0 ? "نفد" : `متبقي ${digits(product.quantity)}`}</span></div>)}</div> : <div className="of-good-stock"><span><Check size={18} /></span><b>المخزون بحالة جيدة</b><small>لا توجد منتجات منخفضة حاليًا.</small></div>}
        <button className="of-wide-link" onClick={() => onNavigate("products")}>إدارة المنتجات <ArrowLeft size={15} /></button>
      </section>
    </div>
    <section className="of-panel of-quick-panel"><div className="of-panel-head"><div><h2>اختصارات يومية</h2><p>الوصول السريع إلى مهام المتجر</p></div></div><div className="of-quick-actions">
      <button onClick={() => onNavigate("pos")}><span className="quick-green"><ShoppingCart size={19} /></span><b>بدء عملية بيع</b><small>إنشاء فاتورة جديدة</small><ArrowLeft size={15} /></button>
      <button onClick={() => onNavigate("products")}><span className="quick-blue"><Package size={19} /></span><b>إضافة منتج</b><small>تحديث قائمة المخزون</small><ArrowLeft size={15} /></button>
      <button onClick={() => onNavigate("backup")}><span className="quick-gold"><Archive size={19} /></span><b>حفظ نسخة احتياطية</b><small>حماية سجلات متجرك</small><ArrowLeft size={15} /></button>
    </div></section>
  </section>;
}

function StatCard({ label, value, caption, icon: Icon, tone }: { label: string; value: string; caption: string; icon: typeof Wallet; tone: string }) {
  return <article className="of-stat-card"><div className="of-stat-top"><span>{label}</span><i className={`tone-${tone}`}><Icon size={18} /></i></div><strong className="of-stat-value">{value}</strong><small>{caption}</small></article>;
}
function EmptyState({ icon: Icon, title, copy, action }: { icon: typeof Receipt; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="of-empty"><span><Icon size={22} /></span><b>{title}</b><p>{copy}</p>{action}</div>;
}

function ProductsPage({ state, currency, onSave, onRemove }: { state: OfflineState; currency: string; onSave: (product: OfflineProduct, id?: string) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<OfflineProduct | "new" | null>(null);
  const products = state.products.filter((p) => `${p.name} ${p.sku} ${p.barcode} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="of-page">
    <PageHeading kicker="إدارة المخزون" title="المنتجات" description="أضف المنتجات وتابع الكميات والأسعار المتاحة." action={<button className="of-button of-button-primary" onClick={() => setModal("new")}><Plus size={16} /> إضافة منتج</button>} />
    <div className="of-toolbar"><label className="of-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الرمز أو التصنيف..." /><kbd>بحث</kbd></label><span className="of-result-count">{digits(products.length)} منتج</span></div>
    <section className="of-panel of-inventory-panel">{products.length ? <div className="of-table-scroll"><table className="of-table of-product-table"><thead><tr><th>المنتج</th><th>التصنيف</th><th>سعر البيع</th><th>سعر التكلفة</th><th>الكمية</th><th>الرمز</th><th /></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><b className="of-product-title">{product.name}</b><small>{product.barcode || "—"}</small></td><td>{product.category || "—"}</td><td className="of-number">{money(product.price, currency)}</td><td className="of-number">{money(product.costPrice, currency)}</td><td><span className={`of-quantity ${product.quantity <= 5 ? "low" : ""}`}>{digits(product.quantity)}</span></td><td className="of-code">{product.sku || "—"}</td><td><div className="of-row-actions"><button title="تعديل المنتج" onClick={() => setModal(product)}><Settings size={15} /></button><button title="حذف المنتج" onClick={() => void onRemove(product.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Package} title={query ? "لا توجد نتائج" : "قائمة المنتجات فارغة"} copy={query ? "جرّب البحث باسم أو رمز مختلف." : "أضف منتجات متجرك لتبدأ متابعة المخزون وإتمام المبيعات."} action={!query ? <button className="of-button of-button-primary" onClick={() => setModal("new")}><Plus size={16} /> إضافة أول منتج</button> : undefined} />}</section>
    {modal && <ProductDialog initial={modal === "new" ? null : modal} wholesale={state.store?.wholesaleEnabled ?? false} currency={currency} onClose={() => setModal(null)} onSave={async (p) => { await onSave(p, modal === "new" ? undefined : modal.id); setModal(null); }} />}
  </section>;
}

function ProductDialog({ initial, wholesale, currency, onClose, onSave }: { initial: OfflineProduct | null; wholesale: boolean; currency: string; onClose: () => void; onSave: (p: OfflineProduct) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [cost, setCost] = useState(String(initial?.costPrice ?? ""));
  const [wholesalePrice, setWholesalePrice] = useState(String(initial?.wholesalePrice ?? ""));
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || Number(price) < 0 || !Number.isFinite(Number(price)) || Number(quantity) < 0) { setError("تحقق من اسم المنتج والسعر والكمية."); return; }
    setSaving(true); setError("");
    try { await onSave({ id: initial?.id ?? makeId(), name: name.trim(), sku: sku.trim(), barcode: barcode.trim(), category: category.trim(), costPrice: Number(cost) || 0, price: Number(price), wholesalePrice: wholesale && wholesalePrice !== "" ? Number(wholesalePrice) : null, quantity: Number(quantity) || 0, createdAt: initial?.createdAt ?? new Date().toISOString() }); }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ المنتج."); } finally { setSaving(false); }
  }
  return <div className="of-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="of-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><header className="of-dialog-head"><div><span className="of-kicker">بيانات المخزون</span><h2 id="product-dialog-title">{initial ? "تعديل المنتج" : "إضافة منتج جديد"}</h2></div><button onClick={onClose} aria-label="إغلاق"><X size={18} /></button></header><form onSubmit={submit}><div className="of-form-grid">
    <Field label="اسم المنتج"><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المنتج" /></Field><Field label="التصنيف"><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="مثال: إكسسوارات" /></Field>
    <Field label="رمز المنتج (SKU)"><input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="اختياري" /></Field><Field label="الباركود"><input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="اختياري" /></Field>
    <Field label={`سعر البيع (${currency})`}><input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label={`سعر التكلفة (${currency})`}><input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
    {wholesale && <Field label={`سعر الجملة (${currency})`}><input type="number" min="0" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} placeholder="اختياري" /></Field>}<Field label="الكمية المتاحة"><input required type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
    </div>{error && <div className="of-error"><CircleAlert size={15} />{error}</div>}<div className="of-dialog-actions"><button type="button" className="of-button of-button-secondary" onClick={onClose}>إلغاء</button><button className="of-button of-button-primary" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ المنتج"}</button></div></form></section></div>;
}

function PosPage({ state, licenseActive, onComplete }: { state: OfflineState; licenseActive: boolean; onComplete: (sale: OfflineSale) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartRow[]>([]);
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState<"cash" | "card" | "transfer">("cash");
  const [saleType, setSaleType] = useState<"retail" | "wholesale">("retail");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = state.products.filter((p) => p.quantity > 0 && `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(query.toLowerCase()));
  const subtotal = cart.reduce((sum, row) => sum + (saleType === "wholesale" && row.product.wholesalePrice !== null ? row.product.wholesalePrice : row.product.price) * row.quantity, 0);
  const tax = subtotal * ((state.store?.vatRate ?? 0) / 100);
  const total = subtotal + tax;
  function add(product: OfflineProduct) {
    setCart((prev) => { const existing = prev.find((row) => row.product.id === product.id); if (existing) return prev.map((row) => row.product.id === product.id ? { ...row, quantity: Math.min(product.quantity, row.quantity + 1) } : row); return [...prev, { product, quantity: 1 }]; });
  }
  function setQuantity(id: string, quantity: number) {
    if (quantity <= 0) setCart((prev) => prev.filter((row) => row.product.id !== id));
    else setCart((prev) => prev.map((row) => row.product.id === id ? { ...row, quantity: Math.min(row.product.quantity, quantity) } : row));
  }
  async function checkout() {
    if (!cart.length) return;
    if (!licenseActive) { setError("انتهت مدة الترخيص المحلي. تواصل مع مورّد النظام لتجديده."); return; }
    setBusy(true); setError("");
    const createdAt = new Date().toISOString();
    const sale: OfflineSale = { id: makeId(), invoiceNumber: `XS-${createdAt.slice(2, 10).replace(/-/g, "")}-${digits(String(state.sales.length + 1).padStart(3, "0"))}`, createdAt, customerName: customer.trim(), paymentMethod: payment, saleType, items: cart.map(({ product, quantity }) => ({ productId: product.id, name: product.name, sku: product.sku, quantity, unitPrice: saleType === "wholesale" && product.wholesalePrice !== null ? product.wholesalePrice : product.price, lineTotal: quantity * (saleType === "wholesale" && product.wholesalePrice !== null ? product.wholesalePrice : product.price) })), subtotal, taxAmount: tax, total };
    try { await onComplete(sale); setCart([]); setCustomer(""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الفاتورة."); } finally { setBusy(false); }
  }
  return <section className="of-page">
    <PageHeading kicker="نقطة البيع" title="عملية بيع جديدة" description="اختر المنتجات، راجع الفاتورة، ثم أكمل عملية البيع." action={<span className="of-pos-safe"><LockKeyhole size={14} /> حفظ محلي مباشر</span>} />
    <div className="of-pos-layout"><section className="of-panel of-pos-products"><div className="of-pos-toolbar"><label className="of-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن منتج أو امسح الباركود..." /></label>{state.store?.wholesaleEnabled && <select aria-label="نوع البيع" value={saleType} onChange={(e) => setSaleType(e.target.value as typeof saleType)}><option value="retail">بيع تجزئة</option><option value="wholesale">بيع جملة</option></select>}</div>
      {items.length ? <div className="of-pos-grid">{items.map((product) => <button key={product.id} className="of-pos-product" onClick={() => add(product)}><span className="of-pos-product-icon"><Package size={19} /></span><b>{product.name}</b><small>{product.sku || product.category || "منتج"}</small><strong>{money(saleType === "wholesale" && product.wholesalePrice !== null ? product.wholesalePrice : product.price, state.store?.currency ?? "EGP")}</strong><i>متاح {digits(product.quantity)}</i><span className="of-pos-add"><Plus size={15} /></span></button>)}</div> : <EmptyState icon={Package} title={query ? "لا توجد منتجات مطابقة" : "لا توجد منتجات جاهزة للبيع"} copy={query ? "تحقق من كتابة الاسم أو الرمز." : "أضف منتجاتك من صفحة المخزون لتظهر هنا."} />}
    </section><aside className="of-panel of-cart-panel"><header className="of-cart-head"><div><h2>الفاتورة الحالية</h2><p>{digits(cart.reduce((n, row) => n + row.quantity, 0))} قطعة</p></div><button className="of-clear-cart" onClick={() => setCart([])} disabled={!cart.length}>تفريغ</button></header>
      <label className="of-cart-customer"><span>اسم العميل <small>اختياري</small></span><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="عميل نقدي" /></label>
      <div className="of-cart-lines">{cart.length ? cart.map(({ product, quantity }) => <div className="of-cart-line" key={product.id}><div className="of-cart-line-name"><b>{product.name}</b><small>{money(saleType === "wholesale" && product.wholesalePrice !== null ? product.wholesalePrice : product.price, state.store?.currency ?? "EGP")}</small></div><div className="of-stepper"><button onClick={() => setQuantity(product.id, quantity - 1)} aria-label="تقليل الكمية">−</button><span>{digits(quantity)}</span><button onClick={() => setQuantity(product.id, quantity + 1)} aria-label="زيادة الكمية" disabled={quantity >= product.quantity}>+</button></div><b className="of-line-total">{money(quantity * (saleType === "wholesale" && product.wholesalePrice !== null ? product.wholesalePrice : product.price), state.store?.currency ?? "EGP")}</b></div>) : <div className="of-cart-empty"><ShoppingCart size={22} /><span>لم تتم إضافة منتجات</span><small>اختر منتجًا من القائمة للبدء</small></div>}</div>
      <label className="of-payment-label">طريقة الدفع</label><div className="of-payment-options">{([{ id: "cash", title: "نقدي", icon: Wallet }, { id: "card", title: "بطاقة", icon: CreditCard }, { id: "transfer", title: "تحويل", icon: ArrowUpRight }] as const).map(({ id, title, icon: Icon }) => <button key={id} className={payment === id ? "chosen" : ""} onClick={() => setPayment(id)}><Icon size={15} />{title}</button>)}</div>
      <div className="of-totals"><div><span>الإجمالي قبل الضريبة</span><b>{money(subtotal, state.store?.currency ?? "EGP")}</b></div><div><span>الضريبة ({digits(state.store?.vatRate ?? 0)}%)</span><b>{money(tax, state.store?.currency ?? "EGP")}</b></div><div className="of-grand-total"><span>الإجمالي</span><b>{money(total, state.store?.currency ?? "EGP")}</b></div></div>
       {!licenseActive && <div className="of-error"><CircleAlert size={15} />انتهت مدة الترخيص؛ لا يمكن تسجيل مبيعات جديدة.</div>}{error && <div className="of-error"><CircleAlert size={15} />{error}</div>}<button className="of-button of-button-primary of-checkout" disabled={!cart.length || busy || !licenseActive} onClick={() => void checkout()}><Receipt size={17} />{busy ? "جارٍ إتمام البيع..." : "إتمام البيع"}</button>
    </aside></div>
  </section>;
}

function SalesPage({ state, currency, onSelect }: { state: OfflineState; currency: string; onSelect: (sale: OfflineSale) => void }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const filtered = useMemo(() => state.sales.filter((sale) => {
    const matches = `${sale.invoiceNumber} ${sale.customerName}`.toLowerCase().includes(query.toLowerCase());
    const dayAge = (Date.now() - new Date(sale.createdAt).getTime()) / 86400000;
    return matches && (period === "all" || (period === "today" && sale.createdAt.slice(0, 10) === localDate()) || (period === "week" && dayAge <= 7));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.sales, query, period]);
  const sum = filtered.reduce((n, sale) => n + sale.total, 0);
  return <section className="of-page"><PageHeading kicker="سجل المعاملات" title="المبيعات والفواتير" description="راجع عمليات البيع السابقة وتفاصيل كل فاتورة." />
    <div className="of-sales-summary"><span className="of-summary-icon"><Receipt size={19} /></span><div><small>إجمالي المبيعات المعروضة</small><b>{money(sum, currency)}</b></div><i /><div><small>عدد الفواتير</small><b>{digits(filtered.length)}</b></div></div>
    <div className="of-toolbar"><label className="of-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث برقم الفاتورة أو اسم العميل..." /></label><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">كل الفترات</option><option value="today">اليوم</option><option value="week">آخر 7 أيام</option></select></div>
    <section className="of-panel of-sales-table">{filtered.length ? <div className="of-table-scroll"><table className="of-table"><thead><tr><th>الفاتورة</th><th>العميل</th><th>التاريخ والوقت</th><th>طريقة الدفع</th><th>نوع البيع</th><th>الإجمالي</th><th /></tr></thead><tbody>{filtered.map((sale) => <tr key={sale.id} onClick={() => onSelect(sale)}><td><b className="of-invoice-number">{sale.invoiceNumber}</b></td><td>{sale.customerName || "عميل نقدي"}</td><td>{dateTime(sale.createdAt)}</td><td>{sale.paymentMethod === "cash" ? "نقدي" : sale.paymentMethod === "card" ? "بطاقة" : "تحويل"}</td><td>{sale.saleType === "retail" ? "تجزئة" : "جملة"}</td><td className="of-number"><b>{money(sale.total, currency)}</b></td><td><ArrowUpRight size={15} /></td></tr>)}</tbody></table></div> : <EmptyState icon={FileText} title={query ? "لا توجد فواتير مطابقة" : "لا توجد فواتير بعد"} copy={query ? "غيّر كلمات البحث أو الفترة المحددة." : "ستظهر فواتيرك بعد تسجيل عمليات البيع."} />}</section>
  </section>;
}

function InvoiceDialog({ sale, store, currency, onClose }: { sale: OfflineSale; store: OfflineState["store"]; currency: string; onClose: () => void }) {
  return <div className="of-overlay of-invoice-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="of-dialog of-invoice-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-title"><header className="of-dialog-head of-invoice-actions"><div><span className="of-kicker">تفاصيل المعاملة</span><h2 id="invoice-title">{sale.invoiceNumber}</h2></div><div><button className="of-button of-button-secondary" onClick={() => window.print()}><Printer size={15} /> طباعة الفاتورة</button><button className="of-icon-button" onClick={onClose} aria-label="إغلاق"><X size={18} /></button></div></header><article className="of-print-invoice"><div className="of-invoice-brand"><BrandMark compact /><div><b>{store?.name}</b><small>{store?.businessType}</small></div></div><div className="of-invoice-meta"><div><span>رقم الفاتورة</span><b>{sale.invoiceNumber}</b></div><div><span>التاريخ</span><b>{dateTime(sale.createdAt)}</b></div><div><span>العميل</span><b>{sale.customerName || "عميل نقدي"}</b></div><div><span>طريقة الدفع</span><b>{sale.paymentMethod === "cash" ? "نقدي" : sale.paymentMethod === "card" ? "بطاقة" : "تحويل"}</b></div></div><div className="of-table-scroll"><table className="of-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>{sale.items.map((item, index) => <tr key={`${item.productId}-${index}`}><td><b>{item.name}</b><small>{item.sku}</small></td><td>{digits(item.quantity)}</td><td className="of-number">{money(item.unitPrice, currency)}</td><td className="of-number">{money(item.lineTotal, currency)}</td></tr>)}</tbody></table></div><div className="of-invoice-totals"><div><span>الإجمالي قبل الضريبة</span><b>{money(sale.subtotal, currency)}</b></div><div><span>الضريبة</span><b>{money(sale.taxAmount, currency)}</b></div><div className="of-invoice-final"><span>الإجمالي المستحق</span><b>{money(sale.total, currency)}</b></div></div><div className="of-invoice-thanks">شكرًا لزيارتكم</div></article></section></div>;
}

function BackupPage({ state, desktop, onChooseFolder, onBackup, onRestore }: { state: OfflineState; desktop: boolean; onChooseFolder: () => void; onBackup: () => void; onRestore: () => void }) {
  return <section className="of-page"><PageHeading kicker="حماية بياناتك" title="النسخ الاحتياطي والاستعادة" description="احتفظ بنسخة من بيانات المتجر لاستعادتها عند الحاجة." />
    {!desktop && <div className="of-preview-banner"><CircleAlert size={18} /><div><b>أنت في معاينة المتصفح</b><span>اختيار مجلد ويندوز والنسخ إلى ملف متاحان فقط في إصدار Windows. هنا تُحفظ نسخة معاينة داخل تخزين المتصفح المحلي.</span></div></div>}
    <div className="of-backup-layout"><section className="of-panel of-backup-card"><span className="of-backup-symbol green"><Archive size={21} /></span><span className="of-kicker">نسخة احتياطية</span><h2>احفظ نسخة الآن</h2><p>{desktop ? "أنشئ ملفًا احتياطيًا محليًا في مجلد النسخ المحدد." : "احفظ نسخة محلية للمعاينة. هذه العملية لا تنشئ ملفًا على جهازك."}</p><button className="of-button of-button-primary" onClick={onBackup}><ArrowDownToLine size={16} /> إنشاء نسخة احتياطية الآن</button><div className="of-backup-time"><Clock3 size={14} /><span>آخر نسخة يدوية</span><b>{state.backup.lastManualBackupAt ? dateTime(state.backup.lastManualBackupAt) : "لم يتم إنشاء نسخة بعد"}</b></div></section>
      <section className="of-panel of-backup-card"><span className="of-backup-symbol blue"><FolderOpen size={21} /></span><span className="of-kicker">مكان الحفظ</span><h2>مجلد النسخ</h2><p>{state.backup.backupFolder ?? (desktop ? "لم يتم اختيار مجلد بعد." : "نسخة معاينة داخل المتصفح — لا تمثل مجلد ويندوز.")}</p><button className="of-button of-button-secondary" onClick={onChooseFolder}><FolderOpen size={16} /> اختيار مجلد النسخ</button><div className="of-backup-time"><Clock3 size={14} /><span>آخر حفظ تلقائي</span><b>{state.backup.lastAutomaticBackupAt ? dateTime(state.backup.lastAutomaticBackupAt) : "لا يوجد سجل بعد"}</b></div></section></div>
    <section className="of-panel of-restore-panel"><div className="of-restore-icon"><Upload size={20} /></div><div className="of-restore-copy"><h2>استعادة بيانات من ملف</h2><p>استورد ملف JSON احتياطيًا. سيتم التحقق من توافقه، وستحتاج إلى تأكيد استبدال بيانات المتجر الحالية.</p><div className="of-restore-note"><ShieldCheck size={14} /> لن يتم استبدال البيانات قبل موافقتك.</div></div><button className="of-button of-button-secondary" onClick={onRestore}><Upload size={16} /> اختيار ملف JSON</button></section>
  </section>;
}

function SettingsPage({ state, onSave }: { state: OfflineState; onSave: (store: OfflineState["store"]) => Promise<void> }) {
  const [name, setName] = useState(state.store?.name ?? "");
  const [businessType, setBusinessType] = useState(state.store?.businessType ?? "");
  const [storeType, setStoreType] = useState(state.store?.storeType ?? "clothing_shoes");
  const [currency, setCurrency] = useState(state.store?.currency ?? "EGP");
  const [vatRate, setVatRate] = useState(String(state.store?.vatRate ?? 0));
  const [wholesaleEnabled, setWholesaleEnabled] = useState(state.store?.wholesaleEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const active = isLicenseActive(state.license);
  const supports = OFFLINE_STORE_TYPES.find((item) => item.value === storeType)?.supportsWholesale ?? false;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !businessType.trim()) { setError("اسم المتجر والنشاط مطلوبان."); return; }
    setSaving(true); setError("");
    try { await onSave({ name: name.trim(), businessType: businessType.trim(), storeType, currency, vatRate: Number(vatRate) || 0, wholesaleEnabled: supports && wholesaleEnabled }); }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ الإعدادات."); } finally { setSaving(false); }
  }
  return <section className="of-page"><PageHeading kicker="إدارة الحساب المحلي" title="الإعدادات والترخيص" description="تعديل بيانات النشاط ومراجعة حالة الترخيص على هذا الجهاز." />
    <div className="of-settings-grid"><section className="of-panel of-settings-panel"><div className="of-panel-head"><div><h2>بيانات المتجر</h2><p>تُستخدم هذه البيانات في لوحة العمل والفواتير.</p></div><span className="of-settings-head-icon"><Store size={18} /></span></div><form onSubmit={submit}><div className="of-form-grid"><Field label="اسم المتجر"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="النشاط التجاري"><input required value={businessType} onChange={(e) => setBusinessType(e.target.value)} /></Field><Field label="نوع المتجر"><select value={storeType} onChange={(e) => { setStoreType(e.target.value as typeof storeType); setWholesaleEnabled(false); }}>{OFFLINE_STORE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="العملة"><select value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>{OFFLINE_CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}</select></Field><Field label="ضريبة القيمة المضافة (%)"><input type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} /></Field></div>
      {supports && <label className="of-toggle-row"><span><b>البيع بالجملة</b><small>إظهار سعر الجملة أثناء إتمام البيع.</small></span><input type="checkbox" checked={wholesaleEnabled} onChange={(e) => setWholesaleEnabled(e.target.checked)} /><i /></label>}
      {error && <div className="of-error"><CircleAlert size={15} />{error}</div>}<div className="of-settings-save"><button className="of-button of-button-primary" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button></div>
    </form></section>
      <aside className="of-panel of-license-panel"><span className={`of-license-large-icon ${active ? "" : "expired"}`}><ShieldCheck size={22} /></span><span className="of-kicker">حالة الترخيص</span><h2>{active ? "ترخيصك نشط" : "الترخيص منتهٍ"}</h2><p>الترخيص محفوظ محليًا ولا يحتاج إلى اتصال بالإنترنت.</p><div className="of-license-details"><div><span>تاريخ البداية</span><b>{state.license?.startedAt ?? "—"}</b></div><div><span>تاريخ الانتهاء</span><b>{state.license?.expiresAt ?? "—"}</b></div><div><span>المدة المحددة</span><b>{state.license ? `${digits(state.license.months)} شهر` : "—"}</b></div></div><div className="of-license-caption"><LockKeyhole size={14} /> تُحدد المدة عند الإعداد الأول، ولا يحتاج البرنامج إلى اتصال بالإنترنت.</div></aside></div>
    <div className="of-settings-device"><span><LifeBuoy size={17} /></span><div><b>البيانات لا تغادر جهازك</b><small>يعمل X-Store Offline دون حساب أو مزامنة سحابية. احفظ نسخة احتياطية بانتظام.</small></div></div>
  </section>;
}
