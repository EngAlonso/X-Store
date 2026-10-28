import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Archive, ArrowDownToLine, ArrowLeft, ArrowUpRight, BarChart3, Check,
  ChevronDown, CircleAlert, Clock3, CreditCard, FileText, FolderOpen,
  LayoutDashboard, LifeBuoy, LockKeyhole, LogOut, Package, Plus, Printer, Receipt,
  Search, Settings, ShieldCheck, ShoppingCart, Store, Trash2, Upload, Wallet,
  Users, RotateCcw, ClipboardList, ChartNoAxesCombined, Pause, Play,
  ArrowLeftRight, Smartphone, Banknote, Minus, X,
} from "lucide-react";
import {
  createEmptyOfflineState,
  isLicenseActive, isOfflineState, migrateOfflineState,
  OFFLINE_CURRENCIES, OFFLINE_STORE_TYPES, OFFLINE_TEAM_PERMISSIONS,
  type OfflineHeldSale, type OfflineLicense, type OfflineProduct,
  type OfflineSale, type OfflineState, type OfflineTeamMember, type OfflineTeamPermission,
} from "./model";
import {
  createOfflineActivationRequest, downloadOfflineActivationRequest,
  readAndVerifyOfflineLicense,
} from "./licensing";
import {
  OfflineAuditPage, OfflineReportsPage, OfflineReturnsPage, OfflineTeamPage,
} from "./OfflineOperationsPages";
import {
  applyOfflineExchange, applyOfflineReturn, createAuditEntry,
  type OfflineExchangeRequest, type OfflineReturnRequest,
} from "./transactions";
import { createLocalPinCredential, isValidLocalPin, verifyLocalPin } from "./auth";
import {
  chooseOfflineBackupFolder, createManualOfflineBackup, getOfflineInstallationId, isDesktopEdition,
  loadOfflineState, restoreOfflineBackup, saveOfflineState,
} from "./storage";
import "./offline.css";

type Page = "dashboard" | "products" | "pos" | "sales" | "returns" | "team" | "reports" | "audit" | "backup" | "settings";
const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { id: "products", label: "المنتجات والمخزون", icon: Package },
  { id: "pos", label: "نقطة البيع", icon: ShoppingCart },
  { id: "sales", label: "سجل المبيعات", icon: Receipt },
  { id: "returns", label: "المرتجعات والاستبدال", icon: RotateCcw },
  { id: "team", label: "فريق المتجر", icon: Users },
  { id: "reports", label: "التقارير المالية", icon: ChartNoAxesCombined },
  { id: "audit", label: "سجل النشاط", icon: ClipboardList },
  { id: "backup", label: "النسخ الاحتياطي", icon: Archive },
  { id: "settings", label: "الإعدادات والترخيص", icon: Settings },
];
const salesPermissions: OfflineTeamPermission[] = ["retail_sales", "wholesale_sales"];
function canAccessOfflinePage(member: OfflineTeamMember, page: Page) {
  if (member.role === "tenant_admin" || page === "dashboard") return true;
  if (page === "products") return member.permissions.includes("warehouse_manager");
  if (page === "sales") {
    return member.permissions.includes("accountant") ||
      salesPermissions.some((permission) => member.permissions.includes(permission));
  }
  if (page === "pos" || page === "returns") {
    return salesPermissions.some((permission) => member.permissions.includes(permission));
  }
  if (page === "reports" || page === "audit") return member.permissions.includes("accountant");
  return false;
}
function assertOfflinePermission(member: OfflineTeamMember, permissions: OfflineTeamPermission[]) {
  if (member.role === "tenant_admin" || permissions.some((permission) => member.permissions.includes(permission))) return;
  throw new Error("ليس لديك صلاحية لتنفيذ هذه العملية.");
}
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
function createHeldInvoiceReference() {
  const date = localDate().replaceAll("-", "");
  return `XS-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
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
  const [folder, setFolder] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState("");
  const [ownerPinConfirm, setOwnerPinConfirm] = useState("");
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
    if (!isValidLocalPin(ownerPin)) { setError("رمز دخول المالك يجب أن يتكون من 6 إلى 12 رقمًا."); return; }
    if (ownerPin !== ownerPinConfirm) { setError("تأكيد رمز الدخول غير مطابق."); return; }
    setSaving(true); setError("");
    try {
      const credential = await createLocalPinCredential(ownerPin);
      const initial = createEmptyOfflineState();
      initial.setupComplete = true;
      initial.store = { name: name.trim(), businessType: businessType.trim(), storeType, currency, vatRate: Number(vatRate) || 0, wholesaleEnabled: supportsWholesale && wholesaleEnabled, invoiceFormat: "wide" };
      initial.license = null;
      initial.backup.backupFolder = folder;
      initial.teamMembers = [{
        id: makeId(), name: "صاحب المتجر", phone: "", email: "",
        role: "tenant_admin", roleName: "مالك المتجر", permissions: [...OFFLINE_TEAM_PERMISSIONS],
        active: true, ...credential, createdAt: new Date().toISOString(),
      }];
      initial.auditLogs = [createAuditEntry("تهيئة رمز الدخول", "عضو فريق", initial.teamMembers[0].id, "تم إعداد دخول مالك المتجر.")];
      await onComplete(initial);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الإعدادات."); }
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
          <div className="of-preview-note"><ShieldCheck size={15} /> بعد إعداد المتجر، صدّر طلب التفعيل وأرسله لإدارة X-Store لاستلام ملف الترخيص. لا يلزم اتصال المتجر بالإنترنت.</div>
        </div>
        <div className="of-form-grid of-owner-pin-fields">
          <Field label="رمز دخول المالك" hint="من 6 إلى 12 رقمًا. يُحفظ بصورة مشفّرة أحاديًا على هذا الجهاز."><input required type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} value={ownerPin} onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="••••••" /></Field>
          <Field label="تأكيد رمز الدخول"><input required type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} value={ownerPinConfirm} onChange={(e) => setOwnerPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="أعد كتابة الرمز" /></Field>
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

function OfflineAdminPinSetup({ state, onComplete }: {
  state: OfflineState;
  onComplete: (member: OfflineTeamMember) => Promise<void>;
}) {
  const existing = state.teamMembers.find((member) => member.role === "tenant_admin");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidLocalPin(pin)) { setError("رمز الدخول يجب أن يتكون من 6 إلى 12 رقمًا."); return; }
    if (pin !== confirmPin) { setError("تأكيد رمز الدخول غير مطابق."); return; }
    setSaving(true);
    setError("");
    try {
      const credential = await createLocalPinCredential(pin);
      await onComplete({
        id: existing?.id ?? makeId(),
        name: existing?.name || "صاحب المتجر",
        phone: existing?.phone ?? "",
        email: existing?.email ?? "",
        role: "tenant_admin",
        roleName: "مالك المتجر",
        permissions: [...OFFLINE_TEAM_PERMISSIONS],
        active: true,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        ...credential,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إعداد رمز الدخول.");
    } finally {
      setSaving(false);
    }
  }
  return <main className="of-setup of-local-auth" dir="rtl">
    <header className="of-setup-top"><BrandMark /><span className="of-local-badge"><LockKeyhole size={15} /> دخول محلي للمتجر</span></header>
    <section className="of-setup-card of-auth-card">
      <div className="of-setup-intro"><div className="of-setup-icon"><ShieldCheck size={23} /></div><div><span className="of-kicker">تهيئة الوصول</span><h1>أنشئ رمز دخول المالك</h1><p>بيانات هذا المتجر موجودة بالفعل على الجهاز. أضف رمزًا للمالك للمتابعة بأمان.</p></div></div>
      <form onSubmit={(event) => void submit(event)}>
        <div className="of-form-grid">
          <Field label="رمز دخول المالك" hint="من 6 إلى 12 رقمًا؛ لا يُحفظ الرمز نفسه."><input required type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="••••••" /></Field>
          <Field label="تأكيد رمز الدخول"><input required type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="أعد كتابة الرمز" /></Field>
        </div>
        {error && <div className="of-error"><CircleAlert size={15} />{error}</div>}
        <div className="of-setup-footer"><span><LockKeyhole size={14} /> يتم حفظ تجزئة الرمز محليًا</span><button className="of-button of-button-primary" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ الرمز والمتابعة"}<ArrowLeft size={16} /></button></div>
      </form>
      <div className="of-auth-boundary"><CircleAlert size={14} /> هذا قفل دخول للتطبيق فقط؛ لا يقوم بتشفير ملف البيانات أو حماية حساب Windows.</div>
    </section>
    <p className="of-setup-footnote">X-Store Offline <i /> يعمل دون اتصال بالإنترنت</p>
  </main>;
}

function OfflineLogin({ state, onLogin }: {
  state: OfflineState;
  onLogin: (memberId: string) => void;
}) {
  const members = state.teamMembers.filter((member) => member.active && member.pinSalt && member.pinHash && member.pinIterations);
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const member = members.find((item) => item.id === memberId);
    if (!member?.pinSalt || !member.pinHash || !member.pinIterations) {
      setError("اختر عضو فريق نشطًا لديه رمز دخول.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const valid = await verifyLocalPin(pin, {
        pinSalt: member.pinSalt,
        pinHash: member.pinHash,
        pinIterations: member.pinIterations,
      });
      if (!valid) {
        setPin("");
        setError("رمز الدخول غير صحيح.");
        return;
      }
      onLogin(member.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر التحقق من رمز الدخول.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="of-setup of-local-auth" dir="rtl">
    <header className="of-setup-top"><BrandMark /><span className="of-local-badge"><ShieldCheck size={15} /> بيانات محلية</span></header>
    <section className="of-setup-card of-auth-card">
      <div className="of-setup-intro"><div className="of-setup-icon"><LockKeyhole size={23} /></div><div><span className="of-kicker">{state.store?.name ?? "X-Store"}</span><h1>تسجيل الدخول</h1><p>اختر حسابك وأدخل رمز الدخول المحلي للمتابعة.</p></div></div>
      <form onSubmit={(event) => void submit(event)}>
        <div className="of-form-grid of-login-fields">
          <Field label="عضو الفريق"><select value={memberId} onChange={(event) => { setMemberId(event.target.value); setError(""); }}><option value="">اختر الحساب</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.roleName}</option>)}</select></Field>
          <Field label="رمز الدخول"><input required type="password" inputMode="numeric" autoComplete="current-password" maxLength={12} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="••••••" /></Field>
        </div>
        {error && <div className="of-error" role="alert"><CircleAlert size={15} />{error}</div>}
        <div className="of-setup-footer"><span><LockKeyhole size={14} /> دخول على هذا الجهاز فقط</span><button className="of-button of-button-primary" disabled={busy || !members.length}>{busy ? "جارٍ التحقق..." : "دخول"}<ArrowLeft size={16} /></button></div>
      </form>
      <div className="of-auth-boundary"><CircleAlert size={14} /> رمز الدخول لا يشفّر ملف البيانات؛ استخدم حساب Windows موثوقًا.</div>
    </section>
    <p className="of-setup-footnote">X-Store Offline <i /> لا يوجد اتصال أو مزامنة سحابية</p>
  </main>;
}

export default function OfflineApp() {
  const [state, setState] = useState<OfflineState | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [authenticatedMemberId, setAuthenticatedMemberId] = useState<string | null>(null);
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
    setAuthenticatedMemberId(initial.teamMembers[0]?.id ?? null);
    setPage("dashboard");
  }
  async function completeAdminPinSetup(member: OfflineTeamMember) {
    if (!state) throw new Error("تعذر تحميل بيانات المتجر.");
    const existing = state.teamMembers.find((item) => item.role === "tenant_admin");
    const owner = { ...member, id: existing?.id ?? member.id, createdAt: existing?.createdAt ?? member.createdAt };
    await persist({
      ...state,
      teamMembers: [owner, ...state.teamMembers.filter((item) => item.id !== owner.id)],
      auditLogs: [createAuditEntry("تهيئة رمز الدخول", "عضو فريق", owner.id, "تم إعداد دخول مالك المتجر.", owner.name), ...state.auditLogs],
    });
    setAuthenticatedMemberId(owner.id);
    setPage("dashboard");
  }

  if (loading) return <div className="of-loading" dir="rtl"><div className="of-skeleton-mark" /><div className="of-skeleton-line" /><div className="of-skeleton-block" /><span>جارٍ فتح بيانات المتجر...</span></div>;
  if (loadError) return <main className="of-failure" dir="rtl"><BrandMark /><div className="of-failure-card"><CircleAlert size={26} /><h1>تعذر فتح بيانات المتجر</h1><p>{loadError}</p><button className="of-button of-button-primary" onClick={() => { setLoading(true); setLoadError(""); loadOfflineState().then(setState).catch((e) => setLoadError(e instanceof Error ? e.message : "تعذر تحميل البيانات.")).finally(() => setLoading(false)); }}>إعادة المحاولة</button></div></main>;
  if (!state?.setupComplete || !state.store) return <OfflineSetup onComplete={completeSetup} />;

  const currentState = state as OfflineState;
  const hasActiveOwnerPin = currentState.teamMembers.some((member) =>
    member.role === "tenant_admin" && member.active && Boolean(member.pinSalt && member.pinHash && member.pinIterations),
  );
  if (!hasActiveOwnerPin) return <OfflineAdminPinSetup state={currentState} onComplete={completeAdminPinSetup} />;
  const currentMember = currentState.teamMembers.find((member) =>
    member.id === authenticatedMemberId && member.active && member.pinSalt && member.pinHash && member.pinIterations,
  );
  if (!currentMember) return <OfflineLogin state={currentState} onLogin={setAuthenticatedMemberId} />;
  const activeMember = currentMember;
  const active = isLicenseActive(currentState.license);
  const currency = currentState.store!.currency;
  const wholesaleEnabled = currentState.store?.wholesaleEnabled ?? false;
  const canViewAllSales = activeMember.role === "tenant_admin" || activeMember.permissions.includes("accountant");
  const canViewRetailSales = canViewAllSales || activeMember.permissions.includes("retail_sales");
  const canViewWholesaleSales = canViewAllSales || activeMember.permissions.includes("wholesale_sales");
  const visibleSales = currentState.sales.filter((sale) =>
    (sale.saleType === "wholesale" ? canViewWholesaleSales : canViewRetailSales),
  );
  const visibleSaleIds = new Set(visibleSales.map((sale) => sale.id));
  const visibleInvoiceNumbers = new Set(visibleSales.map((sale) => sale.invoiceNumber));
  const viewState: OfflineState = {
    ...currentState,
    sales: visibleSales,
    returns: currentState.returns.filter((entry) => visibleSaleIds.has(entry.saleId)),
    exchanges: currentState.exchanges.filter((entry) => visibleInvoiceNumbers.has(entry.originalInvoiceNumber)),
  };
  const posState: OfflineState = {
    ...currentState,
    heldSales: currentState.heldSales.filter((sale) =>
      sale.saleType === "wholesale" ? canViewWholesaleSales : canViewRetailSales,
    ),
  };
  const todaySales = currentState.sales.filter((sale) => sale.createdAt.slice(0, 10) === localDate());
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const lowStock = currentState.products.filter((product) => product.quantity <= 5);
  const canViewInventoryCosts = activeMember.role === "tenant_admin" || activeMember.permissions.includes("accountant") || activeMember.permissions.includes("warehouse_manager");
  const title = navItems.find((item) => item.id === page)?.label ?? "الرئيسية";

  async function updateProduct(product: OfflineProduct, editingId?: string) {
    assertOfflinePermission(activeMember, ["warehouse_manager"]);
    const existing = editingId ? currentState.products.find((item) => item.id === editingId) : undefined;
    if (editingId && !existing) throw new Error("لم يتم العثور على المنتج المطلوب تعديله.");
    const savedProduct = existing && activeMember.role !== "tenant_admin"
      ? { ...product, name: existing.name, sku: existing.sku, barcode: existing.barcode, category: existing.category, color: existing.color, size: existing.size, partNumber: existing.partNumber, expiresAt: existing.expiresAt }
      : product;
    const conflict = currentState.products.find((item) =>
      item.id !== editingId && ((savedProduct.sku && item.sku === savedProduct.sku) || (savedProduct.barcode && item.barcode === savedProduct.barcode)),
    );
    if (conflict) throw new Error("رمز المنتج أو الباركود مستخدم بالفعل.");
    const audit = createAuditEntry(
      editingId ? "تعديل منتج" : "إضافة منتج",
      "منتج",
      editingId ?? product.id,
      `${savedProduct.name} · الكمية ${digits(savedProduct.quantity)}`,
      activeMember.name,
    );
    const next = {
      ...currentState,
      products: editingId ? currentState.products.map((item) => item.id === editingId ? { ...savedProduct, id: editingId } : item) : [savedProduct, ...currentState.products],
      auditLogs: [audit, ...currentState.auditLogs],
    };
    await persist(next);
    setNotice(editingId ? "تم تحديث المنتج." : "تمت إضافة المنتج.");
  }
  async function removeProduct(id: string) {
    assertOfflinePermission(activeMember, ["warehouse_manager"]);
    if (!window.confirm("هل تريد حذف هذا المنتج؟")) return;
    if (currentState.sales.some((sale) => sale.items.some((item) => item.productId === id)) ||
      currentState.heldSales.some((sale) => sale.items.some((item) => item.productId === id))) {
      setSaveError("لا يمكن حذف منتج مرتبط بفاتورة سابقة. اجعل كميته صفرًا بدلًا من ذلك.");
      return;
    }
    const product = currentState.products.find((item) => item.id === id);
    await persist({
      ...currentState,
      products: currentState.products.filter((item) => item.id !== id),
      auditLogs: [createAuditEntry("حذف منتج", "منتج", id, product?.name ?? id, activeMember.name), ...currentState.auditLogs],
    });
    setNotice("تم حذف المنتج.");
  }
  async function completeSale(sale: OfflineSale) {
    assertOfflinePermission(activeMember, [sale.saleType === "wholesale" ? "wholesale_sales" : "retail_sales"]);
    if (!active) throw new Error("انتهت مدة الترخيص المحلي. تواصل مع مورّد النظام لتجديده.");
    for (const line of sale.items) {
      const product = currentState.products.find((item) => item.id === line.productId);
      if (!product || product.quantity < line.quantity) {
        throw new Error(`الكمية المتاحة من ${line.name} لم تعد كافية لإتمام البيع.`);
      }
    }
    const nextProducts = currentState.products.map((product) => {
      const sold = sale.items.find((item) => item.productId === product.id);
      return sold ? { ...product, quantity: product.quantity - sold.quantity } : product;
    });
    await persist({
      ...currentState,
      products: nextProducts,
      sales: [sale, ...currentState.sales],
      auditLogs: [createAuditEntry("إتمام عملية بيع", "فاتورة بيع", sale.invoiceNumber, `${sale.items.reduce((sum, item) => sum + item.quantity, 0)} وحدة · ${money(sale.total, currency)}`, activeMember.name), ...currentState.auditLogs],
    });
    setNotice(`تم حفظ الفاتورة ${sale.invoiceNumber}.`);
    setSaleDetail(sale);
  }
  async function holdSale(heldSale: OfflineHeldSale) {
    assertOfflinePermission(activeMember, [heldSale.saleType === "wholesale" ? "wholesale_sales" : "retail_sales"]);
    await persist({
      ...currentState,
      heldSales: [heldSale, ...currentState.heldSales],
      auditLogs: [createAuditEntry("تعليق فاتورة", "فاتورة معلقة", heldSale.reference, heldSale.customerName || "عميل نقدي", activeMember.name), ...currentState.auditLogs],
    });
    setNotice(`تم تعليق الفاتورة ${heldSale.reference}.`);
  }
  async function releaseHeldSale(id: string) {
    const heldSale = currentState.heldSales.find((item) => item.id === id);
    if (!heldSale) throw new Error("لم يتم العثور على الفاتورة المعلقة.");
    assertOfflinePermission(activeMember, [heldSale.saleType === "wholesale" ? "wholesale_sales" : "retail_sales"]);
    await persist({
      ...currentState,
      heldSales: currentState.heldSales.filter((item) => item.id !== id),
      auditLogs: [createAuditEntry("استعادة فاتورة معلقة", "فاتورة معلقة", heldSale.reference, "استُعيدت إلى شاشة نقطة البيع.", activeMember.name), ...currentState.auditLogs],
    });
    return heldSale;
  }
  async function recordReturn(request: OfflineReturnRequest) {
    const sale = currentState.sales.find((item) => item.id === request.saleId);
    if (!sale) throw new Error("لم يتم العثور على الفاتورة المحددة.");
    assertOfflinePermission(activeMember, [sale.saleType === "wholesale" ? "wholesale_sales" : "retail_sales"]);
    const result = applyOfflineReturn(currentState, { ...request, actorName: activeMember.name });
    await persist(result.state);
    setNotice(`تم تسجيل المرتجع · ${money(result.refundAmount, currency)}.`);
  }
  async function recordExchange(request: OfflineExchangeRequest) {
    const sale = currentState.sales.find((item) => item.id === request.saleId);
    if (!sale) throw new Error("لم يتم العثور على الفاتورة المحددة.");
    assertOfflinePermission(activeMember, [sale.saleType === "wholesale" ? "wholesale_sales" : "retail_sales"]);
    const result = applyOfflineExchange(currentState, { ...request, actorName: activeMember.name });
    await persist(result.state);
    const settlement = result.exchange.changeAmount > 0
      ? result.exchange.balanceDue > 0
        ? `الباقي للعميل ${money(result.exchange.changeAmount, currency)}`
        : `المبلغ المسترد للعميل ${money(result.exchange.changeAmount, currency)}`
      : "";
    setNotice([`تم الاستبدال · ${result.exchange.replacementInvoiceNumber}`, settlement].filter(Boolean).join(" · "));
  }
  async function saveTeamMember(member: OfflineTeamMember, editingId?: string) {
    assertOfflinePermission(activeMember, ["warehouse_manager"]);
    if (activeMember.role !== "tenant_admin") throw new Error("إدارة حسابات الفريق متاحة لمالك المتجر فقط.");
    if (member.active && (!member.pinSalt || !member.pinHash || !member.pinIterations)) {
      throw new Error("يجب إعداد رمز دخول لكل عضو نشط.");
    }
    if (editingId === activeMember.id && member.role !== "tenant_admin") {
      throw new Error("لا يمكنك تغيير دور حساب المالك الذي تستخدمه الآن.");
    }
    const remainingAdmin = currentState.teamMembers.some((item) =>
      item.id !== editingId && item.role === "tenant_admin" && item.active && item.pinHash && item.pinSalt,
    );
    if (!remainingAdmin && (member.role !== "tenant_admin" || !member.active)) {
      throw new Error("يجب إبقاء حساب مالك نشط واحد على الأقل.");
    }
    const nextMembers = editingId
      ? currentState.teamMembers.map((item) => item.id === editingId ? { ...member, id: editingId } : item)
      : [member, ...currentState.teamMembers];
    await persist({
      ...currentState,
      teamMembers: nextMembers,
      auditLogs: [createAuditEntry(editingId ? "تعديل عضو فريق" : "إضافة عضو فريق", "عضو فريق", editingId ?? member.id, `${member.name} · ${member.roleName}`, activeMember.name), ...currentState.auditLogs],
    });
    setNotice(editingId ? "تم تحديث بيانات عضو الفريق." : "تمت إضافة عضو للفريق.");
  }
  async function removeTeamMember(id: string) {
    if (activeMember.role !== "tenant_admin") throw new Error("إدارة حسابات الفريق متاحة لمالك المتجر فقط.");
    if (id === activeMember.id) throw new Error("لا يمكنك إزالة حساب الدخول الذي تستخدمه الآن.");
    const member = currentState.teamMembers.find((item) => item.id === id);
    if (member?.role === "tenant_admin" && member.active && !currentState.teamMembers.some((item) => item.id !== id && item.role === "tenant_admin" && item.active && item.pinHash && item.pinSalt)) {
      throw new Error("لا يمكن إزالة آخر حساب مالك نشط.");
    }
    await persist({
      ...currentState,
      teamMembers: currentState.teamMembers.filter((item) => item.id !== id),
      auditLogs: [createAuditEntry("إزالة عضو فريق", "عضو فريق", id, member?.name ?? id, activeMember.name), ...currentState.auditLogs],
    });
    setNotice("تمت إزالة العضو من الفريق.");
  }
  async function chooseFolder() {
    if (activeMember.role !== "tenant_admin") throw new Error("إعداد النسخ الاحتياطي متاح لمالك المتجر فقط.");
    try {
      const folder = await chooseOfflineBackupFolder();
      if (!folder) return;
      await persist({
        ...currentState,
        backup: { ...currentState.backup, backupFolder: folder, lastError: null },
        auditLogs: [createAuditEntry("تغيير مجلد النسخ", "نسخة احتياطية", currentState.store?.name ?? "المتجر", "تم تحديث مجلد النسخ المحلي.", activeMember.name), ...currentState.auditLogs],
      });
      setNotice(desktop ? "تم تحديث مجلد النسخ الاحتياطي." : "هذه معاينة؛ لا يمثل المسار مجلدًا حقيقيًا على ويندوز.");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "تعذر اختيار المجلد."); }
  }
  async function manualBackup() {
    if (activeMember.role !== "tenant_admin") { setSaveError("إنشاء النسخ الاحتياطية متاح لمالك المتجر فقط."); return; }
    try {
      const saved = await createManualOfflineBackup();
      const withAudit = { ...saved, auditLogs: [createAuditEntry("إنشاء نسخة احتياطية", "نسخة احتياطية", currentState.store?.name ?? "المتجر", "تم إنشاء نسخة محلية.", activeMember.name), ...saved.auditLogs] };
      await persist(withAudit);
      setNotice(desktop ? "تم إنشاء النسخة الاحتياطية." : "تم حفظ نسخة معاينة داخل المتصفح؛ ليست ملفًا على الجهاز.");
    }
    catch (e) { setSaveError(e instanceof Error ? e.message : "تعذر إنشاء النسخة الاحتياطية."); }
  }
  async function restoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    if (activeMember.role !== "tenant_admin") { setSaveError("استعادة النسخة الاحتياطية متاحة لمالك المتجر فقط."); return; }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const raw: unknown = JSON.parse(await file.text());
      const parsed = migrateOfflineState(raw);
      if (!parsed || !isOfflineState(parsed)) { setSaveError("ملف غير صالح أو غير متوافق مع X-Store Offline."); return; }
      if (!window.confirm("سيتم استبدال بيانات المتجر الحالية بمحتوى الملف. هل تريد المتابعة؟")) return;
      const restored = await restoreOfflineBackup(parsed);
      setState(restored); setAuthenticatedMemberId(null); setNotice("تم استرجاع البيانات بنجاح. سجّل الدخول من جديد.");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "تعذر قراءة ملف النسخة الاحتياطية."); }
  }
  async function updateSettings(store: OfflineState["store"]) {
    if (!store) return;
    if (activeMember.role !== "tenant_admin") throw new Error("إعدادات المتجر متاحة لمالك المتجر فقط.");
    await persist({
      ...currentState,
      store,
      auditLogs: [createAuditEntry("تحديث إعدادات المتجر", "إعدادات", store.name, "تحديث بيانات النشاط والضريبة والفواتير.", activeMember.name), ...currentState.auditLogs],
    });
    setNotice("تم حفظ إعدادات المتجر.");
  }
  async function activateLicense(license: OfflineLicense) {
    if (activeMember.role !== "tenant_admin") {
      throw new Error("تفعيل الترخيص متاح لمالك المتجر فقط.");
    }
    const planNames = {
      monthly: "شهري",
      half_yearly: "نصف سنوي",
      annual: "سنوي",
      lifetime: "مدى الحياة",
    } as const;
    await persist({
      ...currentState,
      license,
      auditLogs: [
        createAuditEntry(
          "استيراد ملف تفعيل",
          "ترخيص محلي",
          license.payload.licenseId,
          `الخطة ${planNames[license.payload.plan]}`,
          activeMember.name,
        ),
        ...currentState.auditLogs,
      ],
    });
    setNotice(`تم تفعيل الترخيص ${planNames[license.payload.plan]}.`);
  }
  function goToPage(nextPage: Page) {
    if (!canAccessOfflinePage(activeMember, nextPage)) {
      setSaveError("لا تملك صلاحية لفتح هذه الصفحة.");
      return;
    }
    setPage(nextPage);
    setSaleDetail(null);
    setSaveError("");
  }
  return <div className="of-app" dir="rtl">
    <aside className="of-sidebar">
      <div className="of-sidebar-brand"><BrandMark /><span className="of-edition">نسخة مستقلة · Windows</span></div>
      <div className="of-shop-chip"><span className="of-shop-avatar"><Store size={18} /></span><span><b>{state.store.name}</b><small>{state.store.businessType}</small></span><ChevronDown size={15} /></div>
      <nav className="of-nav">{navItems.filter(({ id }) => canAccessOfflinePage(activeMember, id)).map(({ id, label, icon: Icon }) => <button key={id} className={`of-nav-item ${page === id ? "selected" : ""}`} onClick={() => goToPage(id)}><Icon size={18} /><span>{label}</span>{id === "products" && lowStock.length > 0 && <i>{digits(lowStock.length)}</i>}</button>)}</nav>
       <div className="of-sidebar-bottom"><div className={`of-license-chip ${state.license && !active ? "expired" : ""}`}><span className="of-license-status"><ShieldCheck size={16} /></span><span><b>{active ? "الترخيص نشط" : state.license ? "انتهى الترخيص" : "بانتظار التفعيل"}</b><small>{state.license?.payload.expiresAt ? `ينتهي ${state.license.payload.expiresAt}` : state.license ? "ترخيص مدى الحياة" : "صدّر طلب التفعيل من الإعدادات"}</small></span></div><div className="of-device-note"><LockKeyhole size={14} /> لا توجد مزامنة أو اتصال سحابي</div></div>
    </aside>
    <div className="of-main">
      <header className="of-topbar"><div className="of-mobile-brand"><BrandMark compact /></div><div className="of-breadcrumb"><span>المتجر</span><i>/</i><b>{title}</b></div><div className="of-top-right"><span className="of-online-state"><i /> يعمل دون إنترنت</span><span className="of-top-date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span><span className="of-current-user" title={activeMember.roleName}>{activeMember.name}</span><button className="of-avatar" title={activeMember.name}>{activeMember.name.slice(0, 1)}</button><button className="of-logout-button" onClick={() => { setAuthenticatedMemberId(null); setSaleDetail(null); setSaveError(""); }} aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut size={16} /><span>خروج</span></button></div></header>
      {(saveError || state.backup.lastError) && <div className="of-alert"><CircleAlert size={17} /><span>{saveError || state.backup.lastError}</span><button aria-label="إغلاق" onClick={() => { setSaveError(""); if (state.backup.lastError) void persist({ ...state, backup: { ...state.backup, lastError: null } }); }}><X size={15} /></button></div>}
      <main className="of-content">
        {page === "dashboard" && <Dashboard state={viewState} todaySales={todaySales} todayRevenue={todayRevenue} lowStock={lowStock} currency={currency} canViewSales={canViewAllSales || activeMember.permissions.some((permission) => salesPermissions.includes(permission))} canViewAmounts={canViewAllSales} canViewInventoryCosts={canViewInventoryCosts} roleName={activeMember.roleName} canNavigate={(target) => canAccessOfflinePage(activeMember, target)} onNavigate={goToPage} onSale={setSaleDetail} />}
        {page === "products" && <ProductsPage state={state} currency={currency} canEditDetails={activeMember.role === "tenant_admin"} canDelete={activeMember.role === "tenant_admin"} onSave={updateProduct} onRemove={removeProduct} />}
        {page === "pos" && <PosPage state={posState} licenseActive={active} canSellRetail={canViewRetailSales} canSellWholesale={wholesaleEnabled && (activeMember.role === "tenant_admin" || activeMember.permissions.includes("wholesale_sales"))} cashierName={activeMember.name} onComplete={completeSale} onHold={holdSale} onRelease={releaseHeldSale} onReturns={() => goToPage("returns")} />}
        {page === "sales" && <SalesPage state={viewState} currency={currency} showAmounts={canViewAllSales} onSelect={setSaleDetail} />}
        {page === "returns" && <OfflineReturnsPage state={viewState} currency={currency} onReturn={recordReturn} onExchange={recordExchange} />}
        {page === "team" && <OfflineTeamPage state={state} onSave={saveTeamMember} onRemove={removeTeamMember} />}
        {page === "reports" && <OfflineReportsPage state={state} currency={currency} />}
        {page === "audit" && <OfflineAuditPage state={state} />}
        {page === "backup" && <BackupPage state={state} desktop={desktop} onChooseFolder={chooseFolder} onBackup={manualBackup} onRestore={() => fileInput.current?.click()} />}
        {page === "settings" && <SettingsPage state={state} onSave={updateSettings} onActivate={activateLicense} />}
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

function Dashboard({ state, todaySales, todayRevenue, lowStock, currency, canViewSales, canViewAmounts, canViewInventoryCosts, roleName, canNavigate, onNavigate, onSale }: {
  state: OfflineState;
  todaySales: OfflineSale[];
  todayRevenue: number;
  lowStock: OfflineProduct[];
  currency: string;
  canViewSales: boolean;
  canViewAmounts: boolean;
  canViewInventoryCosts: boolean;
  roleName: string;
  canNavigate: (page: Page) => boolean;
  onNavigate: (p: Page) => void;
  onSale: (sale: OfflineSale) => void;
}) {
  const units = state.products.reduce((sum, p) => sum + p.quantity, 0);
  const inventoryValue = state.products.reduce((sum, p) => sum + (p.price ?? 0) * p.quantity, 0);
  const latest = canViewSales ? [...state.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5) : [];
  return <section className="of-page">
    <PageHeading kicker="ملخص المتجر" title={`مرحبًا بك في ${state.store?.name}`} description="نظرة سريعة على حركة متجرك اليوم." action={canNavigate("pos") ? <button className="of-button of-button-primary" onClick={() => onNavigate("pos")}><Plus size={16} /> عملية بيع جديدة</button> : undefined} />
    <div className="of-stats-grid">
      {canViewAmounts ? <>
        <StatCard label="مبيعات اليوم" value={digits(todaySales.length)} caption="عملية بيع مكتملة" icon={Receipt} tone="green" />
        <StatCard label="إيراد اليوم" value={money(todayRevenue, currency)} caption="إجمالي المبيعات اليوم" icon={Wallet} tone="gold" />
        <StatCard label="قيمة المخزون" value={canViewInventoryCosts ? money(inventoryValue, currency) : "غير متاحة"} caption="محسوبة بسعر البيع" icon={BarChart3} tone="blue" />
        <StatCard label="الاشتراك" value={state.store?.name ?? "المتجر"} caption="مساحة العمل المحلية" icon={ShieldCheck} tone="green" />
      </> : canViewSales ? <>
        <StatCard label="عمليات اليوم" value={digits(todaySales.length)} caption="فواتير مكتملة" icon={Receipt} tone="green" />
        <StatCard label="نقطة البيع" value="جاهزة" caption="ابدأ عملية جديدة" icon={ShoppingCart} tone="blue" />
        <StatCard label="المتجر" value={state.store?.name ?? "متجرك"} caption="مساحة عمل محلية" icon={Store} tone="gold" />
        <StatCard label="مساعدة الصندوق" value="متاحة" caption="البيع والمرتجعات" icon={ShieldCheck} tone="green" />
      </> : <>
        <StatCard label="منتجات منخفضة المخزون" value={digits(lowStock.length)} caption="تحتاج مراجعة" icon={Activity} tone="gold" />
        <StatCard label="دورك" value={roleName} caption="صلاحيات محددة من مالك المتجر" icon={ShieldCheck} tone="blue" />
        <StatCard label="مبيعات اليوم" value={digits(todaySales.length)} caption="عدد الفواتير المكتملة" icon={Receipt} tone="green" />
        <StatCard label="البيانات المالية" value="غير متاحة" caption="ليست ضمن صلاحياتك" icon={Wallet} tone="gold" />
      </>}
    </div>
    <div className="of-dashboard-grid">
      {canViewSales && <section className="of-panel of-sales-panel"><div className="of-panel-head"><div><h2>آخر المبيعات</h2><p>أحدث الفواتير المسجلة محليًا</p></div>{canNavigate("sales") && <button className="of-text-button" onClick={() => onNavigate("sales")}>عرض سجل المبيعات <ArrowUpRight size={15} /></button>}</div>
        {latest.length ? <div className="of-table-scroll"><table className="of-table"><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th>{canViewAmounts && <th>الإجمالي</th>}<th /></tr></thead><tbody>{latest.map((sale) => <tr key={sale.id} onClick={() => onSale(sale)}><td><b className="of-invoice-number">{sale.invoiceNumber}</b></td><td>{sale.customerName || "عميل نقدي"}</td><td>{dateTime(sale.createdAt)}</td>{canViewAmounts && <td className="of-number">{money(sale.total, currency)}</td>}<td><ArrowUpRight size={15} /></td></tr>)}</tbody></table></div> : <EmptyState icon={Receipt} title="لا توجد مبيعات بعد" copy="ستظهر الفواتير هنا بعد إتمام أول عملية بيع." action={canNavigate("pos") ? <button className="of-button of-button-secondary" onClick={() => onNavigate("pos")}>ابدأ أول عملية بيع</button> : undefined} />}
      </section>}
      {canViewInventoryCosts && <section className="of-panel of-low-panel"><div className="of-panel-head"><div><h2>تنبيه المخزون</h2><p>تابع المنتجات التي قاربت على النفاد</p></div><span className="of-counter">{digits(lowStock.length)}</span></div>
        {lowStock.length ? <div className="of-low-list">{lowStock.slice(0, 5).map((product) => <div className="of-low-item" key={product.id}><span className="of-product-mark"><Package size={17} /></span><span className="of-low-name"><b>{product.name}</b><small>{product.sku || "بدون رمز"}</small></span><span className={`of-stock-pill ${product.quantity === 0 ? "empty" : ""}`}>{product.quantity === 0 ? "نفد" : `متبقي ${digits(product.quantity)}`}</span></div>)}</div> : <div className="of-good-stock"><span><Check size={18} /></span><b>المخزون بحالة جيدة</b><small>لا توجد منتجات منخفضة حاليًا.</small></div>}
        {canNavigate("products") && <button className="of-wide-link" onClick={() => onNavigate("products")}>إدارة المنتجات <ArrowLeft size={15} /></button>}
      </section>}
    </div>
    {(canNavigate("pos") || canNavigate("products") || canNavigate("backup")) && <section className="of-panel of-quick-panel"><div className="of-panel-head"><div><h2>اختصارات يومية</h2><p>الوصول السريع إلى مهام المتجر</p></div></div><div className="of-quick-actions">
      {canNavigate("pos") && <button onClick={() => onNavigate("pos")}><span className="quick-green"><ShoppingCart size={19} /></span><b>بدء عملية بيع</b><small>إنشاء فاتورة جديدة</small><ArrowLeft size={15} /></button>}
      {canNavigate("products") && <button onClick={() => onNavigate("products")}><span className="quick-blue"><Package size={19} /></span><b>إضافة منتج</b><small>تحديث قائمة المخزون</small><ArrowLeft size={15} /></button>}
      {canNavigate("backup") && <button onClick={() => onNavigate("backup")}><span className="quick-gold"><Archive size={19} /></span><b>حفظ نسخة احتياطية</b><small>حماية سجلات متجرك</small><ArrowLeft size={15} /></button>}
    </div></section>}
  </section>;
}

function StatCard({ label, value, caption, icon: Icon, tone }: { label: string; value: string; caption: string; icon: typeof Wallet; tone: string }) {
  return <article className="of-stat-card"><div className="of-stat-top"><span>{label}</span><i className={`tone-${tone}`}><Icon size={18} /></i></div><strong className="of-stat-value">{value}</strong><small>{caption}</small></article>;
}
function EmptyState({ icon: Icon, title, copy, action }: { icon: typeof Receipt; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="of-empty"><span><Icon size={22} /></span><b>{title}</b><p>{copy}</p>{action}</div>;
}

function ProductsPage({ state, currency, canEditDetails, canDelete, onSave, onRemove }: {
  state: OfflineState;
  currency: string;
  canEditDetails: boolean;
  canDelete: boolean;
  onSave: (product: OfflineProduct, id?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [modal, setModal] = useState<OfflineProduct | "new" | null>(null);
  const categories = [...new Set(state.products.map((product) => product.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ar"));
  const lowStockCount = state.products.filter((product) => product.quantity > 0 && product.quantity <= 5).length;
  const outOfStockCount = state.products.filter((product) => product.quantity <= 0).length;
  const inventoryValue = state.products.reduce((sum, product) => sum + (product.price ?? 0) * product.quantity, 0);
  const products = state.products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku} ${product.barcode} ${product.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesCategory = categoryFilter === "__all__" || product.category === categoryFilter;
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "low" && product.quantity > 0 && product.quantity <= 5) ||
      (stockFilter === "out" && product.quantity <= 0);
    return matchesQuery && matchesCategory && matchesStock;
  });
  function adjustQuantity(product: OfflineProduct, delta: number) {
    void onSave({ ...product, quantity: Math.max(0, product.quantity + delta) }, product.id);
  }
  return <section className="of-page">
    <PageHeading kicker="إدارة المخزون" title="المنتجات" description="أضف المنتجات وتابع الكميات والأسعار المتاحة." action={<button className="of-button of-button-primary" onClick={() => setModal("new")}><Plus size={16} /> إضافة منتج</button>} />
    <div className="of-stats-grid of-inventory-stats">
      <StatCard label="إجمالي المنتجات" value={digits(state.products.length)} caption="منتجات مسجلة في المتجر" icon={Package} tone="blue" />
      <StatCard label="قريب من النفاد" value={digits(lowStockCount)} caption="رصيد من 1 إلى 5 وحدات" icon={Activity} tone="gold" />
      <StatCard label="قيمة المخزون" value={money(inventoryValue, currency)} caption="محسوبة بسعر البيع" icon={BarChart3} tone="green" />
      <StatCard label="التصنيفات" value={digits(categories.length)} caption={`${digits(outOfStockCount)} منتج نفد` } icon={Archive} tone="red" />
    </div>
    <div className="of-toolbar"><label className="of-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالعربي أو English أو بالكود والباركود..." /><kbd>بحث</kbd></label><select aria-label="التصنيف" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="__all__">كل التصنيفات</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><select aria-label="حالة المخزون" value={stockFilter} onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}><option value="all">كل الكميات</option><option value="low">قريب من النفاد</option><option value="out">نفد المخزون</option></select><span className="of-result-count">{digits(products.length)} من {digits(state.products.length)} منتج</span></div>
    <section className="of-panel of-inventory-panel">{products.length ? <div className="of-table-scroll"><table className="of-table of-product-table"><thead><tr><th>المنتج</th><th>التصنيف</th><th>سعر القطاعي</th>{OFFLINE_STORE_TYPES.find((item) => item.value === state.store?.storeType)?.supportsWholesale && <th>سعر الجملة</th>}<th>سعر التكلفة</th><th>الكمية</th><th>الرمز</th><th /></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><b className="of-product-title">{product.name}</b><small>{product.barcode || "—"}</small></td><td>{product.category || "—"}</td><td className="of-number">{product.price === null ? "—" : money(product.price, currency)}</td>{OFFLINE_STORE_TYPES.find((item) => item.value === state.store?.storeType)?.supportsWholesale && <td className="of-number">{product.wholesalePrice === null ? "—" : money(product.wholesalePrice, currency)}</td>}<td className="of-number">{money(product.costPrice, currency)}</td><td><span className={`of-quantity ${product.quantity <= 5 ? "low" : ""}`}>{digits(product.quantity)}</span></td><td className="of-code">{product.sku || "—"}</td><td><div className="of-row-actions"><button title="تقليل الكمية" aria-label={`تقليل كمية ${product.name}`} disabled={product.quantity <= 0} onClick={() => adjustQuantity(product, -1)} data-testid={`button-offline-stock-decrease-${product.id}`}><Minus size={15} /></button><button title="زيادة الكمية" aria-label={`زيادة كمية ${product.name}`} onClick={() => adjustQuantity(product, 1)} data-testid={`button-offline-stock-increase-${product.id}`}><Plus size={15} /></button><button title="تعديل المنتج" aria-label={`تعديل ${product.name}`} onClick={() => setModal(product)}><Settings size={15} /></button>{canDelete && <button title="حذف المنتج" aria-label={`حذف ${product.name}`} onClick={() => void onRemove(product.id)}><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={Package} title={query || categoryFilter !== "__all__" || stockFilter !== "all" ? "لا توجد نتائج" : "قائمة المنتجات فارغة"} copy={query || categoryFilter !== "__all__" || stockFilter !== "all" ? "عدّل البحث أو فلاتر المخزون والتصنيف." : "أضف منتجات متجرك لتبدأ متابعة المخزون وإتمام المبيعات."} action={!query && categoryFilter === "__all__" && stockFilter === "all" ? <button className="of-button of-button-primary" onClick={() => setModal("new")}><Plus size={16} /> إضافة أول منتج</button> : undefined} />}</section>
    {modal && <ProductDialog initial={modal === "new" ? null : modal} wholesale={OFFLINE_STORE_TYPES.find((item) => item.value === state.store?.storeType)?.supportsWholesale ?? false} canEditDetails={canEditDetails || modal === "new"} currency={currency} onClose={() => setModal(null)} onSave={async (p) => { await onSave(p, modal === "new" ? undefined : modal.id); setModal(null); }} />}
  </section>;
}

function ProductDialog({ initial, wholesale, canEditDetails, currency, onClose, onSave }: { initial: OfflineProduct | null; wholesale: boolean; canEditDetails: boolean; currency: string; onClose: () => void; onSave: (p: OfflineProduct) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [cost, setCost] = useState(String(initial?.costPrice ?? ""));
  const [wholesalePrice, setWholesalePrice] = useState(String(initial?.wholesalePrice ?? ""));
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ""));
  const [color, setColor] = useState(initial?.color ?? "");
  const [size, setSize] = useState(initial?.size ?? "");
  const [partNumber, setPartNumber] = useState(initial?.partNumber ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const retailPrice = price.trim() === "" ? null : Number(price);
    const bulkPrice = wholesale && wholesalePrice.trim() !== "" ? Number(wholesalePrice) : null;
    if (!name.trim() || (retailPrice === null && bulkPrice === null) || (retailPrice !== null && (!Number.isFinite(retailPrice) || retailPrice < 0)) || !Number.isFinite(Number(cost)) || Number(cost) < 0 || !Number.isInteger(Number(quantity)) || Number(quantity) < 0 || (bulkPrice !== null && (!Number.isFinite(bulkPrice) || bulkPrice < 0))) { setError("أدخل سعرًا قطاعيًا أو سعر جملة واحدًا على الأقل، وتحقق من الكمية والتكلفة."); return; }
    setSaving(true); setError("");
    try { await onSave({ id: initial?.id ?? makeId(), name: name.trim(), sku: sku.trim(), barcode: barcode.trim(), category: category.trim(), costPrice: Number(cost) || 0, price: retailPrice, wholesalePrice: bulkPrice, quantity: Number(quantity) || 0, color: color.trim(), size: size.trim(), partNumber: partNumber.trim(), expiresAt: expiresAt || null, createdAt: initial?.createdAt ?? new Date().toISOString() }); }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ المنتج."); } finally { setSaving(false); }
  }
  return <div className="of-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="of-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><header className="of-dialog-head"><div><span className="of-kicker">بيانات المخزون</span><h2 id="product-dialog-title">{initial ? "تعديل المنتج" : "إضافة منتج جديد"}</h2></div><button onClick={onClose} aria-label="إغلاق"><X size={18} /></button></header><form onSubmit={submit}><div className="of-form-grid">
    {canEditDetails && <>
      <Field label="اسم المنتج"><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المنتج" /></Field><Field label="التصنيف"><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="مثال: إكسسوارات" /></Field>
      <Field label="رمز المنتج (SKU)"><input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="اختياري" /></Field><Field label="الباركود"><input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="اختياري" /></Field>
      <Field label="اللون"><input value={color} onChange={(e) => setColor(e.target.value)} placeholder="اختياري" /></Field><Field label="المقاس"><input value={size} onChange={(e) => setSize(e.target.value)} placeholder="اختياري" /></Field>
      <Field label="رقم القطعة"><input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="اختياري" /></Field><Field label="تاريخ انتهاء الصلاحية"><input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field>
    </>}
     <Field label={`سعر القطاعي (${currency})`} hint="يمكن تركه فارغًا إذا كان المنتج يباع بالجملة فقط."><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label={`سعر التكلفة (${currency})`}><input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
     {wholesale && <Field label={`سعر الجملة (${currency})`} hint="يمكن تركه فارغًا إذا لم يكن للمنتج سعر جملة."><input type="number" min="0" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} placeholder="اختياري" /></Field>}<Field label="الكمية المتاحة"><input required type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
    </div>{error && <div className="of-error"><CircleAlert size={15} />{error}</div>}<div className="of-dialog-actions"><button type="button" className="of-button of-button-secondary" onClick={onClose}>إلغاء</button><button className="of-button of-button-primary" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ المنتج"}</button></div></form></section></div>;
}

function PosPage({ state, licenseActive, canSellRetail, canSellWholesale, cashierName, onComplete, onHold, onRelease, onReturns }: {
  state: OfflineState;
  licenseActive: boolean;
  canSellRetail: boolean;
  canSellWholesale: boolean;
  cashierName: string;
  onComplete: (sale: OfflineSale) => Promise<void>;
  onHold: (sale: OfflineHeldSale) => Promise<void>;
  onRelease: (id: string) => Promise<OfflineHeldSale>;
  onReturns: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payment, setPayment] = useState<OfflineSale["paymentMethod"]>("cash");
  const [saleType, setSaleType] = useState<"retail" | "wholesale">(canSellRetail ? "retail" : "wholesale");
  const [discount, setDiscount] = useState("0");
  const [received, setReceived] = useState("");
  const [transferSender, setTransferSender] = useState("");
  const [invoiceReference, setInvoiceReference] = useState(createHeldInvoiceReference);
  const [heldOpen, setHeldOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currency = state.store?.currency ?? "EGP";
  const wholesaleEnabled = state.store?.wholesaleEnabled ?? false;
  const priceFor = (product: OfflineProduct) => saleType === "wholesale" ? product.wholesalePrice : product.price;
  const visibleProducts = state.products.filter((product) =>
    product.quantity > 0 && priceFor(product) !== null &&
    `${product.name} ${product.sku} ${product.barcode} ${product.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const cartLines = Object.entries(cart).flatMap(([productId, quantity]) => {
    const product = state.products.find((item) => item.id === productId);
    const price = product ? priceFor(product) : null;
    return product && price !== null && quantity > 0 ? [{ product, quantity, price }] : [];
  });
  const subtotal = roundMoney(cartLines.reduce((sum, row) => sum + row.price * row.quantity, 0));
  const discountAmount = Math.min(subtotal, roundMoney(Math.max(0, Number(discount) || 0)));
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = roundMoney(taxableSubtotal * ((state.store?.vatRate ?? 0) / 100));
  const total = roundMoney(taxableSubtotal + tax);
  const cashAmount = Number(received);
  const cashAmountInvalid = payment === "cash" && (!received.trim() || !Number.isFinite(cashAmount) || roundMoney(cashAmount) < total);
  const transferSenderInvalid = (payment === "wallet" || payment === "instapay" || payment === "transfer") && !transferSender.trim();

  function resetSale() {
    setCart({});
    setCustomerName("");
    setCustomerPhone("");
    setDiscount("0");
    setReceived("");
    setTransferSender("");
    setPayment("cash");
    setInvoiceReference(createHeldInvoiceReference());
  }
  function add(product: OfflineProduct) {
    setError("");
    setCart((current) => ({ ...current, [product.id]: Math.min(product.quantity, (current[product.id] ?? 0) + 1) }));
  }
  function setQuantity(id: string, quantity: number) {
    setCart((current) => {
      if (quantity <= 0) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      const product = state.products.find((item) => item.id === id);
      return { ...current, [id]: Math.min(product?.quantity ?? 0, Math.floor(quantity)) };
    });
  }
  function switchSaleType(next: "retail" | "wholesale") {
    if (next === saleType || (next === "wholesale" && !canSellWholesale) || (next === "retail" && !canSellRetail)) return;
    if (cartLines.length && !window.confirm("سيتم تفريغ الطلب الحالي قبل تغيير قسم البيع. هل تريد المتابعة؟")) return;
    resetSale();
    setSaleType(next);
  }
  async function checkout() {
    if (!cartLines.length || !licenseActive || cashAmountInvalid || transferSenderInvalid ||
      (saleType === "retail" && !canSellRetail) || (saleType === "wholesale" && !canSellWholesale)) return;
    setBusy(true);
    setError("");
    const createdAt = new Date().toISOString();
    const sale: OfflineSale = {
      id: makeId(),
      invoiceNumber: invoiceReference,
      createdAt,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod: payment,
      saleType,
      transferSender: payment === "wallet" || payment === "instapay" || payment === "transfer" ? transferSender.trim() : "",
      items: cartLines.map(({ product, quantity, price }) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity,
        unitPrice: price,
        unitCost: product.costPrice,
        lineTotal: roundMoney(quantity * price),
        returnedQuantity: 0,
      })),
      subtotal,
      discountAmount,
      taxAmount: tax,
      total,
      amountReceived: payment === "cash" ? roundMoney(cashAmount) : total,
      changeAmount: payment === "cash" ? roundMoney(Math.max(0, cashAmount - total)) : 0,
      cashierName,
      exchangeOfInvoiceNumber: null,
    };
    try {
      await onComplete(sale);
      resetSale();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ الفاتورة.");
    } finally {
      setBusy(false);
    }
  }
  async function parkSale() {
    if (!cartLines.length || transferSenderInvalid ||
      (saleType === "retail" && !canSellRetail) || (saleType === "wholesale" && !canSellWholesale)) return;
    setBusy(true);
    setError("");
    const createdAt = new Date().toISOString();
    const heldSale: OfflineHeldSale = {
      id: makeId(),
      reference: invoiceReference,
      createdAt,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod: payment,
      saleType,
      transferSender: transferSender.trim(),
      items: cartLines.map(({ product, quantity, price }) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity,
        unitPrice: price,
        unitCost: product.costPrice,
      })),
      subtotal,
      discountAmount,
      taxAmount: tax,
      estimatedTotal: total,
      amountReceived: roundMoney(Math.max(0, Number(received) || 0)),
    };
    try {
      await onHold(heldSale);
      resetSale();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تعليق الفاتورة.");
    } finally {
      setBusy(false);
    }
  }
  async function restoreHeld(heldSale: OfflineHeldSale) {
    if (cartLines.length) return;
    setBusy(true);
    setError("");
    try {
      const restored = await onRelease(heldSale.id);
      setCart(Object.fromEntries(restored.items.map((item) => [item.productId, item.quantity])));
      setCustomerName(restored.customerName);
      setCustomerPhone(restored.customerPhone);
      setSaleType(restored.saleType);
      setDiscount(String(restored.discountAmount));
      setReceived(restored.amountReceived ? String(restored.amountReceived) : "");
      setTransferSender(restored.transferSender);
      setPayment(restored.paymentMethod);
      setInvoiceReference(restored.reference);
      setHeldOpen(false);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر استعادة الفاتورة المعلقة.");
    } finally {
      setBusy(false);
    }
  }

  if (!canSellRetail && !canSellWholesale) return <section className="of-page">
    <PageHeading kicker="نقطة البيع" title="صندوق البيع" description="لا توجد صلاحية بيع مفعّلة لهذا الحساب." />
    <div className="of-panel"><EmptyState icon={ShieldCheck} title="لا يوجد نوع بيع متاح" copy="اطلب من مالك المتجر منحك صلاحية قطاعي أو جملة، والتأكد من تفعيل البيع بالجملة عند الحاجة." /></div>
  </section>;

  return <section className="of-page">
    <PageHeading kicker="نقطة البيع" title="صندوق البيع" description="ابحث عن المنتجات، أضف الخصم، واختر طريقة الدفع." action={<div className="of-pos-head-actions"><button className="of-button of-button-secondary" onClick={onReturns}><ArrowLeftRight size={15} /> مرتجع أو استبدال</button><button className="of-button of-button-secondary" onClick={() => setHeldOpen(true)}><Pause size={15} /> الفواتير المعلقة <b className="of-held-count">{digits(state.heldSales.length)}</b></button></div>} />
    <div className="of-pos-layout"><section className="of-panel of-pos-products">
      <div className="of-pos-toolbar"><label className="of-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم المنتج أو الكود أو امسح الباركود..." /></label>
        {wholesaleEnabled && (canSellRetail || canSellWholesale) && <div className={`of-sale-tabs ${canSellRetail && canSellWholesale ? "" : "of-sale-tabs-single"}`} role="group" aria-label="نوع البيع">{canSellRetail && <button className={saleType === "retail" ? "chosen" : ""} aria-pressed={saleType === "retail"} onClick={() => switchSaleType("retail")}>القطاعي</button>}{canSellWholesale && <button className={saleType === "wholesale" ? "chosen" : ""} aria-pressed={saleType === "wholesale"} onClick={() => switchSaleType("wholesale")}>الجملة</button>}</div>}
      </div>
      {visibleProducts.length ? <div className="of-pos-grid">{visibleProducts.map((product) => <button key={product.id} className="of-pos-product" onClick={() => add(product)}><span className="of-pos-product-icon"><Package size={19} /></span><b>{product.name}</b><small>{product.sku || product.category || "منتج"}</small><strong>{money(priceFor(product) ?? 0, currency)}</strong><i>متاح {digits(product.quantity)}</i><span className="of-pos-add"><Plus size={15} /></span></button>)}</div> : <EmptyState icon={Package} title={query ? "لا توجد منتجات مطابقة" : "لا توجد منتجات جاهزة للبيع"} copy={query ? "جرّب البحث باسم المنتج أو رمزه." : saleType === "wholesale" ? "لا توجد منتجات متاحة بسعر الجملة. أضف أسعار الجملة من المخزون." : "أضف منتجات بسعر قطاعي إلى المخزون لتظهر هنا."} />}
    </section>
      <aside className="of-panel of-cart-panel"><header className="of-cart-head"><div><h2>الطلب الحالي</h2><p>{digits(cartLines.reduce((sum, row) => sum + row.quantity, 0))} وحدة · {saleType === "retail" ? "قطاعي" : "جملة"}</p></div><button className="of-clear-cart" onClick={resetSale} disabled={!cartLines.length}>تفريغ</button></header>
        <div className="of-invoice-reference"><span>رقم الفاتورة</span><b dir="ltr">{invoiceReference}</b></div>
        <div className="of-cart-lines">{cartLines.length ? cartLines.map(({ product, quantity, price }) => <div className="of-cart-line" key={product.id}><div className="of-cart-line-name"><b>{product.name}</b><small>{money(price, currency)}</small></div><div className="of-stepper"><button onClick={() => setQuantity(product.id, quantity - 1)} aria-label="تقليل الكمية">−</button><span>{digits(quantity)}</span><button onClick={() => setQuantity(product.id, quantity + 1)} aria-label="زيادة الكمية" disabled={quantity >= product.quantity}>+</button></div><b className="of-line-total">{money(quantity * price, currency)}</b></div>) : <div className="of-cart-empty"><ShoppingCart size={22} /><span>السلة فارغة</span><small>اختر منتجًا من القائمة للبدء</small></div>}</div>
        <div className="of-cart-fields">
          <Field label="اسم العميل · اختياري"><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="عميل نقدي" maxLength={150} /></Field>
          <Field label="رقم هاتف العميل · اختياري"><input type="tel" dir="ltr" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+20 10 1234 5678" maxLength={40} /></Field>
        </div>
        <div className="of-discount-row"><span>الخصم</span><label><input aria-label="قيمة الخصم" type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} disabled={!cartLines.length} /><b>{currency}</b></label></div>
        <label className="of-payment-label">طريقة الدفع</label><div className="of-payment-options">{([{ id: "cash", title: "نقدي", icon: Wallet }, { id: "card", title: "بطاقة", icon: CreditCard }, { id: "wallet", title: "محفظة", icon: Smartphone }, { id: "instapay", title: "إنستا باي", icon: ArrowUpRight }, { id: "transfer", title: "تحويل", icon: ArrowUpRight }] as const).map(({ id, title, icon: Icon }) => <button key={id} className={payment === id ? "chosen" : ""} onClick={() => setPayment(id)}><Icon size={15} />{title}</button>)}</div>
        {payment === "cash" && <Field label="المبلغ النقدي المستلم · إلزامي"><input type="number" min={total} step="0.01" value={received} onChange={(event) => setReceived(event.target.value)} placeholder={String(total)} /></Field>}
        {(payment === "wallet" || payment === "instapay" || payment === "transfer") && <Field label="رقم أو حساب المرسل · إلزامي"><input dir="ltr" maxLength={80} value={transferSender} onChange={(event) => setTransferSender(event.target.value)} placeholder={payment === "instapay" ? "رقم الهاتف أو عنوان InstaPay" : payment === "transfer" ? "رقم الحساب أو مرجع التحويل" : "رقم المحفظة المحوِّل منها"} /></Field>}
        <div className="of-totals"><div><span>المجموع الفرعي</span><b>{money(subtotal, currency)}</b></div><div><span>الخصم</span><b>− {money(discountAmount, currency)}</b></div><div><span>ضريبة القيمة المضافة · {digits(state.store?.vatRate ?? 0)}%</span><b>{money(tax, currency)}</b></div><div className="of-grand-total"><span>الإجمالي</span><b>{money(total, currency)}</b></div></div>
          {payment === "cash" && received.trim() && Number.isFinite(cashAmount) && <div className={`of-cash-change ${cashAmount >= total ? "" : "short"}`}><span>{cashAmount >= total ? "الباقي للعميل" : "المتبقي"}</span><b>{money(Math.abs(cashAmount - total), currency)}</b></div>}
        {!licenseActive && <div className="of-error"><CircleAlert size={15} />الترخيص غير مفعّل أو انتهت مدته؛ لا يمكن تسجيل مبيعات جديدة.</div>}
        {transferSenderInvalid && <div className="of-error"><CircleAlert size={15} />اكتب رقم أو حساب المرسل لاستكمال بيانات التحويل.</div>}
        {cashAmountInvalid && received.trim() && <div className="of-error"><CircleAlert size={15} />يجب أن يغطي المبلغ النقدي إجمالي الفاتورة.</div>}
        {error && <div className="of-error"><CircleAlert size={15} />{error}</div>}
        <div className="of-cart-actions"><button className="of-button of-button-secondary" disabled={!cartLines.length || busy || transferSenderInvalid} onClick={() => void parkSale()}><Pause size={15} /> تعليق</button><button className="of-button of-button-primary of-checkout" disabled={!cartLines.length || busy || !licenseActive || cashAmountInvalid || transferSenderInvalid} onClick={() => void checkout()}><Receipt size={16} />{busy ? "جارٍ الحفظ..." : "إتمام البيع"}</button></div>
      </aside>
    </div>
    {heldOpen && <div className="of-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setHeldOpen(false); }}><section className="of-dialog of-held-dialog" role="dialog" aria-modal="true" aria-labelledby="held-title">
      <header className="of-dialog-head"><div><span className="of-kicker">نقطة البيع</span><h2 id="held-title">الفواتير المعلقة</h2></div><button onClick={() => setHeldOpen(false)} aria-label="إغلاق"><X size={18} /></button></header>
      {cartLines.length > 0 && <div className="of-inline-hint">أفرغ الطلب الحالي قبل استعادة فاتورة معلقة حتى لا تفقد بياناته.</div>}
      {state.heldSales.length ? <div className="of-held-list">{state.heldSales.map((held) => <article className="of-held-item" key={held.id}><div><b dir="ltr">{held.reference}</b><small>{held.customerName || "عميل نقدي"} · {digits(held.items.reduce((sum, item) => sum + item.quantity, 0))} وحدة · {held.saleType === "retail" ? "قطاعي" : "جملة"}</small><time>{dateTime(held.createdAt)}</time></div><strong>{money(held.estimatedTotal, currency)}</strong><button className="of-button of-button-primary" disabled={busy || cartLines.length > 0} onClick={() => void restoreHeld(held)}><Play size={14} /> استعادة</button></article>)}</div> : <EmptyState icon={Pause} title="لا توجد فواتير معلقة" copy="يمكنك تعليق طلب من شاشة البيع واستعادته لاحقًا." />}
      {error && <div className="of-error"><CircleAlert size={15} />{error}</div>}
    </section></div>}
  </section>;
}

function SalesPage({ state, currency, showAmounts, onSelect }: { state: OfflineState; currency: string; showAmounts: boolean; onSelect: (sale: OfflineSale) => void }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const filtered = useMemo(() => state.sales.filter((sale) => {
    const matches = `${sale.invoiceNumber} ${sale.customerName} ${sale.customerPhone} ${sale.transferSender}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const dayAge = (Date.now() - new Date(sale.createdAt).getTime()) / 86400000;
    const saleDate = new Date(sale.createdAt);
    const localDay = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}-${String(saleDate.getDate()).padStart(2, "0")}`;
    return matches && (period === "all" || (period === "today" && localDay === localDate()) || (period === "week" && dayAge <= 7));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.sales, query, period]);
  const sum = filtered.reduce((n, sale) => n + sale.total, 0);
  return <section className="of-page"><PageHeading kicker="سجل المعاملات" title="المبيعات والفواتير" description="راجع عمليات البيع السابقة وتفاصيل كل فاتورة." />
    {showAmounts && <div className="of-sales-summary"><span className="of-summary-icon"><Receipt size={19} /></span><div><small>إجمالي المبيعات المعروضة</small><b>{money(sum, currency)}</b></div><i /><div><small>عدد الفواتير</small><b>{digits(filtered.length)}</b></div></div>}
    <div className="of-toolbar"><label className="of-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث برقم الفاتورة أو العميل أو الهاتف..." /></label><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">كل الفترات</option><option value="today">اليوم</option><option value="week">آخر 7 أيام</option></select></div>
    <section className="of-panel of-sales-table">{filtered.length ? <div className="of-table-scroll"><table className="of-table"><thead><tr><th>الفاتورة</th><th>العميل</th><th>التاريخ والوقت</th><th>طريقة الدفع</th><th>نوع البيع</th>{showAmounts && <th>الإجمالي</th>}<th /></tr></thead><tbody>{filtered.map((sale) => <tr key={sale.id} onClick={() => onSelect(sale)}><td><b className="of-invoice-number">{sale.invoiceNumber}</b></td><td>{sale.customerName || "عميل نقدي"}{sale.customerPhone && <small className="of-sales-phone" dir="ltr">{sale.customerPhone}</small>}</td><td>{dateTime(sale.createdAt)}</td><td>{sale.paymentMethod === "cash" ? "نقدي" : sale.paymentMethod === "card" ? "بطاقة" : sale.paymentMethod === "wallet" ? "محفظة" : sale.paymentMethod === "instapay" ? "إنستا باي" : "تحويل"}</td><td>{sale.saleType === "retail" ? "قطاعي" : "جملة"}</td>{showAmounts && <td className="of-number"><b>{money(sale.total, currency)}</b></td>}<td><ArrowUpRight size={15} /></td></tr>)}</tbody></table></div> : <EmptyState icon={FileText} title={query ? "لا توجد فواتير مطابقة" : "لا توجد فواتير بعد"} copy={query ? "غيّر كلمات البحث أو الفترة المحددة." : "ستظهر فواتيرك بعد تسجيل عمليات البيع."} />}</section>
  </section>;
}

function InvoiceDialog({ sale, store, currency, onClose }: { sale: OfflineSale; store: OfflineState["store"]; currency: string; onClose: () => void }) {
  const format = store?.invoiceFormat ?? "wide";
  const paymentLabel = sale.paymentMethod === "cash" ? "نقدي"
    : sale.paymentMethod === "card" ? "بطاقة"
      : sale.paymentMethod === "wallet" ? "محفظة"
        : sale.paymentMethod === "instapay" ? "إنستا باي"
          : "تحويل";
  function exportText() {
    const rows = [
      store?.name ?? "X-Store",
      store?.businessType ?? "",
      `رقم الفاتورة: ${sale.invoiceNumber}`,
      `التاريخ: ${dateTime(sale.createdAt)}`,
      `العميل: ${sale.customerName || "عميل نقدي"}`,
      sale.customerPhone ? `الهاتف: ${sale.customerPhone}` : "",
      `نوع البيع: ${sale.saleType === "wholesale" ? "جملة" : "قطاعي"}`,
      `طريقة الدفع: ${paymentLabel}`,
      sale.transferSender ? `بيانات التحويل: ${sale.transferSender}` : "",
      sale.exchangeOfInvoiceNumber ? `استبدال عن الفاتورة: ${sale.exchangeOfInvoiceNumber}` : "",
      "----------------------------------------",
      "الصنف | الكمية | سعر الوحدة | الإجمالي",
      ...sale.items.map((item) => `${item.name} | ${digits(item.quantity)} | ${money(item.unitPrice, currency)} | ${money(item.lineTotal, currency)}`),
      "----------------------------------------",
      `المجموع الفرعي: ${money(sale.subtotal, currency)}`,
      `الخصم: ${money(sale.discountAmount, currency)}`,
      `ضريبة القيمة المضافة: ${money(sale.taxAmount, currency)}`,
      `الإجمالي المستحق: ${money(sale.total, currency)}`,
      `المبلغ المستلم: ${money(sale.amountReceived, currency)}`,
      `الباقي: ${money(sale.changeAmount, currency)}`,
      "شكرًا لزيارتكم",
    ].filter(Boolean);
    const blob = new Blob(["\uFEFF", rows.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sale.invoiceNumber}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="of-overlay of-invoice-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`of-dialog of-invoice-dialog of-invoice-${format}`} role="dialog" aria-modal="true" aria-labelledby="invoice-title"><header className="of-dialog-head of-invoice-actions"><div><span className="of-kicker">تفاصيل المعاملة</span><h2 id="invoice-title">{sale.invoiceNumber}</h2></div><div><button className="of-button of-button-secondary" onClick={exportText}><ArrowDownToLine size={15} /> تصدير TXT</button><button className="of-button of-button-secondary" onClick={() => window.print()}><Printer size={15} /> طباعة الفاتورة</button><button className="of-icon-button" onClick={onClose} aria-label="إغلاق"><X size={18} /></button></div></header><div className="of-inline-hint of-invoice-offline-note">إرسال الفاتورة عبر واتساب غير متاح في النسخة التي تعمل دون إنترنت؛ استخدم الطباعة أو تصدير TXT.</div><article className="of-print-invoice">
    <div className="of-invoice-brand"><BrandMark compact /><div><b>{store?.name}</b><small>{store?.businessType}</small></div></div>
    <div className="of-invoice-meta"><div><span>رقم الفاتورة</span><b dir="ltr">{sale.invoiceNumber}</b></div><div><span>التاريخ</span><b>{dateTime(sale.createdAt)}</b></div><div><span>العميل</span><b>{sale.customerName || "عميل نقدي"}</b></div>{sale.customerPhone && <div><span>الهاتف</span><b dir="ltr">{sale.customerPhone}</b></div>}<div><span>نوع البيع</span><b>{sale.saleType === "wholesale" ? "جملة" : "قطاعي"}</b></div><div><span>طريقة الدفع</span><b>{paymentLabel}</b></div>{sale.transferSender && <div><span>بيانات التحويل</span><b dir="ltr">{sale.transferSender}</b></div>}{sale.exchangeOfInvoiceNumber && <div><span>استبدال عن</span><b dir="ltr">{sale.exchangeOfInvoiceNumber}</b></div>}</div>
    <div className="of-table-scroll"><table className="of-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>{sale.items.map((item, index) => <tr key={`${item.productId}-${index}`}><td><b>{item.name}</b>{item.sku && <small>{item.sku}</small>}</td><td>{digits(item.quantity)}</td><td className="of-number">{money(item.unitPrice, currency)}</td><td className="of-number">{money(item.lineTotal, currency)}</td></tr>)}</tbody></table></div>
    <div className="of-invoice-totals"><div><span>المجموع الفرعي</span><b>{money(sale.subtotal, currency)}</b></div><div><span>الخصم</span><b>− {money(sale.discountAmount, currency)}</b></div><div><span>ضريبة القيمة المضافة</span><b>{money(sale.taxAmount, currency)}</b></div><div className="of-invoice-final"><span>الإجمالي المستحق</span><b>{money(sale.total, currency)}</b></div><div><span>المبلغ المستلم</span><b>{money(sale.amountReceived, currency)}</b></div><div><span>الباقي</span><b>{money(sale.changeAmount, currency)}</b></div></div>
    <div className="of-invoice-thanks">شكرًا لزيارتكم</div></article></section></div>;
}

function BackupPage({ state, desktop, onChooseFolder, onBackup, onRestore }: { state: OfflineState; desktop: boolean; onChooseFolder: () => void; onBackup: () => void; onRestore: () => void }) {
  return <section className="of-page"><PageHeading kicker="حماية بياناتك" title="النسخ الاحتياطي والاستعادة" description="احتفظ بنسخة من بيانات المتجر لاستعادتها عند الحاجة." />
    {!desktop && <div className="of-preview-banner"><CircleAlert size={18} /><div><b>أنت في معاينة المتصفح</b><span>اختيار مجلد ويندوز والنسخ إلى ملف متاحان فقط في إصدار Windows. هنا تُحفظ نسخة معاينة داخل تخزين المتصفح المحلي.</span></div></div>}
    <div className="of-backup-layout"><section className="of-panel of-backup-card"><span className="of-backup-symbol green"><Archive size={21} /></span><span className="of-kicker">نسخة احتياطية</span><h2>احفظ نسخة الآن</h2><p>{desktop ? "أنشئ ملفًا احتياطيًا محليًا في مجلد النسخ المحدد." : "احفظ نسخة محلية للمعاينة. هذه العملية لا تنشئ ملفًا على جهازك."}</p><button className="of-button of-button-primary" onClick={onBackup}><ArrowDownToLine size={16} /> إنشاء نسخة احتياطية الآن</button><div className="of-backup-time"><Clock3 size={14} /><span>آخر نسخة يدوية</span><b>{state.backup.lastManualBackupAt ? dateTime(state.backup.lastManualBackupAt) : "لم يتم إنشاء نسخة بعد"}</b></div></section>
      <section className="of-panel of-backup-card"><span className="of-backup-symbol blue"><FolderOpen size={21} /></span><span className="of-kicker">مكان الحفظ</span><h2>مجلد النسخ</h2><p>{state.backup.backupFolder ?? (desktop ? "لم يتم اختيار مجلد بعد." : "نسخة معاينة داخل المتصفح — لا تمثل مجلد ويندوز.")}</p><button className="of-button of-button-secondary" onClick={onChooseFolder}><FolderOpen size={16} /> اختيار مجلد النسخ</button><div className="of-backup-time"><Clock3 size={14} /><span>آخر حفظ تلقائي</span><b>{state.backup.lastAutomaticBackupAt ? dateTime(state.backup.lastAutomaticBackupAt) : "لا يوجد سجل بعد"}</b></div></section></div>
    <section className="of-panel of-restore-panel"><div className="of-restore-icon"><Upload size={20} /></div><div className="of-restore-copy"><h2>استعادة بيانات من ملف</h2><p>استورد ملف JSON احتياطيًا. سيتم التحقق من توافقه، وستحتاج إلى تأكيد استبدال بيانات المتجر الحالية.</p><div className="of-restore-note"><ShieldCheck size={14} /> لن يتم استبدال البيانات قبل موافقتك.</div></div><button className="of-button of-button-secondary" onClick={onRestore}><Upload size={16} /> اختيار ملف JSON</button></section>
  </section>;
}

function SettingsPage({ state, onSave, onActivate }: {
  state: OfflineState;
  onSave: (store: OfflineState["store"]) => Promise<void>;
  onActivate: (license: OfflineLicense) => Promise<void>;
}) {
  const [name, setName] = useState(state.store?.name ?? "");
  const [businessType, setBusinessType] = useState(state.store?.businessType ?? "");
  const [storeType, setStoreType] = useState(state.store?.storeType ?? "clothing_shoes");
  const [currency, setCurrency] = useState(state.store?.currency ?? "EGP");
  const [vatRate, setVatRate] = useState(String(state.store?.vatRate ?? 0));
  const [wholesaleEnabled, setWholesaleEnabled] = useState(state.store?.wholesaleEnabled ?? false);
  const [invoiceFormat, setInvoiceFormat] = useState<NonNullable<OfflineState["store"]>["invoiceFormat"]>(state.store?.invoiceFormat ?? "wide");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activationError, setActivationError] = useState("");
  const [activationNotice, setActivationNotice] = useState("");
  const [activationBusy, setActivationBusy] = useState(false);
  const active = isLicenseActive(state.license);
  const supports = OFFLINE_STORE_TYPES.find((item) => item.value === storeType)?.supportsWholesale ?? false;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !businessType.trim()) { setError("اسم المتجر والنشاط مطلوبان."); return; }
    setSaving(true); setError("");
    try { await onSave({ name: name.trim(), businessType: businessType.trim(), storeType, currency, vatRate: Number(vatRate) || 0, wholesaleEnabled: supports && wholesaleEnabled, invoiceFormat }); }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ الإعدادات."); } finally { setSaving(false); }
  }
  async function exportActivationRequest() {
    setActivationError("");
    try {
      const installationId = await getOfflineInstallationId();
      downloadOfflineActivationRequest(
        createOfflineActivationRequest(installationId, state.store?.name ?? ""),
      );
      setActivationNotice("تم تنزيل طلب التفعيل. أرسله لإدارة X-Store لاستلام ملف التفعيل.");
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "تعذر إنشاء طلب التفعيل.");
    }
  }
  async function importActivationFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setActivationBusy(true);
    setActivationError("");
    setActivationNotice("");
    try {
      const installationId = await getOfflineInstallationId();
      const license = await readAndVerifyOfflineLicense(file, installationId);
      await onActivate(license);
      setActivationNotice("تم التحقق من ملف التفعيل وحفظه على هذا الجهاز.");
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "تعذر استيراد ملف التفعيل.");
    } finally {
      setActivationBusy(false);
      input.value = "";
    }
  }
  const licensePlanNames = {
    monthly: "شهري",
    half_yearly: "نصف سنوي",
    annual: "سنوي",
    lifetime: "مدى الحياة",
  } as const;
  return <section className="of-page"><PageHeading kicker="إدارة الحساب المحلي" title="الإعدادات والترخيص" description="تعديل بيانات النشاط ومراجعة حالة الترخيص على هذا الجهاز." />
    <div className="of-settings-grid"><section className="of-panel of-settings-panel"><div className="of-panel-head"><div><h2>بيانات المتجر</h2><p>تُستخدم هذه البيانات في لوحة العمل والفواتير.</p></div><span className="of-settings-head-icon"><Store size={18} /></span></div><form onSubmit={submit}><div className="of-form-grid"><Field label="اسم المتجر"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="النشاط التجاري"><input required value={businessType} onChange={(e) => setBusinessType(e.target.value)} /></Field><Field label="نوع المتجر"><select value={storeType} onChange={(e) => { setStoreType(e.target.value as typeof storeType); setWholesaleEnabled(false); }}>{OFFLINE_STORE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="العملة"><select value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>{OFFLINE_CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}</select></Field><Field label="ضريبة القيمة المضافة (%)"><input type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} /></Field></div>
      {supports && <label className="of-toggle-row"><span><b>البيع بالجملة</b><small>إظهار سعر الجملة أثناء إتمام البيع.</small></span><input type="checkbox" checked={wholesaleEnabled} onChange={(e) => setWholesaleEnabled(e.target.checked)} /><i /></label>}
      <fieldset className="of-invoice-format-picker"><legend>تنسيق الفاتورة</legend><p>يُطبق على الطباعة ويمكن تغييره لاحقًا دون تعديل الفواتير المحفوظة.</p><div>{([
        { value: "wide", title: "عريضة", detail: "ورقة مكتبية", icon: FileText },
        { value: "thermal_80mm", title: "حراري 80 مم", detail: "طابعة نقاط بيع", icon: Receipt },
        { value: "thermal_58mm", title: "حراري 58 مم", detail: "طابعة صغيرة", icon: Printer },
      ] as const).map(({ value, title, detail, icon: Icon }) => <button key={value} type="button" className={invoiceFormat === value ? "chosen" : ""} onClick={() => setInvoiceFormat(value)}><Icon size={18} /><b>{title}</b><small>{detail}</small></button>)}</div></fieldset>
      {error && <div className="of-error"><CircleAlert size={15} />{error}</div>}<div className="of-settings-save"><button className="of-button of-button-primary" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button></div>
    </form></section>
      <aside className="of-panel of-license-panel"><span className={`of-license-large-icon ${state.license && !active ? "expired" : ""}`}><ShieldCheck size={22} /></span><span className="of-kicker">حالة الترخيص</span><h2>{active ? "ترخيصك نشط" : state.license ? "الترخيص منتهٍ" : "بانتظار ملف التفعيل"}</h2><p>يُصدر الترخيص لإعداد هذا الجهاز فقط، ويُتحقق منه محليًا دون اتصال بالإنترنت.</p><div className="of-license-details"><div><span>اسم المتجر</span><b>{state.store?.name ?? "—"}</b></div><div><span>الخطة</span><b>{state.license ? licensePlanNames[state.license.payload.plan] : "غير مفعّل"}</b></div><div><span>تاريخ الإصدار</span><b>{state.license?.payload.issuedAt.slice(0, 10) ?? "—"}</b></div><div><span>تاريخ الانتهاء</span><b>{state.license ? state.license.payload.expiresAt ?? "دائم" : "—"}</b></div></div><div className="of-license-actions"><button type="button" className="of-button of-button-secondary" onClick={() => void exportActivationRequest()}><ArrowDownToLine size={15} /> تنزيل طلب التفعيل</button><Field label="استيراد ملف التفعيل"><input type="file" accept=".json,application/json" onChange={(event) => void importActivationFile(event)} disabled={activationBusy} /></Field></div>{activationError && <div className="of-error"><CircleAlert size={15} />{activationError}</div>}{activationNotice && <div className="of-inline-hint">{activationNotice}</div>}<div className="of-license-caption"><LockKeyhole size={14} /> بعد انتهاء الترخيص يتوقف البيع، وتبقى بيانات المتجر والنسخ الاحتياطي متاحة.</div></aside></div>
    <div className="of-settings-device"><span><LifeBuoy size={17} /></span><div><b>البيانات لا تغادر جهازك</b><small>يعمل X-Store Offline دون حساب أو مزامنة سحابية. احفظ نسخة احتياطية بانتظام.</small></div></div>
  </section>;
}
