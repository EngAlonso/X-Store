import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, Banknote, CalendarDays, CircleAlert,
  FileClock, FileText, LockKeyhole, Plus, RotateCcw, Search, ShieldCheck,
  Trash2, Users, Wallet,
} from "lucide-react";
import { calculateSaleItemReturn } from "./model";
import { createLocalPinCredential, isValidLocalPin } from "./auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type {
  OfflineAuditLog, OfflinePaymentMethod, OfflineReturn, OfflineSale,
  OfflineState, OfflineTeamMember, OfflineTeamPermission, OfflineTeamRole,
} from "./model";
import "./offline-operations.css";

type ReturnRequest = { saleId: string; items: { productId: string; quantity: number }[]; reason: string };
type ExchangeRequest = ReturnRequest & {
  replacementProductId: string;
  replacementQuantity: number;
  paymentMethod: OfflinePaymentMethod;
  amountReceived: number;
};

const permissionOptions: { id: OfflineTeamPermission; title: string; detail: string }[] = [
  { id: "retail_sales", title: "مبيعات التجزئة", detail: "إنشاء فواتير البيع بالتجزئة" },
  { id: "wholesale_sales", title: "مبيعات الجملة", detail: "إتمام عمليات البيع بالجملة" },
  { id: "warehouse_manager", title: "إدارة المخزون", detail: "تعديل المنتجات والكميات" },
  { id: "accountant", title: "التقارير والحسابات", detail: "عرض الملخصات المالية" },
];
const roleOptions: { value: OfflineTeamRole; label: string; permissions: OfflineTeamPermission[] }[] = [
  { value: "tenant_admin", label: "مالك المتجر", permissions: permissionOptions.map((p) => p.id) },
  { value: "cashier", label: "أمين الصندوق", permissions: ["retail_sales", "wholesale_sales"] },
  { value: "warehouse_manager", label: "مدير المخزون", permissions: ["warehouse_manager"] },
  { value: "accountant", label: "محاسب", permissions: ["accountant"] },
  { value: "custom", label: "دور مخصص", permissions: [] },
];
const paymentOptions: { value: OfflinePaymentMethod; label: string }[] = [
  { value: "cash", label: "نقدًا" }, { value: "card", label: "بطاقة" },
  { value: "wallet", label: "محفظة" }, { value: "instapay", label: "إنستا باي" },
  { value: "transfer", label: "تحويل" },
];
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const latin = (value: number | string) =>
  String(value).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const amount = (value: number, currency: string) =>
  `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "تاريخ غير معروف" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function Heading({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: typeof Users }) {
  return <header className="op-heading"><span className="op-heading-mark"><Icon size={20} /></span><div><span className="op-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></header>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="op-empty"><span><FileText size={21} /></span><b>{title}</b><p>{detail}</p></div>;
}
function ErrorNotice({ children }: { children: string }) {
  return children ? <div className="op-error" role="alert" data-testid="status-operation-error"><CircleAlert size={16} />{children}</div> : null;
}
function Stat({ label, value, caption, icon: Icon, tone = "green" }: { label: string; value: string; caption: string; icon: typeof Wallet; tone?: string }) {
  return <article className={`op-stat op-${tone}`} data-testid={`stat-${label}`}><span className="op-stat-icon"><Icon size={18} /></span><small>{label}</small><b>{value}</b><span>{caption}</span></article>;
}
function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return <div className="op-panel-title"><div><h2>{title}</h2><p>{detail}</p></div></div>;
}

type MemberValues = {
  name: string; phone: string; email: string; role: OfflineTeamRole;
  roleName: string; permissions: OfflineTeamPermission[]; active: boolean; pin: string; confirmPin: string;
};

export function OfflineTeamPage({ state, onSave, onRemove }: {
  state: OfflineState;
  onSave: (member: OfflineTeamMember, editingId?: string) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState<OfflineTeamMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const form = useForm<MemberValues>({
    defaultValues: { name: "", phone: "", email: "", role: "cashier", roleName: "", permissions: ["retail_sales", "wholesale_sales"], active: true, pin: "", confirmPin: "" },
  });
  const members = state.teamMembers.filter((member) =>
    `${member.name} ${member.phone} ${member.email} ${member.roleName} ${member.permissions.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const openNew = () => {
    setEditing(null); setCreating(true); setError("");
    form.reset({ name: "", phone: "", email: "", role: "cashier", roleName: "", permissions: ["retail_sales", "wholesale_sales"], active: true, pin: "", confirmPin: "" });
  };
  const openEdit = (member: OfflineTeamMember) => {
    setEditing(member); setCreating(true); setError("");
    form.reset({ name: member.name, phone: member.phone, email: member.email, role: member.role, roleName: member.roleName, permissions: [...member.permissions], active: member.active, pin: "", confirmPin: "" });
  };
  const closeForm = () => { setCreating(false); setEditing(null); setError(""); };
  const submit = form.handleSubmit(async (values) => {
    if (!values.permissions.length) { setError("اختر صلاحية واحدة على الأقل لهذا العضو."); return; }
    if (values.role === "custom" && !values.roleName.trim()) { setError("اكتب اسمًا واضحًا للدور المخصص."); return; }
    if ((!editing || !editing.pinHash) && !values.pin) { setError("أنشئ رمز دخول للعضو قبل حفظه."); return; }
    if (values.pin && !isValidLocalPin(values.pin)) { setError("رمز الدخول يجب أن يتكون من 6 إلى 12 رقمًا."); return; }
    if (values.pin !== values.confirmPin) { setError("تأكيد رمز الدخول غير مطابق."); return; }
    setSaving(true); setError("");
    let credential = {
      pinSalt: editing?.pinSalt ?? null,
      pinHash: editing?.pinHash ?? null,
      pinIterations: editing?.pinIterations ?? null,
    };
    if (values.pin) {
      try { credential = await createLocalPinCredential(values.pin); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إعداد رمز الدخول."); setSaving(false); return; }
    }
    const member: OfflineTeamMember = {
      id: editing?.id ?? id(), name: values.name.trim(), phone: values.phone.trim(),
      email: values.email.trim(), role: values.role,
      roleName: values.role === "custom" ? values.roleName.trim() : roleOptions.find((role) => role.value === values.role)?.label ?? values.roleName,
      permissions: values.permissions, active: values.active, ...credential,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    try { await onSave(member, editing?.id); closeForm(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ بيانات العضو."); }
    finally { setSaving(false); }
  });
  const remove = async (member: OfflineTeamMember) => {
    if (!window.confirm(`هل تريد إزالة ${member.name} من فريق المتجر؟`)) return;
    setError("");
    try { await onRemove(member.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إزالة العضو."); }
  };
  const permissionChange = (permission: OfflineTeamPermission, checked: boolean) => {
    const current = form.getValues("permissions");
    form.setValue("permissions", checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission), { shouldDirty: true, shouldValidate: true });
  };

  return <section className="op-page" dir="rtl" data-testid="page-offline-team">
    <Heading eyebrow="إدارة الوصول المحلي" title="فريق المتجر" description="أضف أفراد الفريق وحدد ما يمكن لكل شخص تنفيذه على هذا الجهاز." icon={Users} />
    <div className="op-team-summary"><span className="op-summary-icon"><LockKeyhole size={18} /></span><div><b>دخول وصلاحيات محلية</b><small>رمز مستقل لكل عضو؛ لا يوجد حساب سحابي أو مزامنة.</small></div><strong data-testid="text-team-count">{latin(state.teamMembers.length)} عضو</strong></div>
    <ErrorNotice>{error}</ErrorNotice>
    <section className="op-panel">
      <div className="op-panel-toolbar"><PanelTitle title="أعضاء الفريق" detail="الأدوار والصلاحيات الممنوحة لهذا المتجر" /><button type="button" className="op-button op-primary" onClick={openNew} data-testid="button-add-team-member"><Plus size={16} /> إضافة عضو</button></div>
      <div className="op-search-row"><label className="op-search"><Search size={16} /><span className="op-sr-only">البحث عن عضو</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو الدور" data-testid="input-search-team" /></label><span className="op-muted" data-testid="text-team-results">{latin(members.length)} نتيجة</span></div>
      {members.length ? <div className="op-table-wrap"><table className="op-table"><thead><tr><th>العضو</th><th>الدور</th><th>الصلاحيات</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{members.map((member) => <tr key={member.id} data-testid={`row-team-member-${member.id}`}>
         <td><b>{member.name}</b><small dir="ltr">{member.phone || member.email || "لا توجد بيانات اتصال"}</small><small className="op-login-status">{member.pinHash ? "تسجيل الدخول مفعّل" : "يحتاج رمز دخول"}</small></td>
        <td><span className="op-role">{member.roleName}</span></td>
        <td><div className="op-tags">{member.permissions.map((permission) => <span key={permission}>{permissionOptions.find((item) => item.id === permission)?.title ?? permission}</span>)}</div></td>
        <td><span className={`op-status ${member.active ? "is-active" : "is-paused"}`}>{member.active ? "نشط" : "موقوف"}</span></td>
        <td><div className="op-actions"><button type="button" className="op-link" onClick={() => openEdit(member)} data-testid={`button-edit-team-${member.id}`}>تعديل</button><button type="button" className="op-icon-button danger" aria-label={`إزالة ${member.name}`} onClick={() => void remove(member)} data-testid={`button-remove-team-${member.id}`}><Trash2 size={15} /></button></div></td>
      </tr>)}</tbody></table></div> : <Empty title={query ? "لا توجد نتائج مطابقة" : "لا يوجد أعضاء بعد"} detail={query ? "تحقق من عبارة البحث أو جرّب اسمًا آخر." : "أضف أول عضو وحدد صلاحياته للعمل على المتجر."} />}
    </section>
    {creating && <div className="op-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}><section className="op-dialog" role="dialog" aria-modal="true" aria-labelledby="team-form-title">
      <header className="op-dialog-head"><div><span className="op-eyebrow">الوصول إلى المتجر</span><h2 id="team-form-title">{editing ? "تعديل بيانات العضو" : "إضافة عضو للفريق"}</h2></div><button type="button" className="op-icon-button" aria-label="إغلاق النموذج" onClick={closeForm} data-testid="button-close-team-form">×</button></header>
      <Form {...form}><form onSubmit={submit} noValidate>
        <div className="op-form-grid">
          <FormField control={form.control} name="name" rules={{ required: "اسم العضو مطلوب.", minLength: { value: 2, message: "اكتب اسمًا مكوّنًا من حرفين على الأقل." } }} render={({ field }) => <FormItem className="op-field"><FormLabel>اسم العضو</FormLabel><FormControl><input {...field} autoFocus placeholder="الاسم كما سيظهر في السجلات" data-testid="input-team-name" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="phone" render={({ field }) => <FormItem className="op-field"><FormLabel>رقم الهاتف</FormLabel><FormControl><input {...field} dir="ltr" inputMode="tel" placeholder="اختياري" data-testid="input-team-phone" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="email" rules={{ validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "تحقق من صيغة البريد الإلكتروني." }} render={({ field }) => <FormItem className="op-field"><FormLabel>البريد الإلكتروني</FormLabel><FormControl><input {...field} dir="ltr" type="email" placeholder="اختياري" data-testid="input-team-email" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="role" render={({ field }) => <FormItem className="op-field"><FormLabel>الدور</FormLabel><FormControl><select {...field} onChange={(event) => { const role = event.target.value as OfflineTeamRole; field.onChange(role); const defaults = roleOptions.find((item) => item.value === role)?.permissions ?? []; form.setValue("permissions", [...defaults], { shouldDirty: true }); if (role !== "custom") form.setValue("roleName", roleOptions.find((item) => item.value === role)?.label ?? ""); }} data-testid="select-team-role">{roleOptions.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}</select></FormControl><FormMessage /></FormItem>} />
          {form.watch("role") === "custom" && <FormField control={form.control} name="roleName" render={({ field }) => <FormItem className="op-field"><FormLabel>اسم الدور المخصص</FormLabel><FormControl><input {...field} placeholder="مثال: مشرف صالة" data-testid="input-team-role-name" /></FormControl><FormMessage /></FormItem>} />}
        </div>
        <div className="op-form-grid op-pin-grid">
          <FormField control={form.control} name="pin" render={({ field }) => <FormItem className="op-field"><FormLabel>{editing?.pinHash ? "تغيير رمز الدخول · اختياري" : "رمز الدخول · مطلوب"}</FormLabel><FormControl><input {...field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="6 إلى 12 رقمًا" data-testid="input-team-pin" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="confirmPin" render={({ field }) => <FormItem className="op-field"><FormLabel>تأكيد رمز الدخول</FormLabel><FormControl><input {...field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder={editing?.pinHash ? "عند تغيير الرمز" : "أعد كتابة الرمز"} data-testid="input-team-pin-confirm" /></FormControl><FormMessage /></FormItem>} />
        </div>
        <p className="op-pin-note">تغيير الرمز يُبطل الرمز السابق. لا تحفظ نسخة من الرمز نفسه في النظام.</p>
        <fieldset className="op-permissions"><legend>الصلاحيات الممنوحة</legend><p>اختر صراحةً المهام التي يستطيع العضو تنفيذها.</p><div className="op-permission-grid">{permissionOptions.map((permission) => <label className="op-permission" key={permission.id}><input type="checkbox" checked={form.watch("permissions").includes(permission.id)} onChange={(event) => permissionChange(permission.id, event.target.checked)} data-testid={`checkbox-permission-${permission.id}`} /><span><b>{permission.title}</b><small>{permission.detail}</small></span></label>)}</div></fieldset>
        <FormField control={form.control} name="active" render={({ field }) => <FormItem className="op-toggle"><FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} data-testid="checkbox-team-active" /></FormControl><FormLabel>السماح للعضو بالعمل حاليًا</FormLabel></FormItem>} />
        <ErrorNotice>{error}</ErrorNotice>
        <div className="op-dialog-actions"><button type="button" className="op-button op-secondary" onClick={closeForm} data-testid="button-cancel-team">إلغاء</button><button type="submit" className="op-button op-primary" disabled={saving} data-testid="button-save-team">{saving ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "إضافة العضو"}</button></div>
      </form></Form>
    </section></div>}
  </section>;
}

type ReturnValues = { saleId: string; reason: string };
type ExchangeValues = ReturnValues & { replacementProductId: string; replacementQuantity: number; paymentMethod: OfflinePaymentMethod; amountReceived: number };

function returnableQty(sale: OfflineSale, productId: string, state: OfflineState) {
  const line = sale.items.find((item) => item.productId === productId);
  if (!line) return 0;
  const alreadyReturned = state.returns.filter((record) => record.saleId === sale.id)
    .flatMap((record) => record.items).filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
  return Math.max(0, line.quantity - Math.max(line.returnedQuantity, alreadyReturned));
}

export function OfflineReturnsPage({ state, currency, onReturn, onExchange }: {
  state: OfflineState; currency: string;
  onReturn: (input: ReturnRequest) => void | Promise<void>;
  onExchange: (input: ExchangeRequest) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"return" | "exchange">("return");
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const exchangeForm = useForm<ExchangeValues>({ defaultValues: { saleId: "", reason: "", replacementProductId: "", replacementQuantity: 1, paymentMethod: "cash", amountReceived: 0 } });
  const activeForm = exchangeForm;
  const sale = state.sales.find((item) => item.id === activeForm.watch("saleId"));
  const returnLines = useMemo(() => sale?.items.map((line) => ({ ...line, remaining: returnableQty(sale, line.productId, state) })).filter((line) => line.remaining > 0) ?? [], [sale, state]);
  const selectedItems = returnLines.map((line) => ({ productId: line.productId, quantity: Math.min(line.remaining, Math.max(0, Math.floor(selectedQuantities[line.productId] ?? 0))) })).filter((item) => item.quantity > 0);
  const replacement = state.products.find((product) => product.id === exchangeForm.watch("replacementProductId"));
  const replacementPrice = replacement
    ? (sale?.saleType === "wholesale" ? replacement.wholesalePrice : replacement.price)
    : null;
  const returnedValue = selectedItems.reduce((sum, selected) => {
    const line = sale?.items.find((item) => item.productId === selected.productId);
    return sum + (sale && line ? calculateSaleItemReturn(sale, line, selected.quantity).refundAmount : 0);
  }, 0);
  const replacementQty = Math.max(1, Math.floor(Number(exchangeForm.watch("replacementQuantity")) || 1));
  const replacementSubtotal = (replacementPrice ?? 0) * replacementQty;
  const replacementValue = roundMoney(replacementSubtotal * (1 + (state.store?.vatRate ?? 0) / 100));
  const difference = replacementValue - returnedValue;
  const chooseSale = (saleId: string) => {
    exchangeForm.setValue("saleId", saleId);
    setSelectedQuantities({}); setError("");
  };
  useEffect(() => {
    exchangeForm.setValue("amountReceived", Math.max(0, difference), { shouldValidate: true });
  }, [difference, exchangeForm.setValue]);
  const setQty = (productId: string, value: number, max: number) => setSelectedQuantities((current) => ({
    ...current, [productId]: Math.min(max, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))),
  }));
  const submitReturn = exchangeForm.handleSubmit(async (values) => {
    if (!selectedItems.length) { setError("حدد كمية واحدة على الأقل للإرجاع."); return; }
    if (!values.reason.trim()) { setError("اكتب سبب الإرجاع."); return; }
    setBusy(true); setError("");
    try { await onReturn({ saleId: values.saleId, items: selectedItems, reason: values.reason.trim() }); setSelectedQuantities({}); exchangeForm.reset({ saleId: "", reason: "", replacementProductId: "", replacementQuantity: 1, paymentMethod: "cash", amountReceived: 0 }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تسجيل المرتجع."); }
    finally { setBusy(false); }
  });
  const submitExchange = exchangeForm.handleSubmit(async (values) => {
    if (!selectedItems.length) { setError("حدد الأصناف والكميات المطلوب إرجاعها."); return; }
    if (!values.reason.trim()) { setError("اكتب سبب الاستبدال."); return; }
    if (!replacement || replacementPrice === null || replacement.quantity < replacementQty) { setError("اختر منتجًا بديلًا له سعر بيع وكمية متاحة كافية."); return; }
    if (difference > 0 && values.amountReceived < difference) { setError("المبلغ المستلم أقل من فرق السعر المستحق."); return; }
    setBusy(true); setError("");
    try {
      await onExchange({ saleId: values.saleId, items: selectedItems, reason: values.reason.trim(), replacementProductId: replacement.id, replacementQuantity: replacementQty, paymentMethod: values.paymentMethod, amountReceived: values.amountReceived });
      setSelectedQuantities({}); exchangeForm.reset({ saleId: "", reason: "", replacementProductId: "", replacementQuantity: 1, paymentMethod: "cash", amountReceived: 0 });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تسجيل الاستبدال."); }
    finally { setBusy(false); }
  });
  const submit = mode === "return" ? submitReturn : submitExchange;
  const paymentField = exchangeForm.watch("paymentMethod");
  const recent = [...state.returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return <section className="op-page" dir="rtl" data-testid="page-offline-returns">
    <Heading eyebrow="خدمة ما بعد البيع" title="المرتجعات والاستبدال" description="سجّل حركة إرجاع أو استبدال من فاتورة محلية مع تحقق من الكميات والمخزون." icon={RotateCcw} />
    <div className="op-workspace">
      <section className="op-panel op-return-panel">
        <div className="op-panel-toolbar"><PanelTitle title="معالجة فاتورة" detail="اختر الفاتورة ثم حدّد الكميات" /><span className="op-local-chip"><ShieldCheck size={14} /> سجل محلي</span></div>
        <div className="op-tabs" role="tablist" aria-label="نوع العملية">
          <button type="button" role="tab" aria-selected={mode === "return"} className={mode === "return" ? "selected" : ""} onClick={() => { setMode("return"); setError(""); }} data-testid="tab-return"><ArrowDownLeft size={16} /> مرتجع</button>
          <button type="button" role="tab" aria-selected={mode === "exchange"} className={mode === "exchange" ? "selected" : ""} onClick={() => { setMode("exchange"); setError(""); }} data-testid="tab-exchange"><ArrowLeftRight size={16} /> استبدال</button>
        </div>
        {state.sales.length ? <Form {...activeForm}><form className="op-return-form" onSubmit={submit} noValidate>
          <FormField control={activeForm.control} name="saleId" rules={{ required: "اختر فاتورة أولًا." }} render={({ field }) => <FormItem className="op-field"><FormLabel>فاتورة البيع</FormLabel><FormControl><select {...field} onChange={(event) => chooseSale(event.target.value)} data-testid="select-return-sale"><option value="">اختر رقم الفاتورة</option>{[...state.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => <option key={item.id} value={item.id}>{item.invoiceNumber} — {item.customerName || "عميل نقدي"} — {dateLabel(item.createdAt)}</option>)}</select></FormControl><FormMessage /></FormItem>} />
          {sale && <div className="op-selected-sale" data-testid={`card-return-sale-${sale.id}`}><div><small>الفاتورة المحددة</small><b dir="ltr">{sale.invoiceNumber}</b></div><div><small>قيمة الفاتورة</small><b>{amount(sale.total, currency)}</b></div><div><small>تاريخ البيع</small><b>{dateLabel(sale.createdAt)}</b></div></div>}
          {sale && <div className="op-return-lines"><div className="op-lines-title"><b>الأصناف القابلة للإرجاع</b><small>لا يمكن تجاوز الكمية المتبقية من الفاتورة</small></div>{returnLines.length ? returnLines.map((line) => <div className="op-return-line" key={line.productId} data-testid={`row-return-item-${line.productId}`}><span><b>{line.name}</b><small>{line.sku || "بدون رمز"} · متاح للإرجاع: {latin(line.remaining)}</small></span><label><span className="op-sr-only">كمية إرجاع {line.name}</span><input type="number" min="0" max={line.remaining} step="1" value={selectedQuantities[line.productId] ?? 0} onChange={(event) => setQty(line.productId, Number(event.target.value), line.remaining)} data-testid={`input-return-quantity-${line.productId}`} /></label><b className="op-line-money">{amount(line.unitPrice * (selectedQuantities[line.productId] ?? 0), currency)}</b></div>) : <div className="op-inline-note">تم إرجاع جميع أصناف هذه الفاتورة مسبقًا.</div>}</div>}
          {mode === "exchange" && <div className="op-exchange-box">
            <h3>المنتج البديل</h3>
            <div className="op-form-grid">
              <FormField control={exchangeForm.control} name="replacementProductId" rules={{ required: "اختر المنتج البديل." }} render={({ field }) => <FormItem className="op-field"><FormLabel>الصنف المتاح</FormLabel><FormControl><select {...field} data-testid="select-replacement-product"><option value="">اختر منتجًا من المخزون</option>{state.products.filter((product) => product.quantity > 0 && (sale?.saleType === "wholesale" ? product.wholesalePrice !== null : product.price !== null)).map((product) => { const price = sale?.saleType === "wholesale" ? product.wholesalePrice : product.price; return <option key={product.id} value={product.id}>{product.name} · متاح {latin(product.quantity)} · {amount(price ?? 0, currency)}</option>; })}</select></FormControl><FormMessage /></FormItem>} />
              <FormField control={exchangeForm.control} name="replacementQuantity" rules={{ required: "أدخل الكمية.", min: { value: 1, message: "الكمية لا تقل عن 1." }, max: { value: replacement?.quantity ?? 1, message: "الكمية تتجاوز المخزون المتاح." } }} render={({ field }) => <FormItem className="op-field"><FormLabel>كمية البديل</FormLabel><FormControl><input {...field} type="number" min="1" max={replacement?.quantity ?? 1} step="1" onChange={(event) => field.onChange(Number(event.target.value))} data-testid="input-replacement-quantity" /></FormControl><FormMessage /></FormItem>} />
            </div>
            <div className="op-difference" data-testid="text-exchange-difference"><span><small>قيمة المرتجع</small><b>{amount(returnedValue, currency)}</b></span><i /><span><small>قيمة البديل</small><b>{amount(replacementValue, currency)}</b></span><strong className={difference > 0 ? "due" : difference < 0 ? "credit" : ""}><small>{difference > 0 ? "المتبقي على العميل" : difference < 0 ? "المبلغ المستحق للعميل" : "فرق السعر"}</small><b>{amount(Math.abs(difference), currency)}</b></strong></div>
            <div className="op-form-grid op-payment-grid"><FormField control={exchangeForm.control} name="paymentMethod" render={({ field }) => <FormItem className="op-field"><FormLabel>طريقة تسوية الفرق</FormLabel><FormControl><select {...field} data-testid="select-exchange-payment">{paymentOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormControl></FormItem>} />{difference > 0 && <FormField control={exchangeForm.control} name="amountReceived" rules={{ min: { value: difference, message: "المبلغ المستلم أقل من فرق السعر." } }} render={({ field }) => <FormItem className="op-field"><FormLabel>المبلغ المستلم ({currency})</FormLabel><FormControl><input {...field} type="number" min={difference} step="0.01" onChange={(event) => field.onChange(Number(event.target.value))} data-testid="input-exchange-amount-received" /></FormControl><FormMessage /></FormItem>} />}</div>
            <span className="op-sr-only" data-testid="status-exchange-method">{paymentField}</span>
          </div>}
          {sale && <FormField control={activeForm.control} name="reason" rules={{ required: "اكتب سبب العملية.", minLength: { value: 3, message: "اكتب سببًا أوضح." } }} render={({ field }) => <FormItem className="op-field"><FormLabel>{mode === "return" ? "سبب الإرجاع" : "سبب الاستبدال"}</FormLabel><FormControl><textarea {...field} rows={2} placeholder="اكتب سبب العملية باختصار" data-testid="input-return-reason" /></FormControl><FormMessage /></FormItem>} />}
          <ErrorNotice>{error}</ErrorNotice>
          <div className="op-form-footer"><span><LockKeyhole size={14} /> لن تتجاوز الكميات المسموح بها في الفاتورة</span><button type="submit" className="op-button op-primary" disabled={busy || !sale || (mode === "exchange" && (!replacement || replacement.quantity < replacementQty))} data-testid="button-submit-return">{busy ? "جارٍ التسجيل..." : mode === "return" ? "تأكيد المرتجع" : "تأكيد الاستبدال"}</button></div>
        </form></Form> : <Empty title="لا توجد فواتير للبيع" detail="ستتمكن من تسجيل المرتجع أو الاستبدال بعد حفظ عملية بيع محلية." />}
      </section>
      <aside className="op-panel op-history-panel"><PanelTitle title="آخر المرتجعات" detail="حركات مسجلة على هذا الجهاز" />{recent.length ? <div className="op-mini-history">{recent.map((record) => <article key={record.id} data-testid={`row-recent-return-${record.id}`}><span className="op-history-icon"><RotateCcw size={16} /></span><div><b>{record.invoiceNumber}</b><small>{record.reason || "بدون سبب"} · {dateLabel(record.createdAt)}</small></div><strong>{amount(record.refundAmount, currency)}</strong></article>)}</div> : <Empty title="لا توجد حركات بعد" detail="ستظهر هنا أحدث المرتجعات المسجلة." />}</aside>
    </div>
  </section>;
}

export function OfflineReportsPage({ state, currency }: { state: OfflineState; currency: string }) {
  const currentDay = today();
  const [from, setFrom] = useState(`${currentDay.slice(0, 7)}-01`);
  const [to, setTo] = useState(currentDay);
  const [error, setError] = useState("");
  const validRange = from <= to;
  const report = useMemo(() => {
    const inRange = (date: string) => {
      const value = new Date(date);
      if (Number.isNaN(value.getTime())) return false;
      const localDay = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      return validRange && localDay >= from && localDay <= to;
    };
    const sales = validRange ? state.sales.filter((sale) => inRange(sale.createdAt)) : [];
    const saleIds = new Set(sales.map((sale) => sale.id));
    const returns: OfflineReturn[] = validRange ? state.returns.filter((record) => saleIds.has(record.saleId)) : [];
    const netSales = sales.reduce((sum, sale) => sum + sale.subtotal - sale.discountAmount, 0);
    const refundedTax = returns.reduce((sum, record) => {
      const sale = sales.find((item) => item.id === record.saleId);
      const taxableTotal = sale ? sale.subtotal - sale.discountAmount + sale.taxAmount : 0;
      return sum + (taxableTotal > 0 ? record.refundAmount * sale!.taxAmount / taxableTotal : 0);
    }, 0);
    const returnAmount = returns.reduce((sum, record) => {
      const sale = sales.find((item) => item.id === record.saleId);
      const taxableTotal = sale ? sale.subtotal - sale.discountAmount + sale.taxAmount : 0;
      const taxPart = taxableTotal > 0 ? record.refundAmount * sale!.taxAmount / taxableTotal : 0;
      return sum + record.refundAmount - taxPart;
    }, 0);
    const costOfGoods = sales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, line) => lineSum + line.unitCost * Math.max(0, line.quantity - line.returnedQuantity), 0), 0);
    const taxCollected = sales.reduce((sum, sale) => sum + sale.taxAmount, 0) - refundedTax;
    const grossSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    return {
      sales, returns, grossSales, returnAmount, netSales,
      costOfGoods: Math.max(0, costOfGoods),
      taxCollected: roundMoney(taxCollected),
      grossProfit: roundMoney(netSales - returnAmount - Math.max(0, costOfGoods)),
      exchangeCount: state.exchanges.filter((exchange) => inRange(exchange.createdAt)).length,
      payments: paymentOptions.map((method) => ({ ...method, total: sales.filter((sale) => sale.paymentMethod === method.value).reduce((sum, sale) => sum + sale.total, 0) })).filter((item) => item.total > 0),
    };
  }, [from, to, state.sales, state.returns, state.exchanges, validRange]);
  const downloadLocalCsv = () => {
    if (!validRange) { setError("تحقق من ترتيب تاريخ البداية والنهاية."); return; }
    const rows = [
      ["نوع السجل", "رقم الفاتورة", "التاريخ", "المبلغ", "طريقة الدفع"],
      ...report.sales.map((sale) => ["بيع", sale.invoiceNumber, sale.createdAt, String(roundMoney(sale.subtotal - sale.discountAmount)), paymentOptions.find((item) => item.value === sale.paymentMethod)?.label ?? sale.paymentMethod]),
      ...report.returns.map((record) => ["مرتجع", record.invoiceNumber, record.createdAt, String(-record.refundAmount), "استرداد"]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `x-store-report-${from}-${to}.csv`;
    link.click(); URL.revokeObjectURL(url); setError("");
  };
  return <section className="op-page" dir="rtl" data-testid="page-offline-reports">
        <Heading eyebrow="الأداء المالي" title="التقارير المالية" description="ملخص المبيعات والمرتجعات وتكلفة البضائع والربح الإجمالي للفترة المحددة." icon={Activity} />
    <div className="op-panel op-report-panel">
      <div className="op-report-filters"><div className="op-filter-title"><span><CalendarDays size={17} /></span><div><b>الفترة الزمنية</b><small>تُحسب النتائج عند تغيير التواريخ</small></div></div>
        <label className="op-field"><span>من تاريخ</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} data-testid="input-report-from" /></label>
        <label className="op-field"><span>إلى تاريخ</span><input type="date" value={to} min={from} max={currentDay} onChange={(event) => setTo(event.target.value)} data-testid="input-report-to" /></label>
        <button type="button" className="op-button op-secondary" onClick={downloadLocalCsv} data-testid="button-export-report"><FileText size={15} /> تصدير CSV محلي</button>
      </div>
      {!validRange && <ErrorNotice>تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.</ErrorNotice>}
      <div className="op-report-range" data-testid="text-report-range"><span>نطاق التقرير</span><b dir="ltr">{from} — {to}</b></div>
      <div className="op-report-stats">
        <Stat label="عدد الفواتير" value={latin(report.sales.length)} caption="عمليات البيع في الفترة" icon={FileText} />
        <Stat label="صافي المبيعات" value={amount(report.netSales, currency)} caption="بعد الخصومات وقبل المرتجعات" icon={Banknote} tone="gold" />
        <Stat label="قيمة المرتجعات" value={amount(report.returnAmount, currency)} caption={`${latin(report.returns.length)} حركة إرجاع`} icon={RotateCcw} tone="red" />
        <Stat label="تكلفة البضائع" value={amount(report.costOfGoods, currency)} caption="تكلفة الأصناف غير المرتجعة" icon={Wallet} tone="blue" />
      </div>
      <div className="op-report-stats op-report-tax"><Stat label="صافي الضريبة" value={amount(report.taxCollected, currency)} caption="بعد تسوية ضريبة المرتجعات" icon={Banknote} tone="gold" /></div>
      <div className="op-profit-band"><span><span className="op-profit-icon"><Activity size={18} /></span><span><b>الربح الإجمالي</b><small>لا يشمل المصاريف التشغيلية. صافي المبيعات بعد المرتجعات وتكلفة البضائع.</small></span></span><strong data-testid="text-report-gross-profit">{amount(report.grossProfit, currency)}</strong></div>
      <ErrorNotice>{error}</ErrorNotice>
    </div>
    <div className="op-report-lower">
      <section className="op-panel"><PanelTitle title="تفصيل الفترة" detail="قيم مشتقة من بيانات المبيعات والمرتجعات المحلية" /><div className="op-breakdown">
        <div><span>تكلفة البضائع المباعة</span><b data-testid="text-report-cost">{amount(report.costOfGoods, currency)}</b></div>
        <div><span>عمليات الاستبدال</span><b data-testid="text-report-exchanges">{latin(report.exchangeCount)}</b></div>
        <div><span>صافي المبيعات بعد المرتجعات</span><b>{amount(report.netSales, currency)}</b></div>
      </div></section>
      <section className="op-panel"><PanelTitle title="المبيعات حسب الدفع" detail="توزيع إجمالي الفواتير المكتملة حسب وسيلة السداد" />
        {report.payments.length ? <div className="op-payment-breakdown">{report.payments.map((item) => <div key={item.value} data-testid={`row-report-payment-${item.value}`}><span>{item.label}</span><b>{amount(item.total, currency)}</b><i><em style={{ width: `${report.grossSales ? Math.min(100, item.total / report.grossSales * 100) : 0}%` }} /></i></div>)}</div> : <Empty title="لا توجد مبيعات في الفترة" detail="اختر نطاقًا آخر أو سجّل فاتورة بيع لإظهار التوزيع." />}
      </section>
    </div>
    <p className="op-report-note"><ShieldCheck size={15} /> التقرير للمتابعة التشغيلية ولا يشمل المصاريف التشغيلية أو أي سجلات خارج هذا الجهاز.</p>
  </section>;
}

export function OfflineAuditPage({ state }: { state: OfflineState }) {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const entities = [...new Set(state.auditLogs.map((entry) => entry.entityType).filter(Boolean))].sort();
  const matches = state.auditLogs.filter((entry) => {
    const haystack = `${entry.actorName} ${entry.action} ${entry.entityType} ${entry.entityId} ${entry.details}`.toLocaleLowerCase();
    const day = entry.createdAt.slice(0, 10);
    return (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase())) &&
      (entity === "all" || entry.entityType === entity) &&
      (!from || day >= from) && (!to || day <= to);
  }).sort((a, b) => sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt));
  const clearFilters = () => { setQuery(""); setEntity("all"); setFrom(""); setTo(""); };
  return <section className="op-page" dir="rtl" data-testid="page-offline-audit">
    <Heading eyebrow="شفافية على الجهاز" title="سجل التدقيق" description="ابحث في سجل الإجراءات المحلي وراجع الفاعل والكيان والتفاصيل." icon={FileClock} />
    <div className="op-audit-privacy"><span><ShieldCheck size={18} /></span><div><b>سجل للقراءة فقط</b><small>لا يمكن تعديل السجلات أو حذفها من هذه الصفحة.</small></div><strong data-testid="text-audit-total">{latin(state.auditLogs.length)} إجراء</strong></div>
    <section className="op-panel op-audit-panel">
      <div className="op-panel-toolbar"><PanelTitle title="الإجراءات المحلية" detail="كل الأوقات معروضة بالتوقيت المحلي للجهاز" /><span className="op-result-chip" data-testid="text-audit-results">{latin(matches.length)} نتيجة</span></div>
      <div className="op-audit-filters">
        <label className="op-search"><Search size={16} /><span className="op-sr-only">البحث في سجل التدقيق</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالفاعل أو الإجراء أو التفاصيل" data-testid="input-search-audit" /></label>
        <label className="op-field"><span>نوع السجل</span><select value={entity} onChange={(event) => setEntity(event.target.value)} data-testid="select-audit-entity"><option value="all">كل الأنواع</option>{entities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="op-field"><span>من تاريخ</span><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} data-testid="input-audit-from" /></label>
        <label className="op-field"><span>إلى تاريخ</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} data-testid="input-audit-to" /></label>
        <label className="op-field op-sort"><span>الترتيب</span><select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} data-testid="select-audit-sort"><option value="newest">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option></select></label>
        <button type="button" className="op-link" onClick={clearFilters} data-testid="button-clear-audit-filters">مسح الفلاتر</button>
      </div>
      {matches.length ? <div className="op-audit-list">{matches.map((entry, index) => <AuditRow key={entry.id} entry={entry} index={index} />)}</div> : <Empty title={state.auditLogs.length ? "لا توجد نتائج مطابقة" : "لا توجد إجراءات مسجلة"} detail={state.auditLogs.length ? "غيّر كلمات البحث أو معايير التصفية." : "ستظهر هنا الإجراءات التي يسجلها التطبيق محليًا."} />}
    </section>
    <div className="op-device-note"><LockKeyhole size={15} /><span>سجل التدقيق محفوظ ضمن بيانات المتجر المحلية.</span></div>
  </section>;
}

function AuditRow({ entry, index }: { entry: OfflineAuditLog; index: number }) {
  return <article className="op-audit-row" data-testid={`row-audit-${entry.id}`}><span className={`op-audit-icon tone-${index % 4}`}><Activity size={16} /></span><div className="op-audit-main"><div className="op-audit-title"><b>{entry.action}</b><span>{entry.entityType || "كيان غير محدد"}</span></div><small>{entry.actorName || "مستخدم محلي"}{entry.entityId ? ` · ${entry.entityId}` : ""}</small><p>{entry.details || "لا توجد تفاصيل إضافية."}</p></div><time dateTime={entry.createdAt} dir="ltr">{dateLabel(entry.createdAt)}</time></article>;
}
