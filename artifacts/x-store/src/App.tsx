import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { arSA } from '@clerk/localizations';
import {
  getGetXStoreAuthStatusQueryKey, getGetXStoreDashboardQueryKey, getGetXStoreSessionQueryKey,
  getListXStoreHeldSalesQueryKey, getListXStoreProductsQueryKey,
  getListXStoreSalesQueryKey, getListXStoreTeamQueryKey, getListXStoreTenantsQueryKey,
  getListXStoreSubscriptionPaymentsQueryKey,
  logoutXStore, useAddXStoreTeamMember, useBootstrapXStorePlatformAdmin, useCreateXStoreExchange, useCreateXStoreProduct, useCreateXStoreReturn,
  useCreateXStoreSubscriptionPayment, useCreateXStoreTenant, useGetXStoreDashboard, useGetXStoreSession, useHoldXStoreSale,
  useGetXStoreAuthStatus, useGetXStoreContactSettings, useLoginXStoreWithPhone,
  useListXStoreAuditLogs, useListXStoreHeldSales, useListXStoreProducts, useListXStoreSales,
  useGetXStoreProfitLossReport, useListXStoreSubscriptionPayments, useListXStoreTeam, useListXStoreTenants, useReleaseXStoreHeldSale, useUpdateXStoreProduct,
  useUpdateXStoreTenant, useUpdateXStoreTenantCredentials, useUpdateXStoreContactSettings, useCheckoutXStoreSale,
} from '@workspace/api-client-react';
import type { Product, Tenant, Sale } from '@workspace/api-client-react';
import { Route, Switch, Redirect, Link, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  LayoutDashboard, Store, Package, ShoppingCart, ReceiptText, ScrollText, Search, Plus,
  Bell, LogOut, Menu, X, ArrowUpLeft, ChevronLeft, ChevronDown, CreditCard, Banknote,
  Wallet, CircleCheck, Clock3, AlertTriangle, RotateCcw,
  Pause, Play, Minus, Trash2, RefreshCw, CalendarDays, Users, Boxes, Activity, ShieldCheck, ArrowLeftRight, Printer,
  Settings2, KeyRound, Phone, Mail, MessageCircle,
} from 'lucide-react';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/x-store-mark.png` },
  variables: {
    colorPrimary: '#0B4619', colorForeground: '#212529', colorMutedForeground: '#6C757D',
    colorDanger: '#DC3545', colorBackground: '#FFFFFF', colorInput: '#FFFFFF',
    colorInputForeground: '#212529', colorNeutral: '#DDE3DF',
    fontFamily: "'IBM Plex Sans Arabic', 'DM Sans', sans-serif", borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#212529] font-bold', headerSubtitle: 'text-[#6C757D]',
    socialButtonsBlockButtonText: 'text-[#212529]', formFieldLabel: 'text-[#212529]',
    footerActionLink: 'text-[#0B4619] font-semibold', footerActionText: 'text-[#6C757D]',
    dividerText: 'text-[#6C757D]', identityPreviewEditButton: 'text-[#0B4619]',
    formFieldSuccessText: 'text-[#0B4619]', alertText: 'text-[#212529]',
    logoBox: 'mb-3', logoImage: 'max-h-12 object-contain', socialButtonsBlockButton: 'border-[#DDE3DF]',
    formButtonPrimary: 'bg-[#0B4619] hover:bg-[#083815]', formFieldInput: 'border-[#DDE3DF]',
    footerAction: 'text-[#6C757D]', dividerLine: 'bg-[#DDE3DF]', alert: 'border-[#DDE3DF]',
    otpCodeFieldInput: 'border-[#DDE3DF]', formFieldRow: 'text-[#212529]', main: 'text-[#212529]',
  },
};

const fmt = (n: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(n);
const money = (n: number) => `${fmt(n)} ر.س`;
const dateLabel = (d?: string | null) => d ? new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';
const roleNames: Record<string, string> = { platform_admin: 'مدير المنصة', tenant_admin: 'مالك المتجر', cashier: 'أمين الصندوق', warehouse_manager: 'مدير المخزون', accountant: 'محاسب' };
const statusNames: Record<string, string> = { active: 'نشط', trial: 'تجريبي', suspended: 'موقوف', completed: 'مكتملة', partially_returned: 'مستردة جزئياً', returned: 'مستردة', monthly: 'شهري', half_yearly: 'نصف سنوي', annual: 'سنوي', lifetime: 'مدى الحياة' };
const nav = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['all'] },
  { href: '/tenants', label: 'المتاجر', icon: Store, roles: ['platform_admin'] },
  { href: '/subscriptions', label: 'الاشتراكات', icon: CreditCard, roles: ['platform_admin'] },
  { href: '/team', label: 'فريق العمل', icon: Users, roles: ['tenant_admin'] },
  { href: '/pos', label: 'نقطة البيع', icon: ShoppingCart, roles: ['tenant_admin', 'cashier'] },
  { href: '/inventory', label: 'المخزون', icon: Package, roles: ['tenant_admin', 'warehouse_manager'] },
  { href: '/reports', label: 'التقارير المالية', icon: Activity, roles: ['platform_admin', 'tenant_admin', 'accountant'] },
  { href: '/sales', label: 'المبيعات', icon: ReceiptText, roles: ['tenant_admin', 'cashier', 'accountant'] },
  { href: '/audit-log', label: 'سجل التدقيق', icon: ScrollText, roles: ['tenant_admin', 'platform_admin'] },
  { href: '/settings', label: 'إعدادات المنصة', icon: Settings2, roles: ['platform_admin'] },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" data-testid="link-brand"><img src={`${basePath}/x-store-mark.png`} alt="" /><span>X-Store</span>{!compact && <small>نظام إدارة متجرك</small>}</Link>;
}
function Home() {
  const [, go] = useLocation();
  return <main dir="rtl" className="landing">
    <header className="landing-nav"><Logo /><div className="landing-actions"><Link href="/sign-in" className="button button-quiet">تسجيل الدخول</Link><Link href="/sign-in" className="button button-primary">دخول الحساب <ArrowUpLeft size={16}/></Link></div></header>
    <section className="landing-hero">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> إدارة واضحة. يوم عمل أهدأ.</div><h1>كل متجرك،<br/><em>في مكان واحد.</em></h1><p>نقطة بيع سريعة ومخزون مرتب وتقارير موثوقة — أدوات يومية تساعد أصحاب المتاجر وفرقهم على العمل بثقة.</p><div className="hero-ctas"><button onClick={() => go('/sign-in')} className="button button-primary button-large" data-testid="button-start">دخول إلى حسابك <ChevronLeft size={18}/></button><button onClick={() => go('/sign-in')} className="text-link" data-testid="button-login">تحتاج حساباً؟ تواصل مع إدارة المنصة</button></div><div className="hero-proof"><span><CircleCheck size={16}/> إعداد بسيط</span><span><ShieldCheck size={16}/> بياناتك بأمان</span><span><Clock3 size={16}/> جاهز لليوم</span></div></div>
      <div className="hero-visual"><div className="dashboard-window"><div className="window-top"><span className="window-brand"><img src={`${basePath}/x-store-mark.png`}/> X-Store</span><span className="window-date">الأربعاء، ١٤ مايو</span><span className="window-avatar">م</span></div><div className="window-body" dir="rtl"><div className="window-greeting">مرحباً، متجر النخبة <span>صباح الخير</span></div><div className="mock-stats"><div><small>مبيعات اليوم</small><b>٤٬٨٢٠ <i>ر.س</i></b><span className="positive">↑ ١٢٪ عن أمس</span></div><div><small>الطلبات</small><b>٣٨</b><span>اليوم</span></div></div><div className="mock-chart"><div className="chart-title"><b>حركة المبيعات</b><span>آخر ٧ أيام</span></div><div className="bars">{[34,50,42,67,56,83,62,91,68,78,56,72,46,65].map((h,i)=><span key={i} style={{height:`${h}%`}} className={i===7?'bar-hot':''}/>)}</div><div className="chart-days"><span>السبت</span><span>الإثنين</span><span>الأربعاء</span><span>الجمعة</span></div></div><div className="mock-bottom"><span><i className="mini-stock"/> مخزون منخفض</span><b>٥ منتجات تحتاج متابعة</b><ChevronLeft size={14}/></div></div></div><div className="hero-float"><span className="float-check"><CircleCheck size={16}/></span><div><b>عملية بيع ناجحة</b><small>فاتورة X-2048 · منذ لحظات</small></div><strong>٢٤٥ ر.س</strong></div><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/></div>
    </section>
    <section className="landing-ribbon"><span>مصمم لروتين المتجر الحقيقي</span><b>من أول مسح للمنتج</b><i/><b>حتى إغلاق الوردية</b><i/><b>كل شيء واضح</b></section>
    <section className="feature-section"><div className="section-heading"><div className="eyebrow">أدوات يومية، بدون تعقيد</div><h2>تركيز على ما يحتاجه<br/>متجرك فعلاً.</h2><p>واجهة عربية مريحة وسير عمل مترابط يقلل الخطوات ويترك لك مساحة للاهتمام بعملائك.</p></div><div className="feature-grid"><article className="feature feature-large"><span className="feature-icon"><ShoppingCart size={21}/></span><div><h3>بيع أسرع عند الصندوق</h3><p>ابحث أو امسح الباركود، أضف الخصم واختر طريقة الدفع. شاشة واضحة تبقى سهلة القراءة طوال الوردية.</p><span className="feature-foot">نقطة بيع سريعة <ArrowUpLeft size={15}/></span></div><div className="feature-receipt"><div className="receipt-head">X-Store <span>فاتورة</span></div><div className="receipt-line">قميص قطني <b>١٢٠ ر.س</b></div><div className="receipt-line">حزام جلدي <b>٨٥ ر.س</b></div><div className="receipt-total">الإجمالي <b>٢٠٥ ر.س</b></div><span className="receipt-mark">تم الدفع</span></div></article><article className="feature"><span className="feature-icon feature-icon-gold"><Boxes size={21}/></span><h3>مخزون يعرف تفاصيله</h3><p>تابع المقاسات والألوان والكميات وتواريخ الصلاحية من قائمة واحدة.</p><div className="stock-preview"><span><i/> حذاء رياضي · ٣ ألوان</span><b>١٨ قطعة</b></div></article><article className="feature"><span className="feature-icon feature-icon-red"><Activity size={21}/></span><h3>صورة صادقة عن الأداء</h3><p>اطّلع على المبيعات والاشتراكات ونشاط المتجر حسب صلاحيتك.</p><div className="mini-metrics"><span>المبيعات <b>١٢٨</b></span><span>متاجر نشطة <b>٢٤</b></span></div></article></div></section>
    <section className="landing-quote"><div className="quote-mark">“</div><blockquote>عندما تكون الأرقام واضحة،<br/>تكون قرارات اليوم أسهل.</blockquote><span>صُمم لأصحاب المتاجر الذين يديرون التفاصيل كل يوم.</span><div className="quote-seal"><img src={`${basePath}/x-store-mark.png`} alt=""/></div></section>
    <footer className="landing-footer"><Logo compact/><span>إدارة أوضح. متجر أقوى.</span><Link href="/sign-in">تسجيل الدخول <ArrowUpLeft size={15}/></Link></footer>
  </main>;
}
function AuthPage({ kind }: { kind: 'in' | 'up' }) {
  const status = useGetXStoreAuthStatus();
  const { isSignedIn } = useAuth();
  const [showLegacy, setShowLegacy] = useState(false);
  if (kind === 'up') return <Redirect to="/sign-in"/>;
  const bootstrapRequired = status.data?.bootstrapRequired === true;
  return <div dir="rtl" className="auth-screen">
    <div className="auth-brand"><Logo/><p>مساحة عملك تبدأ من هنا.</p><div className="auth-note"><img src={`${basePath}/x-store-mark.png`}/><span>تجربة عمل هادئة<br/>وموثوقة كل يوم.</span></div></div>
    <div className="auth-widget"><section className="auth-card">
      {bootstrapRequired && isSignedIn
        ? <PlatformBootstrapForm/>
        : <PhoneLoginForm bootstrapRequired={bootstrapRequired}/>}
      {bootstrapRequired && !isSignedIn && <div className="legacy-bootstrap">
        {showLegacy
          ? <><div className="role-hint"><ShieldCheck size={17}/><span>استخدم حساب مدير المنصة الحالي مرة واحدة لتحويله إلى دخول الهاتف وكلمة المرور.</span></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={{...appearance,elements:{...appearance.elements,footerAction:'hidden'}}}/><button className="text-link" type="button" onClick={()=>setShowLegacy(false)}>إخفاء تسجيل الدخول القديم</button></>
          : <button className="button button-quiet" type="button" onClick={()=>setShowLegacy(true)}>إعداد دخول مدير المنصة لأول مرة</button>}
      </div>}
      <ContactMethods status={status.data}/>
    </section></div>
  </div>;
}
function PhoneLoginForm({ bootstrapRequired }: { bootstrapRequired:boolean }) {
  const login = useLoginXStoreWithPhone();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    login.mutate({data:{phone:String(form.get('phone')),password:String(form.get('password'))}},{
      onSuccess:user=>{
        qc.setQueryData(getGetXStoreSessionQueryKey(),user);
        qc.invalidateQueries({queryKey:getGetXStoreAuthStatusQueryKey()});
        setLocation('/dashboard');
      },
    });
  }
  return <><div className="auth-card-heading"><span className="auth-icon"><KeyRound size={20}/></span><div><h1>تسجيل الدخول</h1><p>استخدم رقم الهاتف وكلمة المرور المخصصين لحسابك.</p></div></div>
    <form className="auth-form" onSubmit={submit}>
      <label className="field"><span>رقم الهاتف</span><input name="phone" type="tel" autoComplete="username" required placeholder="مثال: ‎+20 10 1234 5678"/></label>
      <label className="field"><span>كلمة المرور</span><input name="password" type="password" autoComplete="current-password" required placeholder="أدخل كلمة المرور"/></label>
      {login.isError&&<div className="form-error">{apiErrorMessage(login.error,'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.')}</div>}
      {bootstrapRequired&&<div className="role-hint"><ShieldCheck size={16}/><span>حساب مدير المنصة لم يُجهّز بعد. استخدم خيار الإعداد لأول مرة أسفل هذه الصفحة.</span></div>}
      <button className="button button-primary auth-submit" disabled={login.isPending}>{login.isPending?'جارٍ تسجيل الدخول…':'دخول'}</button>
    </form>
  </>;
}
function PlatformBootstrapForm() {
  const bootstrap = useBootstrapXStorePlatformAdmin();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    bootstrap.mutate({data:{phone:String(form.get('phone')),password:String(form.get('password'))}},{
      onSuccess:user=>{
        qc.setQueryData(getGetXStoreSessionQueryKey(),user);
        qc.invalidateQueries({queryKey:getGetXStoreAuthStatusQueryKey()});
        setLocation('/dashboard');
      },
    });
  }
  return <><div className="auth-card-heading"><span className="auth-icon"><ShieldCheck size={20}/></span><div><h1>إعداد حساب مدير المنصة</h1><p>أنشئ بيانات الدخول التي ستستخدمها بعد ذلك بدلاً من تسجيل الدخول القديم.</p></div></div>
    <form className="auth-form" onSubmit={submit}>
      <label className="field"><span>رقم هاتف مدير المنصة</span><input name="phone" type="tel" autoComplete="tel" required placeholder="مثال: ‎+20 10 1234 5678"/></label>
      <label className="field"><span>كلمة مرور جديدة</span><input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required placeholder="10 أحرف على الأقل"/></label>
      {bootstrap.isError&&<div className="form-error">{apiErrorMessage(bootstrap.error,'تعذر إعداد الحساب. تحقق من رقم الهاتف وحاول مرة أخرى.')}</div>}
      <div className="role-hint"><ShieldCheck size={16}/><span>بعد الحفظ، يصبح هذا الحساب هو وسيلة الدخول لجميع الحسابات، ويتوقف تسجيل الدخول القديم.</span></div>
      <button className="button button-primary auth-submit" disabled={bootstrap.isPending}>{bootstrap.isPending?'جارٍ إعداد الحساب…':'حفظ بيانات الدخول'}</button>
    </form>
  </>;
}
function ContactMethods({status}:{status?:{supportPhone:string|null;supportWhatsapp:string|null;supportEmail:string|null}}) {
  const methods=[
    status?.supportPhone&&{icon:Phone,label:'اتصال',href:`tel:${status.supportPhone}`,value:status.supportPhone},
    status?.supportWhatsapp&&{icon:MessageCircle,label:'واتساب',href:`https://wa.me/${status.supportWhatsapp.replace(/\D/g,'')}`,value:status.supportWhatsapp},
    status?.supportEmail&&{icon:Mail,label:'البريد',href:`mailto:${status.supportEmail}`,value:status.supportEmail},
  ].filter(Boolean) as {icon:typeof Phone;label:string;href:string;value:string}[];
  if(!methods.length)return <div className="auth-contact-empty">تُدار الحسابات بواسطة إدارة المنصة.</div>;
  return <div className="auth-contact-list"><span>تحتاج مساعدة؟ تواصل مع إدارة المنصة</span>{methods.map(item=><a key={item.label} href={item.href} target={item.label==='واتساب'?'_blank':undefined} rel={item.label==='واتساب'?'noreferrer':undefined}><item.icon size={15}/><b>{item.label}</b><span>{item.value}</span></a>)}</div>;
}
function apiErrorMessage(error:unknown,fallback:string):string {
  if(typeof error==='object'&&error!==null&&'data' in error) {
    const data=(error as {data?:unknown}).data;
    if(typeof data==='object'&&data!==null&&'error' in data&&typeof (data as {error?:unknown}).error==='string')return (data as {error:string}).error;
  }
  return fallback;
}
function HomeRedirect() {
  const session=useGetXStoreSession();
  if(session.data)return <Redirect to="/dashboard"/>;
  return <Home/>;
}
function SignInPage() { return <AuthPage kind="in"/>; }
function SignUpPage() { return <Redirect to="/sign-in"/>; }

function AppShell({ children }: { children: ReactNode }) {
  const [location,setLocation] = useLocation(); const { signOut } = useClerk(); const [open,setOpen] = useState(false);
  const qc=useQueryClient();
  const { data:user, isLoading, isError, refetch } = useGetXStoreSession();
  if (isLoading) return <div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>;
  if (isError || !user) return <div className="auth-required" dir="rtl"><div className="empty-symbol"><ShieldCheck/></div><h2>يلزم تسجيل الدخول</h2><p>سجّل الدخول باستخدام حساب X-Store للوصول إلى مساحة العمل.</p><Link href="/sign-in" className="button button-primary">تسجيل الدخول</Link><button className="button button-quiet" onClick={()=>refetch()}>إعادة المحاولة</button></div>;
  const items = nav.filter(n=>n.roles.includes('all') || n.roles.includes(user.role));
  return <div dir="rtl" className="app-frame">
     <aside className={`sidebar ${open?'sidebar-open':''}`}><div className="sidebar-top"><Logo/><button className="icon-button sidebar-close" onClick={()=>setOpen(false)} aria-label="إغلاق القائمة"><X size={19}/></button></div><div className="store-chip"><span className="store-avatar">{(user.tenantName||user.name).slice(0,1)}</span><span><b>{user.tenantName || 'إدارة المنصة'}</b><small>{roleNames[user.role]||user.role}</small></span><ChevronDown size={15}/></div><div className="nav-caption">القائمة الرئيسية</div><nav className="side-nav">{items.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={`nav-link ${location===item.href?'nav-active':''}`} data-testid={`link-nav-${item.href.slice(1)}`}><item.icon size={18}/><span>{item.label}</span>{location===item.href&&<i/>}</Link>)}</nav><div className="sidebar-bottom"><div className="support-box"><span className="support-icon"><ShieldCheck size={17}/></span><b>كل شيء تحت السيطرة</b><p>بيانات المتجر محفوظة ومحدّثة.</p></div><div className="profile-row"><span className="profile-avatar">{user.name.slice(0,1)}</span><span className="profile-info"><b>{user.name}</b><small>{user.phone}</small></span><button className="icon-button" onClick={()=>{void logoutXStore().then(async()=>{qc.clear();try{await signOut({redirectUrl:basePath||'/'})}catch{setLocation('/sign-in')}}).catch(()=>window.alert('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مرة أخرى.'))}} title="تسجيل الخروج" data-testid="button-sign-out"><LogOut size={17}/></button></div></div></aside>
    {open&&<button aria-label="إغلاق القائمة" className="mobile-scrim" onClick={()=>setOpen(false)}/>}
    <div className="workspace"><header className="topbar"><button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={()=>setOpen(true)}><Menu size={20}/></button><div className="crumbs"><span>مساحة العمل</span><ChevronLeft size={14}/><b>{items.find(i=>i.href===location)?.label||'لوحة التحكم'}</b></div><div className="topbar-tools"><span className="today"><CalendarDays size={15}/> {new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span><button className="icon-button notification" aria-label="الإشعارات"><Bell size={18}/><i/></button><span className="top-avatar">{user.name.slice(0,1)}</span></div></header><main className="main-content">{children}</main><footer className="workspace-footer"><span>X-Store</span><span>مساحة عمل موثوقة لمتجرك</span><span>© ٢٠٢٥</span></footer></div>
  </div>;
}
function ProtectedLayout() {
  const [location] = useLocation(); const session=useGetXStoreSession();
  const allowed:Record<string,string[]>={'/tenants':['platform_admin'],'/subscriptions':['platform_admin'],'/settings':['platform_admin'],'/team':['tenant_admin'],'/pos':['tenant_admin','cashier'],'/inventory':['tenant_admin','warehouse_manager'],'/reports':['platform_admin','tenant_admin','accountant'],'/sales':['tenant_admin','cashier','accountant'],'/audit-log':['tenant_admin','platform_admin']};
  if(session.data&&allowed[location]&&!allowed[location].includes(session.data.role))return <Redirect to="/dashboard"/>;
  if(session.isLoading)return <div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>;
  if(session.isError||!session.data)return <Redirect to="/sign-in"/>;
  return <AppShell><Switch>
    <Route path="/dashboard" component={DashboardPage}/><Route path="/tenants" component={TenantsPage}/>
    <Route path="/subscriptions" component={SubscriptionsPage}/>
    <Route path="/team" component={TeamPage}/>
    <Route path="/pos" component={PosPage}/><Route path="/inventory" component={InventoryPage}/>
    <Route path="/reports" component={ReportsPage}/><Route path="/sales" component={SalesPage}/><Route path="/audit-log" component={AuditPage}/>
    <Route path="/settings" component={PlatformSettingsPage}/>
    <Route component={NotFound}/>
  </Switch></AppShell>;
}
function PageTitle({ eyebrow, title, desc, action }: { eyebrow:string; title:string; desc:string; action?:ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>{action&&<div className="page-action">{action}</div>}</div>;
}
function Card({children,className=''}:{children:ReactNode;className?:string}) { return <section className={`panel ${className}`}>{children}</section>; }
function SectionHead({title,detail,action}:{title:string;detail?:string;action?:ReactNode}) { return <div className="section-head"><div><h2>{title}</h2>{detail&&<span>{detail}</span>}</div>{action}</div>; }
function StatCard({label,value,detail,icon:Icon,tint='green'}:{label:string;value:string;detail:string;icon:any;tint?:string}) {
  return <div className="stat-card"><div className={`stat-icon tint-${tint}`}><Icon size={19}/></div><span className="stat-label">{label}</span><b className="stat-value">{value}</b><small>{detail}</small></div>;
}
function StateBlock({loading,error,onRetry,empty,emptyTitle='لا توجد بيانات بعد'}:{loading:boolean;error:boolean;onRetry:()=>void;empty:boolean;emptyTitle?:string}) {
  if(loading) return <div className="skeleton-table"><span/><span/><span/></div>;
  if(error) return <div className="state-box error-state"><AlertTriangle size={22}/><b>تعذر تحميل البيانات</b><span>تحقق من الاتصال ثم أعد المحاولة.</span><button className="button button-quiet" onClick={onRetry}><RefreshCw size={15}/> إعادة المحاولة</button></div>;
  if(empty) return <div className="state-box"><div className="empty-symbol"><Boxes size={22}/></div><b>{emptyTitle}</b><span>ستظهر البيانات هنا عند توفرها.</span></div>;
  return null;
}
function DashboardPage() {
  const {data:session}=useGetXStoreSession(); const dash=useGetXStoreDashboard();
  const d=dash.data; const isPlatform=session?.role==='platform_admin'; const isCashier=session?.role==='cashier';
  return <><PageTitle eyebrow="نظرة عامة" title={isPlatform?'صورة المنصة اليوم':'أهلاً بك في متجرك'} desc={isPlatform?'متابعة حالة المتاجر والاشتراكات ونشاط المنصة.':'ملخص عمل متجرك — كل التفاصيل المهمة في نظرة واحدة.'} action={<Link href={isPlatform?'/tenants':'/pos'} className="button button-primary">{isPlatform?'إدارة المتاجر':'بدء عملية بيع'} <ArrowUpLeft size={16}/></Link>}/>
    {dash.isLoading?<div className="stat-grid">{[1,2,3,4].map(x=><div className="stat-card stat-skeleton" key={x}/>)}</div>:dash.isError?<StateBlock loading={false} error onRetry={()=>dash.refetch()} empty={false}/>:d&&<>
      <div className="stat-grid">{isPlatform?<><StatCard label="المتاجر المسجلة" value={fmt(d.totalTenants)} detail={`${fmt(d.activeTenants)} متجر نشط`} icon={Store}/><StatCard label="الاشتراكات النشطة" value={fmt(d.activeSubscriptions)} detail={`${fmt(d.expiringSubscriptions)} تنتهي قريباً`} icon={Users} tint="gold"/><StatCard label="إيراد الاشتراكات" value={money(d.subscriptionRevenue)} detail="إجمالي الاشتراكات" icon={Banknote}/><StatCard label="متاجر موقوفة" value={fmt(d.suspendedTenants)} detail="تحتاج مراجعة" icon={AlertTriangle} tint="red"/></>:isCashier?<><StatCard label="عمليات اليوم" value={fmt(d.todaySales)} detail="فواتير مكتملة" icon={ReceiptText}/><StatCard label="نقطة البيع" value="جاهزة" detail="ابدأ عملية جديدة" icon={ShoppingCart} tint="sage"/><StatCard label="متجرك" value={session?.tenantName||'متجرك'} detail="مساحة عمل آمنة" icon={Store} tint="gold"/><StatCard label="مساعدة الصندوق" value="متاحة" detail="البيع والمرتجعات" icon={ShieldCheck}/></>:<><StatCard label="مبيعات اليوم" value={fmt(d.todaySales)} detail="عملية بيع مكتملة" icon={ReceiptText}/><StatCard label="إيراد اليوم" value={money(d.todayRevenue)} detail="إجمالي المبيعات اليوم" icon={Banknote} tint="gold"/><StatCard label="قيمة المخزون" value={money(d.inventoryValue)} detail={`${fmt(d.lowStockCount)} منتجات منخفضة`} icon={Boxes}/><StatCard label="الاشتراك" value={statusNames[session?.role||'']||'نشط'} detail={session?.tenantName||'متجرك'} icon={ShieldCheck} tint="sage"/></>}</div>
      <div className="dashboard-grid"><Card><SectionHead title={isPlatform?'أحدث المتاجر':'آخر المبيعات'} detail={isPlatform?'المتاجر المنضمة حديثاً':'الحركة الأخيرة في متجرك'} action={<Link href={isPlatform?'/tenants':'/sales'} className="text-link">عرض الكل <ChevronLeft size={15}/></Link>}/>{isPlatform?<TenantTable tenants={d.latestTenants||[]} compact/>:<SalesTable sales={d.latestSales||[]} compact showAmounts={!isCashier}/>}</Card><Card><SectionHead title={isCashier?'اختصارات الصندوق':'مؤشرات سريعة'} detail={isCashier?'إجراءات أساسية خلال الوردية':'تحديث مباشر من بيانات العمل'}/>{isCashier?<div className="quick-list"><div><span className="quick-icon green"><ShoppingCart size={17}/></span><span><b>عملية بيع جديدة</b><small>امسح أو ابحث عن منتج</small></span><Link href="/pos" className="table-action">فتح</Link></div><div><span className="quick-icon yellow"><RotateCcw size={17}/></span><span><b>المرتجعات</b><small>من شاشة المبيعات</small></span><Link href="/sales" className="table-action">عرض</Link></div><div><span className="quick-icon pale"><ReceiptText size={17}/></span><span><b>سجل الفواتير</b><small>الوصول لإيصال البيع</small></span><Link href="/sales" className="table-action">عرض</Link></div></div>:<><div className="quick-list"><div><span className="quick-icon green"><Package size={17}/></span><span><b>مخزون يحتاج متابعة</b><small>منتجات وصلت حد التنبيه</small></span><strong>{fmt(d.lowStockCount)}</strong></div><div><span className="quick-icon yellow"><Clock3 size={17}/></span><span><b>اشتراكات تنتهي قريباً</b><small>خلال الفترة القادمة</small></span><strong>{fmt(d.expiringSubscriptions)}</strong></div><div><span className="quick-icon pale"><Activity size={17}/></span><span><b>حالة الخدمة</b><small>جميع الأنظمة تعمل</small></span><span className="status-pill status-active">مستقر</span></div></div><div className="subscription-note"><span><ShieldCheck size={18}/></span><div><b>مساحة عمل آمنة</b><small>تُسجّل الإجراءات الحساسة للرجوع إليها.</small></div></div></>}</Card></div>
      {isPlatform&&<Card className="audit-preview"><SectionHead title="آخر إجراءات المنصة" action={<Link href="/audit-log" className="text-link">سجل التدقيق <ChevronLeft size={15}/></Link>}/><AuditRows logs={d.latestAuditLogs||[]}/></Card>}
    </>}
  </>;
}
function TenantTable({tenants,compact=false}:{tenants:Tenant[];compact?:boolean}) {
  if(!tenants.length)return <div className="empty-inline">لا توجد متاجر لعرضها.</div>;
  return <div className="table-wrap"><table><thead><tr><th>المتجر</th><th>المالك</th>{!compact&&<th>نوع النشاط</th>}<th>الحالة</th><th>الخطة</th>{!compact&&<th>الفروع</th>}</tr></thead><tbody>{tenants.map(t=><tr key={t.id}><td><b>{t.name}</b><small>{t.email||t.phone||'—'}</small></td><td>{t.ownerName}</td>{!compact&&<td>{t.businessType}</td>}<td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{statusNames[t.plan]}</td>{!compact&&<td>{fmt(t.branchCount)}</td>}</tr>)}</tbody></table></div>;
}
function SalesTable({sales,compact=false,onReturn,onPrint,showAmounts=true}:{sales:Sale[];compact?:boolean;onReturn?:(s:Sale)=>void;onPrint?:(s:Sale)=>void;showAmounts?:boolean}) {
  if(!sales.length)return <div className="empty-inline">لا توجد عمليات بيع لعرضها.</div>;
  return <div className="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الأصناف</th>{!compact&&<th>الدفع</th>}{showAmounts&&<th>الإجمالي</th>}<th>الحالة</th>{(onReturn||onPrint)&&<th>إجراء</th>}</tr></thead><tbody>{sales.map(s=><tr key={s.id}><td className="ltr-id">{s.invoiceNo}</td><td>{dateLabel(s.createdAt)}</td><td>{fmt(s.itemCount)}</td>{!compact&&<td>{paymentName(s.paymentMethod)}</td>}{showAmounts&&<td><b>{money(s.total)}</b></td>}<td><span className={`status-pill status-${s.status}`}>{statusNames[s.status]}</span></td>{(onReturn||onPrint)&&<td className="table-actions-cell">{onPrint&&<button className="table-action" onClick={()=>onPrint(s)} data-testid={`button-print-${s.id}`}><Printer size={14}/> إيصال</button>}{onReturn&&<button className="table-action" onClick={()=>onReturn(s)} data-testid={`button-return-${s.id}`}><RotateCcw size={14}/> مرتجع</button>}</td>}</tr>)}</tbody></table></div>;
}
function paymentName(p:string) { return p==='cash'?'نقداً':p==='card'?'بطاقة':'محفظة'; }
function ReceiptModal({sale,close}:{sale:Sale;close:()=>void}) {
  return <div className="modal-backdrop receipt-backdrop"><section className="modal receipt-modal" role="dialog" aria-modal="true" dir="rtl"><div className="receipt-brand"><img src={`${basePath}/x-store-mark.png`} alt=""/><b>X-Store</b><span>إيصال بيع</span></div><div className="receipt-number"><span>رقم الفاتورة</span><b className="ltr-id">{sale.invoiceNo}</b></div><div className="receipt-detail"><span>التاريخ</span><b>{dateLabel(sale.createdAt)}</b></div><div className="receipt-detail"><span>عدد الأصناف</span><b>{fmt(sale.itemCount)}</b></div><div className="receipt-detail"><span>طريقة الدفع</span><b>{paymentName(sale.paymentMethod)}</b></div><div className="receipt-divider"/><div className="receipt-detail"><span>المجموع الفرعي</span><b>{money(sale.subtotal)}</b></div><div className="receipt-detail"><span>الخصم</span><b>{money(sale.discountAmount)}</b></div><div className="receipt-detail"><span>الضريبة</span><b>{money(sale.taxAmount)}</b></div><div className="receipt-grand"><span>الإجمالي</span><b>{money(sale.total)}</b></div><div className="receipt-detail"><span>المبلغ المستلم</span><b>{money(sale.amountReceived)}</b></div><div className="receipt-detail"><span>الباقي</span><b>{money(sale.changeAmount)}</b></div><p className="receipt-thanks">شكراً لزيارتكم</p><div className="modal-actions receipt-actions"><button className="button button-quiet" onClick={close}>إغلاق</button><button className="button button-primary" onClick={()=>window.print()}><Printer size={16}/> طباعة الإيصال</button></div></section></div>;
}
function TenantsPage() {
  const qc=useQueryClient();
  const tenants=useListXStoreTenants();
  const create=useCreateXStoreTenant();
  const update=useUpdateXStoreTenant();
  const credentials=useUpdateXStoreTenantCredentials();
  const [search,setSearch]=useState('');
  const [dialog,setDialog]=useState(false);
  const [accessTenant,setAccessTenant]=useState<Tenant|null>(null);
  const [notice,setNotice]=useState('');
  const filtered=useMemo(()=> (tenants.data||[]).filter(t=>`${t.name} ${t.ownerName} ${t.phone} ${t.email||''}`.toLowerCase().includes(search.toLowerCase())),[tenants.data,search]);
  function refreshTenants(){qc.invalidateQueries({queryKey:getListXStoreTenantsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});}
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    create.mutate({data:{
      name:String(f.get('name')),
      ownerName:String(f.get('ownerName')),
      phone:String(f.get('phone')),
      ownerPassword:String(f.get('ownerPassword')),
      email:String(f.get('email')||'').trim()||null,
      businessType:String(f.get('businessType')),
      plan:String(f.get('plan')) as 'monthly'|'annual'|'half_yearly'|'lifetime',
    }},{onSuccess:()=>{refreshTenants();setDialog(false);setNotice('تم إنشاء المتجر وحساب المالك');}});
  }
  function submitCredentials(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!accessTenant)return;
    const f=new FormData(e.currentTarget);
    credentials.mutate({tenantId:accessTenant.id,data:{phone:String(f.get('phone')),password:String(f.get('password'))}},{onSuccess:()=>{refreshTenants();setAccessTenant(null);setNotice('تم تحديث بيانات دخول مالك المتجر');}});
  }
  return <><PageTitle eyebrow="إدارة المنصة" title="المتاجر" desc="إدارة المتاجر والاشتراكات وإنشاء بيانات دخول كل مالك." action={<button onClick={()=>setDialog(true)} className="button button-primary" data-testid="button-add-tenant"><Plus size={17}/> إضافة متجر</button>}/>
    <div className="tenant-summary"><span><Store size={17}/> {fmt(filtered.length)} متجر</span><span><CircleCheck size={17}/> {fmt(filtered.filter(t=>t.status==='active').length)} نشط</span><span><Clock3 size={17}/> {fmt(filtered.filter(t=>t.status==='trial').length)} تجريبي</span></div>
    <Card><SectionHead title="قائمة المتاجر" detail="تحديث الحالة وتغيير بيانات دخول المالك مسجلان في سجل التدقيق."/>
      <div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المتجر أو المالك أو الهاتف" data-testid="input-search-tenants"/></label><span className="result-count">{fmt(filtered.length)} نتيجة</span></div>
      {tenants.isLoading?<StateBlock loading error={false} onRetry={()=>tenants.refetch()} empty={false}/>:tenants.isError?<StateBlock loading={false} error onRetry={()=>tenants.refetch()} empty={false}/>:filtered.length?<div className="table-wrap"><table><thead><tr><th>المتجر</th><th>المالك</th><th>نوع النشاط</th><th>الحالة</th><th>الخطة</th><th>انتهاء الاشتراك</th><th>الفروع</th><th>إجراء</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><b>{t.name}</b><small>{t.email||t.phone}</small></td><td>{t.ownerName}<small dir="ltr">{t.phone}</small></td><td>{t.businessType}</td><td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{statusNames[t.plan]}</td><td>{dateLabel(t.subscriptionEndsAt)}</td><td>{fmt(t.branchCount)}</td><td><div className="table-actions-cell"><select aria-label={`تغيير حالة ${t.name}`} value={t.status} disabled={update.isPending} onChange={e=>update.mutate({tenantId:t.id,data:{status:e.target.value as 'active'|'trial'|'suspended'}},{onSuccess:()=>{refreshTenants();setNotice(`تم تحديث حالة ${t.name}`)}})}><option value="active">نشط</option><option value="trial">تجريبي</option><option value="suspended">إيقاف</option></select><button className="table-action" onClick={()=>setAccessTenant(t)}><KeyRound size={14}/> بيانات الدخول</button></div></td></tr>)}</tbody></table></div>:<div className="empty-inline">لا توجد متاجر تطابق البحث.</div>}
    </Card>
    {notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
    {dialog&&<Modal title="إضافة متجر وحساب مالكه" close={()=>setDialog(false)}><form className="form-grid" onSubmit={submit}>
      <Field label="اسم المتجر" name="name" required/><Field label="اسم المالك" name="ownerName" required/>
      <Field label="رقم هاتف الدخول" name="phone" type="tel" required placeholder="+20 10 1234 5678"/>
      <Field label="كلمة مرور المالك" name="ownerPassword" type="password" required placeholder="10 أحرف على الأقل"/>
      <Field label="البريد الإلكتروني (اختياري)" name="email" type="email"/>
      <Field label="نوع النشاط" name="businessType" required placeholder="مثال: ملابس"/>
      <label className="field"><span>الخطة</span><select name="plan"><option value="monthly">شهري</option><option value="half_yearly">نصف سنوي</option><option value="annual">سنوي</option><option value="lifetime">مدى الحياة</option></select></label>
      <div className="role-hint field-wide"><ShieldCheck size={16}/><span>سيتم حفظ كلمة المرور مشفّرة فقط، ولن تظهر مرة أخرى بعد إنشاء الحساب.</span></div>
      {create.isError&&<div className="form-error">{apiErrorMessage(create.error,'تعذر إضافة المتجر. تحقق من الهاتف وكلمة المرور.')}</div>}
      <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setDialog(false)}>إلغاء</button><button className="button button-primary" disabled={create.isPending}>{create.isPending?'جارٍ الحفظ…':'إنشاء المتجر والحساب'}</button></div>
    </form></Modal>}
    {accessTenant&&<Modal title={`بيانات دخول المالك · ${accessTenant.name}`} close={()=>setAccessTenant(null)}><form className="form-grid" onSubmit={submitCredentials}>
      <Field label="رقم الهاتف" name="phone" type="tel" required defaultValue={accessTenant.phone||''}/>
      <Field label="كلمة مرور جديدة" name="password" type="password" required placeholder="10 أحرف على الأقل"/>
      <div className="role-hint field-wide"><KeyRound size={16}/><span>سيؤدي الحفظ إلى إلغاء الجلسات الحالية لهذا الحساب. لا يمكن استرجاع كلمة المرور القديمة.</span></div>
      {credentials.isError&&<div className="form-error">{apiErrorMessage(credentials.error,'تعذر تحديث بيانات دخول المالك.')}</div>}
      <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setAccessTenant(null)}>إلغاء</button><button className="button button-primary" disabled={credentials.isPending}>{credentials.isPending?'جارٍ الحفظ…':'حفظ بيانات الدخول'}</button></div>
    </form></Modal>}
  </>;
}
function TeamPage() {
  const qc=useQueryClient(), team=useListXStoreTeam(), add=useAddXStoreTeamMember();
  const [dialog,setDialog]=useState(false),[search,setSearch]=useState(''),[notice,setNotice]=useState('');
  const roleTitle:Record<string,string>={cashier:'أمين الصندوق',warehouse_manager:'مدير المخزون',accountant:'محاسب'};
  const members=(team.data||[]).filter(m=>`${m.name} ${m.phone} ${m.email||''}`.toLowerCase().includes(search.toLowerCase()));
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    add.mutate({data:{name:String(f.get('name')),phone:String(f.get('phone')),password:String(f.get('password')),email:String(f.get('email')||'').trim()||null,role:String(f.get('role')) as 'cashier'|'warehouse_manager'|'accountant'}},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListXStoreTeamQueryKey()});setDialog(false);setNotice('تم حفظ حساب عضو الفريق');}});
  }
  return <><PageTitle eyebrow="إدارة الصلاحيات" title="فريق العمل" desc="أنشئ حسابات الفريق برقم الهاتف وكلمة المرور وحدد دور كل شخص." action={<button className="button button-primary" onClick={()=>setDialog(true)} data-testid="button-add-team-member"><Plus size={17}/> إضافة عضو</button>}/>
    <div className="team-summary"><div><span className="team-summary-icon"><Users size={18}/></span><b>{fmt(members.length)} عضو</b><small>ضمن فريق متجرك</small></div><div><span className="team-summary-icon team-sage"><ShieldCheck size={18}/></span><b>صلاحيات حسب الدور</b><small>كل شخص يرى ما يحتاجه فقط</small></div><div className="team-summary-note">إعادة استخدام رقم عضو في نفس المتجر تحدّث دوره وكلمة مروره.</div></div>
    <Card><SectionHead title="أعضاء الفريق" detail="بيانات الدخول: رقم الهاتف وكلمة المرور التي تحددها لكل عضو."/>
      <div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم العضو أو الهاتف" data-testid="input-search-team"/></label><span className="result-count">{fmt(members.length)} عضو</span></div>
      {team.isLoading?<StateBlock loading error={false} onRetry={()=>team.refetch()} empty={false}/>:team.isError?<StateBlock loading={false} error onRetry={()=>team.refetch()} empty={false}/>:members.length?<div className="table-wrap"><table><thead><tr><th>عضو الفريق</th><th>رقم الهاتف</th><th>البريد الإلكتروني</th><th>الدور</th><th>الحالة</th><th>تاريخ الإضافة</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td><div className="member-name"><span>{m.name.slice(0,1)}</span><b>{m.name}</b></div></td><td dir="ltr">{m.phone}</td><td>{m.email||'—'}</td><td>{roleTitle[m.role]||m.role}</td><td><span className={`status-pill ${m.status==='active'?'status-active':'status-trial'}`}>{m.status==='active'?'نشط':'دعوة مرسلة'}</span></td><td>{dateLabel(m.createdAt)}</td></tr>)}</tbody></table></div>:<div className="state-box"><div className="empty-symbol"><Users/></div><b>ابدأ ببناء فريقك</b><span>أضف أمين صندوق أو مدير مخزون أو محاسب.</span><button className="button button-primary" onClick={()=>setDialog(true)}><Plus size={16}/> إضافة عضو</button></div>}
    </Card>
    {dialog&&<Modal title="إضافة حساب لفريق العمل" close={()=>setDialog(false)}><form className="form-grid" onSubmit={submit}>
      <Field label="اسم العضو" name="name" required/>
      <Field label="رقم هاتف الدخول" name="phone" type="tel" required placeholder="+20 10 1234 5678"/>
      <Field label="كلمة المرور" name="password" type="password" required placeholder="10 أحرف على الأقل"/>
      <Field label="البريد الإلكتروني (اختياري)" name="email" type="email"/>
      <label className="field field-wide"><span>الدور</span><select name="role"><option value="cashier">أمين الصندوق — البيع والمرتجعات</option><option value="warehouse_manager">مدير المخزون — إدارة المنتجات والكميات</option><option value="accountant">محاسب — متابعة المبيعات والتقارير المالية</option></select></label>
      <div className="role-hint field-wide"><ShieldCheck size={17}/><span>الحساب الجديد لا يصل إلى إعدادات المنصة أو بيانات المتاجر الأخرى.</span></div>
      {add.isError&&<div className="form-error">{apiErrorMessage(add.error,'تعذر حفظ الحساب. تحقق من رقم الهاتف والصلاحيات.')}</div>}
      <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setDialog(false)}>إلغاء</button><button className="button button-primary" disabled={add.isPending}>{add.isPending?'جارٍ الحفظ…':'حفظ الحساب'}</button></div>
    </form></Modal>}
    {notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
  </>;
}
function PlatformSettingsPage() {
  const settings=useGetXStoreContactSettings();
  const update=useUpdateXStoreContactSettings();
  const [values,setValues]=useState({supportPhone:'',supportWhatsapp:'',supportEmail:''});
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(settings.data)setValues({
      supportPhone:settings.data.supportPhone||'',
      supportWhatsapp:settings.data.supportWhatsapp||'',
      supportEmail:settings.data.supportEmail||'',
    });
  },[settings.data]);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    update.mutate({data:{
      supportPhone:values.supportPhone.trim()||null,
      supportWhatsapp:values.supportWhatsapp.trim()||null,
      supportEmail:values.supportEmail.trim().toLowerCase()||null,
    }},{onSuccess:()=>setNotice('تم تحديث معلومات التواصل التي تظهر في صفحة الدخول.')});
  }
  return <><PageTitle eyebrow="إعدادات المنصة" title="معلومات التواصل" desc="تظهر هذه البيانات للزوار في صفحة تسجيل الدخول."/>
    <Card className="settings-card"><SectionHead title="وسائل التواصل" detail="اترك الحقل فارغاً لإخفائه من صفحة الدخول."/>
      {settings.isLoading?<StateBlock loading error={false} onRetry={()=>settings.refetch()} empty={false}/>:settings.isError?<StateBlock loading={false} error onRetry={()=>settings.refetch()} empty={false}/>:<form className="form-grid settings-form" onSubmit={submit}>
        <label className="field"><span>رقم هاتف الدعم</span><input type="tel" value={values.supportPhone} onChange={e=>setValues({...values,supportPhone:e.target.value})} placeholder="+20 10 1234 5678"/></label>
        <label className="field"><span>رقم واتساب الدعم</span><input type="tel" value={values.supportWhatsapp} onChange={e=>setValues({...values,supportWhatsapp:e.target.value})} placeholder="+20 10 1234 5678"/></label>
        <label className="field field-wide"><span>البريد الإلكتروني للدعم</span><input type="email" value={values.supportEmail} onChange={e=>setValues({...values,supportEmail:e.target.value})} placeholder="support@example.com"/></label>
        {update.isError&&<div className="form-error">{apiErrorMessage(update.error,'تعذر حفظ معلومات التواصل.')}</div>}
        {notice&&<div className="settings-success"><CircleCheck size={16}/>{notice}</div>}
        <div className="modal-actions"><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ الحفظ…':'حفظ معلومات التواصل'}</button></div>
      </form>}
    </Card>
  </>;
}
function SubscriptionsPage() {
  const qc=useQueryClient(), tenants=useListXStoreTenants(), payments=useListXStoreSubscriptionPayments(), update=useUpdateXStoreTenant(), createPayment=useCreateXStoreSubscriptionPayment();
  const [renewTenant,setRenewTenant]=useState<Tenant|null>(null),[paymentOpen,setPaymentOpen]=useState(false),[notice,setNotice]=useState('');
  function saveRenewal(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!renewTenant)return;const f=new FormData(e.currentTarget);update.mutate({tenantId:renewTenant.id,data:{plan:String(f.get('plan')) as 'monthly'|'half_yearly'|'annual'|'lifetime',subscriptionEndsAt:String(f.get('subscriptionEndsAt')),status:'active'}},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListXStoreTenantsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});setRenewTenant(null);setNotice('تم تحديث الخطة وتاريخ التجديد للمتجر المحدد')}})}
  function savePayment(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);createPayment.mutate({data:{tenantId:String(f.get('tenantId')),amount:Number(f.get('amount')),plan:String(f.get('plan')) as 'monthly'|'half_yearly'|'annual'|'lifetime',paymentMethod:String(f.get('paymentMethod')) as 'cash'|'card'|'transfer'}},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListXStoreSubscriptionPaymentsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});setPaymentOpen(false);setNotice('تم تسجيل الدفعة يدوياً')}})}
  const planNames:Record<string,string>={monthly:'شهري',half_yearly:'نصف سنوي',annual:'سنوي',lifetime:'مدى الحياة'};
  const payMethod:Record<string,string>={cash:'نقداً',card:'بطاقة',transfer:'تحويل بنكي'};
  return <><PageTitle eyebrow="الخطط والتحصيل" title="الاشتراكات" desc="تابع الخطة وموعد التجديد لكل متجر وسجّل الدفعات يدوياً." action={<button className="button button-primary" onClick={()=>setPaymentOpen(true)} data-testid="button-record-payment"><Plus size={16}/> تسجيل دفعة</button>}/><div className="stat-grid"><StatCard label="الاشتراكات النشطة" value={fmt((tenants.data||[]).filter(t=>t.status==='active').length)} detail="متاجر بخطة سارية" icon={ShieldCheck}/><StatCard label="تجريبية" value={fmt((tenants.data||[]).filter(t=>t.status==='trial').length)} detail="تحتاج متابعة التجديد" icon={Clock3} tint="gold"/><StatCard label="منتهية / موقوفة" value={fmt((tenants.data||[]).filter(t=>t.status==='suspended').length)} detail="حالة الاشتراك موقوفة" icon={AlertTriangle} tint="red"/><StatCard label="دفعات مسجلة" value={fmt(payments.data?.length||0)} detail="سجل التحصيل اليدوي" icon={Banknote} tint="sage"/></div><Card><SectionHead title="خطط المتاجر" detail="إجراء التجديد يحدّث خطة المتجر المحدد وتاريخ انتهاء اشتراكه."/><div className="table-wrap">{tenants.isLoading?<StateBlock loading error={false} onRetry={()=>tenants.refetch()} empty={false}/>:tenants.isError?<StateBlock loading={false} error onRetry={()=>tenants.refetch()} empty={false}/>:tenants.data?.length?<table><thead><tr><th>المتجر</th><th>الخطة الحالية</th><th>الحالة</th><th>تاريخ الانتهاء</th><th>الفروع</th><th>إجراء</th></tr></thead><tbody>{tenants.data.map(t=><tr key={t.id}><td><b>{t.name}</b><small>{t.ownerName} · {t.email}</small></td><td>{planNames[t.plan]}</td><td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{dateLabel(t.subscriptionEndsAt)}</td><td>{fmt(t.branchCount)}</td><td><button className="table-action" onClick={()=>setRenewTenant(t)} data-testid={`button-renew-${t.id}`}><RefreshCw size={14}/> تجديد / تعديل</button></td></tr>)}</tbody></table>:<div className="empty-inline">لا توجد اشتراكات مسجلة.</div>}</div></Card><Card className="payments-panel"><SectionHead title="سجل الدفعات" detail="دفعات الاشتراكات المسجلة يدوياً بواسطة مدير المنصة." action={<button className="text-link" onClick={()=>payments.refetch()}>تحديث <RefreshCw size={14}/></button>}/>{payments.isLoading?<StateBlock loading error={false} onRetry={()=>payments.refetch()} empty={false}/>:payments.isError?<StateBlock loading={false} error onRetry={()=>payments.refetch()} empty={false}/>:payments.data?.length?<div className="table-wrap"><table><thead><tr><th>المتجر</th><th>الخطة</th><th>طريقة الدفع</th><th>المبلغ</th><th>تاريخ التسجيل</th></tr></thead><tbody>{payments.data.map(p=><tr key={p.id}><td><b>{p.tenantName}</b></td><td>{planNames[p.plan]}</td><td>{payMethod[p.paymentMethod]}</td><td><b>{money(p.amount)}</b></td><td>{dateLabel(p.createdAt)}</td></tr>)}</tbody></table></div>:<div className="empty-inline">لم تُسجل دفعات بعد.</div>}</Card>{renewTenant&&<Modal title={`تجديد اشتراك · ${renewTenant.name}`} close={()=>setRenewTenant(null)}><form className="form-grid" onSubmit={saveRenewal}><label className="field"><span>الخطة الجديدة</span><select name="plan" defaultValue={renewTenant.plan}><option value="monthly">شهري</option><option value="half_yearly">نصف سنوي</option><option value="annual">سنوي</option><option value="lifetime">مدى الحياة</option></select></label><Field label="تاريخ الانتهاء" name="subscriptionEndsAt" type="date" required defaultValue={renewTenant.subscriptionEndsAt?.slice(0,10)||''}/><div className="role-hint field-wide"><ShieldCheck size={16}/><span>سيُعاد تفعيل هذا المتجر عند حفظ التجديد. لإثبات التحصيل، سجّل الدفعة بشكل منفصل.</span></div>{update.isError&&<div className="form-error">تعذر تحديث الاشتراك.</div>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setRenewTenant(null)}>إلغاء</button><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ التحديث…':'حفظ التجديد'}</button></div></form></Modal>}{paymentOpen&&<Modal title="تسجيل دفعة اشتراك" close={()=>setPaymentOpen(false)}><form className="form-grid" onSubmit={savePayment}><label className="field field-wide"><span>المتجر المعني</span><select name="tenantId" defaultValue="" required><option value="" disabled>اختر متجراً</option>{tenants.data?.map(t=><option key={t.id} value={t.id}>{t.name} · {t.ownerName}</option>)}</select></label><Field label="المبلغ المستلم" name="amount" type="number" required/><label className="field"><span>الخطة المدفوعة</span><select name="plan"><option value="monthly">شهري</option><option value="half_yearly">نصف سنوي</option><option value="annual">سنوي</option><option value="lifetime">مدى الحياة</option></select></label><label className="field field-wide"><span>طريقة الدفع</span><select name="paymentMethod"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل بنكي</option></select></label><div className="role-hint field-wide"><ShieldCheck size={16}/><span>سيُسجل اسم المتجر والخطة والمبلغ والطريقة في سجل الدفعات والتدقيق.</span></div>{createPayment.isError&&<div className="form-error">تعذر تسجيل الدفعة. تحقق من المتجر والمبلغ.</div>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setPaymentOpen(false)}>إلغاء</button><button className="button button-primary" disabled={createPayment.isPending}>{createPayment.isPending?'جارٍ التسجيل…':'تسجيل الدفعة'}</button></div></form></Modal>}{notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}</>;
}
function Field({label,name,type='text',required=false,placeholder='',defaultValue=''}:{label:string;name:string;type?:string;required?:boolean;placeholder?:string;defaultValue?:string}) {return <label className="field"><span>{label}</span><input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue}/></label>}
function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}) {return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="إغلاق"><X size={18}/></button></div>{children}</section></div>}
function InventoryPage() {
  const qc = useQueryClient();
  const q = useListXStoreProducts();
  const create = useCreateXStoreProduct();
  const update = useUpdateXStoreProduct();
  const session = useGetXStoreSession();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const isWarehouseManager = session.data?.role === 'warehouse_manager';
  const canManage = session.data?.role === 'tenant_admin' || isWarehouseManager;
  const rows = (q.data || []).filter(p =>
    `${p.name} ${p.sku} ${p.category} ${p.barcode || ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      name: String(f.get('name')),
      sku: String(f.get('sku')),
      barcode: String(f.get('barcode') || '') || null,
      category: String(f.get('category')),
      price: isWarehouseManager ? 0 : Number(f.get('price')),
      costPrice: isWarehouseManager ? 0 : Number(f.get('costPrice')),
      quantity: Number(f.get('quantity')),
      color: String(f.get('color') || '') || null,
      size: String(f.get('size') || '') || null,
      partNumber: String(f.get('partNumber') || '') || null,
      expiresAt: String(f.get('expiresAt') || '') || null,
    };
    const done = () => {
      qc.invalidateQueries({ queryKey: getListXStoreProductsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetXStoreDashboardQueryKey() });
      setDialog(false);
      setEdit(null);
      setNotice('تم حفظ بيانات المنتج');
    };
    if (edit) update.mutate({ productId: edit.id, data }, { onSuccess: done });
    else create.mutate({ data }, { onSuccess: done });
  }

  const changeQuantity = (p: Product, delta: number) =>
    update.mutate(
      { productId: p.id, data: { quantity: Math.max(0, p.quantity + delta) } },
      {
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: getListXStoreProductsQueryKey() }),
      },
    );
  const inventoryValue = (q.data || []).reduce(
    (total, product) => total + product.price * product.quantity,
    0,
  );

  return <>
    <PageTitle
      eyebrow="كتالوج المتجر"
      title="المخزون"
      desc="إدارة المنتجات والخيارات والكميات — سجّل تعديلات المخزون بوضوح."
      action={canManage
        ? <button className="button button-primary" onClick={() => { setEdit(null); setDialog(true); }} data-testid="button-add-product"><Plus size={17}/> إضافة منتج</button>
        : null}
    />
    <div className="stat-grid inventory-stats">
      <StatCard label="إجمالي المنتجات" value={fmt(q.data?.length || 0)} detail="منتجات مسجلة" icon={Package}/>
      <StatCard label="مخزون منخفض" value={fmt((q.data || []).filter(p => p.quantity <= 5).length)} detail="خمسة أو أقل" icon={AlertTriangle} tint="gold"/>
      <StatCard label="قيمة المخزون" value={isWarehouseManager ? '—' : money(inventoryValue)} detail={isWarehouseManager ? 'متاح لمالك المتجر فقط' : 'حسب سعر البيع'} icon={Banknote}/>
      <StatCard label="التصنيفات" value={fmt(new Set((q.data || []).map(p => p.category)).size)} detail="فئات المنتجات" icon={Boxes} tint="sage"/>
    </div>
    <Card>
      <SectionHead title="قائمة المنتجات" detail={`${fmt(rows.length)} منتج`}/>
      <div className="table-toolbar">
        <label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو SKU أو الباركود" data-testid="input-search-products"/></label>
        <button className="button button-quiet" onClick={() => q.refetch()}><RefreshCw size={15}/> تحديث</button>
      </div>
      {q.isLoading
        ? <StateBlock loading error={false} onRetry={() => q.refetch()} empty={false}/>
        : q.isError
          ? <StateBlock loading={false} error onRetry={() => q.refetch()} empty={false}/>
          : rows.length
            ? <div className="table-wrap"><table>
              <thead><tr><th>المنتج</th><th>SKU</th><th>التصنيف</th><th>الخيارات</th>{!isWarehouseManager && <th>السعر</th>}<th>الكمية</th><th>انتهاء الصلاحية</th>{canManage && <th>إجراء</th>}</tr></thead>
              <tbody>{rows.map(p => <tr key={p.id}>
                <td><b>{p.name}</b><small>{p.partNumber || p.barcode || '—'}</small></td>
                <td className="ltr-id">{p.sku}</td>
                <td>{p.category}</td>
                <td>{[p.color, p.size].filter(Boolean).join(' · ') || '—'}</td>
                {!isWarehouseManager && <td>{money(p.price)}</td>}
                <td><span className={`quantity ${p.quantity <= 5 ? 'quantity-low' : ''}`}>{fmt(p.quantity)}</span></td>
                <td>{dateLabel(p.expiresAt)}</td>
                {canManage && <td><div className="row-actions">
                  <button className="qty-control" aria-label="تقليل الكمية" onClick={() => changeQuantity(p, -1)}><Minus size={13}/></button>
                  <button className="qty-control" aria-label="زيادة الكمية" onClick={() => changeQuantity(p, 1)}><Plus size={13}/></button>
                  {!isWarehouseManager && <button className="table-action" onClick={() => { setEdit(p); setDialog(true); }} data-testid={`button-edit-product-${p.id}`}>تعديل</button>}
                </div></td>}
              </tr>)}</tbody>
            </table></div>
            : <div className="empty-inline">لا توجد منتجات تطابق البحث.</div>
      }
    </Card>
    {dialog && <Modal title={edit ? 'تعديل المنتج' : 'إضافة منتج'} close={() => { setDialog(false); setEdit(null); }}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="اسم المنتج" name="name" required defaultValue={edit?.name}/>
        <Field label="رمز SKU" name="sku" required defaultValue={edit?.sku}/>
        <Field label="الباركود" name="barcode" defaultValue={edit?.barcode || ''}/>
        <Field label="التصنيف" name="category" required defaultValue={edit?.category}/>
        {!isWarehouseManager && <>
          <Field label="سعر البيع" name="price" type="number" required defaultValue={edit ? String(edit.price) : ''}/>
          <Field label="سعر التكلفة" name="costPrice" type="number" required defaultValue={edit ? String(edit.costPrice ?? 0) : ''}/>
        </>}
        <Field label="الكمية" name="quantity" type="number" required defaultValue={edit ? String(edit.quantity) : '0'}/>
        <Field label="اللون" name="color" defaultValue={edit?.color || ''}/>
        <Field label="المقاس" name="size" defaultValue={edit?.size || ''}/>
        <Field label="رقم القطعة" name="partNumber" defaultValue={edit?.partNumber || ''}/>
        <Field label="تاريخ الصلاحية" name="expiresAt" type="date" defaultValue={edit?.expiresAt?.slice(0, 10) || ''}/>
        {isWarehouseManager && <div className="role-hint field-wide"><ShieldCheck size={16}/><span>يمكنك إضافة بيانات المنتج وتحديث الكمية؛ يحدد مالك المتجر الأسعار.</span></div>}
        {(create.isError || update.isError) && <div className="form-error">تعذر حفظ المنتج. يرجى مراجعة البيانات.</div>}
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={() => { setDialog(false); setEdit(null); }}>إلغاء</button>
          <button className="button button-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جارٍ الحفظ…' : 'حفظ المنتج'}</button>
        </div>
      </form>
    </Modal>}
    {notice && <div className="toast-note" role="status">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
  </>;
}
function PosPage() {
  const qc=useQueryClient(), products=useListXStoreProducts(), held=useListXStoreHeldSales(), checkout=useCheckoutXStoreSale(), hold=useHoldXStoreSale(), release=useReleaseXStoreHeldSale(), exchange=useCreateXStoreExchange();
  const [cart,setCart]=useState<Record<string,number>>({}),[term,setTerm]=useState(''),[discount,setDiscount]=useState('0'),[received,setReceived]=useState(''),[payment,setPayment]=useState<'cash'|'card'|'wallet'>('cash'),[heldOpen,setHeldOpen]=useState(false),[exchangeOpen,setExchangeOpen]=useState(false),[notice,setNotice]=useState('');
  const visible=(products.data||[]).filter(p=>`${p.name} ${p.sku} ${p.barcode||''}`.toLowerCase().includes(term.toLowerCase()));
  const cartLines=(products.data||[]).filter(p=>cart[p.id]).map(p=>({...p,count:cart[p.id]}));
  const subtotal=cartLines.reduce((s,p)=>s+p.price*p.count,0), disc=Math.min(subtotal,Math.max(0,Number(discount)||0)), tax=(subtotal-disc)*.15, total=subtotal-disc+tax;
  const add=(p:Product)=>setCart(c=>({...c,[p.id]:Math.min(p.quantity,(c[p.id]||0)+1)}));
  const mutateCart=(id:string,n:number)=>setCart(c=>{const value=(c[id]||0)+n;if(value<=0){const next={...c};delete next[id];return next}return {...c,[id]:value}});
  function finish(){if(!cartLines.length)return;checkout.mutate({data:{items:cartLines.map(p=>({productId:p.id,quantity:p.count})),discountAmount:disc,vatRate:.15,paymentMethod:payment,amountReceived:Number(received)||total}},{onSuccess:s=>{setCart({});setDiscount('0');setReceived('');qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});setNotice(`تمت عملية البيع · ${s.invoiceNo}`)}})}
  function park(){if(!cartLines.length)return;hold.mutate({data:{items:cartLines.map(p=>({productId:p.id,quantity:p.count}))}},{onSuccess:()=>{setCart({});qc.invalidateQueries({queryKey:getListXStoreHeldSalesQueryKey()});setNotice('تم حفظ الفاتورة المعلقة')}})}
  function submitExchange(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);exchange.mutate({data:{invoiceNo:String(f.get('invoiceNo')),returnItems:[{productId:String(f.get('returnProduct')),quantity:Number(f.get('returnQuantity'))}],replacementItems:[{productId:String(f.get('replacementProduct')),quantity:Number(f.get('replacementQuantity'))}],discountAmount:0,vatRate:.15,paymentMethod:String(f.get('paymentMethod')) as 'cash'|'card'|'wallet',amountReceived:Number(f.get('amountReceived'))||0}},{onSuccess:r=>{setExchangeOpen(false);setNotice(`تم الاستبدال ذرياً · ${r.exchangeInvoiceNo}`);qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()})}})}
  return <div className="pos-page"><PageTitle eyebrow="نقطة البيع" title="صندوق البيع" desc="أضف المنتجات وأكمل الدفع بخطوات قليلة." action={<div className="pos-head-actions"><button className="button button-quiet" onClick={()=>setExchangeOpen(true)}><ArrowLeftRight size={16}/> استبدال</button><button className="button button-quiet held-toggle" onClick={()=>setHeldOpen(!heldOpen)}><Pause size={16}/> فواتير معلقة <span className="count-bubble">{held.data?.length||0}</span></button></div>}/><div className="pos-layout"><section className="pos-products"><label className="search-box pos-search"><Search size={18}/><input autoFocus value={term} onChange={e=>setTerm(e.target.value)} placeholder="ابحث عن منتج أو امسح الباركود..." data-testid="input-pos-search"/><kbd>⌘ K</kbd></label>{products.isLoading?<div className="product-grid">{[1,2,3,4].map(i=><div className="product-skeleton" key={i}/>)}</div>:products.isError?<StateBlock loading={false} error onRetry={()=>products.refetch()} empty={false}/>:visible.length?<div className="product-grid">{visible.map((p,i)=><button key={p.id} onClick={()=>add(p)} disabled={!p.quantity} className={`product-tile ${!p.quantity?'tile-disabled':''}`} data-testid={`button-pos-product-${p.id}`}><span className={`product-art art-${i%5}`}><Package size={25}/>{cart[p.id]?<i>{cart[p.id]}</i>:null}</span><span className="tile-category">{p.category}</span><b>{p.name}</b><small className="ltr-id">{p.sku}</small><span className="tile-bottom"><strong>{money(p.price)}</strong><span>متاح {fmt(p.quantity)}</span></span></button>)}</div>:<div className="state-box"><div className="empty-symbol"><Package/></div><b>{term?'لا توجد نتائج':'لا توجد منتجات'}</b><span>{term?'جرّب البحث بكلمة مختلفة.':'أضف المنتجات إلى المخزون لتبدأ البيع.'}</span></div>}</section>
      <aside className="cart-panel"><div className="cart-head"><div><h2>الطلب الحالي</h2><span>{fmt(cartLines.reduce((a,p)=>a+p.count,0))} أصناف</span></div><button className="table-action" onClick={()=>setCart({})} disabled={!cartLines.length}><Trash2 size={14}/> تفريغ</button></div><div className="cart-lines">{cartLines.map(p=><div className="cart-line" key={p.id}><span className="cart-line-art"><Package size={17}/></span><div className="cart-line-title"><b>{p.name}</b><small>{money(p.price)}</small></div><div className="stepper"><button onClick={()=>mutateCart(p.id,-1)} aria-label="إنقاص"><Minus size={13}/></button><b>{p.count}</b><button onClick={()=>mutateCart(p.id,1)} aria-label="زيادة" disabled={p.count>=p.quantity}><Plus size={13}/></button></div><strong>{money(p.price*p.count)}</strong></div>)}{!cartLines.length&&<div className="cart-empty"><div className="cart-empty-icon"><ShoppingCart size={20}/></div><b>السلة فارغة</b><span>اختر منتجاً لإضافته إلى الفاتورة.</span></div>}</div><div className="cart-calculation"><div><span>المجموع الفرعي</span><b>{money(subtotal)}</b></div><label><span>الخصم</span><div className="discount-input"><input aria-label="قيمة الخصم" type="number" min="0" value={discount} onChange={e=>setDiscount(e.target.value)} disabled={!cartLines.length}/><span>ر.س</span></div></label><div><span>ضريبة القيمة المضافة · ١٥٪</span><b>{money(tax)}</b></div><div className="cart-total"><span>الإجمالي</span><b>{money(total)}</b></div></div><div className="payment-tabs">{(['cash','card','wallet'] as const).map((m,i)=>{const I=[Banknote,CreditCard,Wallet][i];return <button key={m} onClick={()=>setPayment(m)} className={payment===m?'payment-active':''}><I size={16}/>{paymentName(m)}</button>})}</div>{payment==='cash'&&<label className="received-field"><span>المبلغ المستلم</span><div><input type="number" min={total} value={received} onChange={e=>setReceived(e.target.value)} placeholder={fmt(total)} /><small>الباقي {money(Math.max(0,(Number(received)||total)-total))}</small></div></label>}<div className="cart-actions"><button className="button button-quiet" onClick={park} disabled={!cartLines.length||hold.isPending}><Pause size={15}/>{hold.isPending?'جارٍ الحفظ':'تعليق'}</button><button className="button button-confirm" onClick={finish} disabled={!cartLines.length||checkout.isPending|| (payment==='cash'&&Number(received)>0&&Number(received)<total)}>{checkout.isPending?'جارٍ إتمام البيع':<><CircleCheck size={17}/> إتمام البيع</>}</button></div>{(checkout.isError||hold.isError)&&<div className="form-error">تعذر تنفيذ العملية. أعد المحاولة.</div>}</aside></div>{notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}{heldOpen&&<Modal title="الفواتير المعلقة" close={()=>setHeldOpen(false)}><div className="held-list">{held.isLoading?<div className="skeleton-table"><span/><span/></div>:held.isError?<StateBlock loading={false} error onRetry={()=>held.refetch()} empty={false}/>:held.data?.length?held.data.map(h=><div className="held-item" key={h.id}><div><b className="ltr-id">{h.reference}</b><small>{h.customerName||'عميل نقدي'} · {fmt(h.itemCount)} أصناف</small></div><strong>{money(h.estimatedTotal)}</strong><button className="button button-primary button-small" onClick={()=>release.mutate({heldSaleId:h.id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListXStoreHeldSalesQueryKey()});setHeldOpen(false);setNotice('تم استعادة الفاتورة')}})}><Play size={14}/> استعادة</button></div>):<div className="empty-inline">لا توجد فواتير معلقة.</div>}</div></Modal>}{exchangeOpen&&<Modal title="استبدال منتج" close={()=>setExchangeOpen(false)}><form className="form-grid" onSubmit={submitExchange}><Field label="رقم الفاتورة الأصلية" name="invoiceNo" required placeholder="X-2048"/><label className="field"><span>المنتج المرتجع</span><select name="returnProduct" defaultValue="" required><option value="" disabled>اختر المنتج المرتجع</option>{products.data?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label><Field label="كمية المرتجع" name="returnQuantity" type="number" required defaultValue="1"/><label className="field"><span>المنتج البديل</span><select name="replacementProduct" defaultValue="" required><option value="" disabled>اختر المنتج البديل</option>{products.data?.filter(p=>p.quantity>0).map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku} · {money(p.price)}</option>)}</select></label><Field label="كمية المنتج البديل" name="replacementQuantity" type="number" required defaultValue="1"/><label className="field"><span>طريقة الدفع / التسوية</span><select name="paymentMethod"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="wallet">محفظة</option></select></label><Field label="المبلغ المستلم" name="amountReceived" type="number" defaultValue="0"/><div className="role-hint field-wide"><ArrowLeftRight size={17}/><span>يُسجل المرتجع والمنتج البديل كعملية واحدة ذرية؛ لا يتم حفظ نصف العملية.</span></div>{exchange.isError&&<div className="form-error">تعذر إتمام الاستبدال. تحقق من الفاتورة والكميات.</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={()=>setExchangeOpen(false)}>إلغاء</button><button className="button button-confirm" disabled={exchange.isPending}>{exchange.isPending?'جارٍ تنفيذ الاستبدال…':'تأكيد الاستبدال'}</button></div></form></Modal>}</div>;
}
function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const report = useGetXStoreProfitLossReport({ from, to });
  const data = report.data;

  return <>
    <PageTitle
      eyebrow="الأداء المالي"
      title="التقارير المالية"
      desc="ملخص المبيعات والمرتجعات وتكلفة البضائع والربح الإجمالي للفترة المحددة."
      action={<button className="button button-quiet" onClick={() => report.refetch()}><RefreshCw size={15}/> تحديث التقرير</button>}
    />
    <Card className="report-panel">
      <div className="report-filters" dir="rtl">
        <label className="field"><span>من تاريخ</span><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}/></label>
        <label className="field"><span>إلى تاريخ</span><input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}/></label>
        <span className="report-period">{data ? `${dateLabel(data.from)} — ${dateLabel(data.to)}` : 'اختر فترة التقرير'}</span>
      </div>
      {report.isLoading
        ? <div className="stat-grid">{[1, 2, 3, 4].map(i => <div className="stat-card stat-skeleton" key={i}/>)}</div>
        : report.isError
          ? <StateBlock loading={false} error onRetry={() => report.refetch()} empty={false}/>
          : data && <>
            <div className="stat-grid report-stats">
              <StatCard label="عدد الفواتير" value={fmt(data.salesCount)} detail="عمليات البيع في الفترة" icon={ReceiptText}/>
              <StatCard label="صافي المبيعات" value={money(data.netSales)} detail="بعد الخصومات وقبل المرتجعات" icon={Banknote} tint="gold"/>
              <StatCard label="قيمة المرتجعات" value={money(data.returnAmount)} detail="المبالغ المستردة" icon={RotateCcw} tint="red"/>
              <StatCard label="تكلفة البضائع" value={money(data.costOfGoodsSold)} detail="تكلفة الأصناف غير المرتجعة" icon={Boxes} tint="sage"/>
              <StatCard label="صافي الضريبة" value={money(data.taxCollected)} detail="بعد تسوية ضريبة المرتجعات" icon={ReceiptText} tint="gold"/>
            </div>
            <div className="report-profit"><span><Activity size={18}/> الربح الإجمالي</span><strong>{money(data.grossProfit)}</strong></div>
            <p className="report-disclaimer">الربح الإجمالي لا يشمل المصاريف التشغيلية. قيمة الضريبة ملخص للمبالغ المسجلة على الفواتير والمرتجعات.</p>
          </>
      }
    </Card>
  </>;
}

function SalesPage() {
  const qc=useQueryClient(), sales=useListXStoreSales({limit:100}), products=useListXStoreProducts(), ret=useCreateXStoreReturn();
  const isCashier=useGetXStoreSession().data?.role==='cashier';
  const [selected,setSelected]=useState<Sale|null>(null),[printTarget,setPrintTarget]=useState<Sale|null>(null),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
  const rows=(sales.data||[]).filter(s=>s.invoiceNo.toLowerCase().includes(search.toLowerCase()));
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);ret.mutate({data:{invoiceNo:String(f.get('invoiceNo')),productId:String(f.get('productId')),quantity:Number(f.get('quantity')),reason:String(f.get('reason'))}},{onSuccess:r=>{qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});setSelected(null);setNotice(`تم تسجيل المرتجع · ${money(r.refundAmount)}`)}})}
  return <><PageTitle eyebrow="حركة المتجر" title="المبيعات" desc="الفواتير الأخيرة وطرق الدفع والمرتجعات المسجلة." action={<button className="button button-quiet" onClick={()=>sales.refetch()}><RefreshCw size={15}/> تحديث القائمة</button>}/>{!isCashier&&<div className="stat-grid sales-stats"><StatCard label="عمليات ظاهرة" value={fmt(sales.data?.length||0)} detail="آخر ١٠٠ فاتورة" icon={ReceiptText}/><StatCard label="إجمالي المبيعات" value={money((sales.data||[]).reduce((a,s)=>a+s.total,0))} detail="حسب القائمة المحمّلة" icon={Banknote} tint="gold"/><StatCard label="نقداً" value={fmt((sales.data||[]).filter(s=>s.paymentMethod==='cash').length)} detail="عمليات نقدية" icon={Wallet} tint="sage"/><StatCard label="مرتجعة" value={fmt((sales.data||[]).filter(s=>s.status!=='completed').length)} detail="تتضمن استرداداً" icon={RotateCcw} tint="red"/></div>}<Card><SectionHead title="سجل الفواتير" detail="عرض الفواتير حسب الأحدث أولاً"/><div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث برقم الفاتورة" data-testid="input-search-sales"/></label><span className="result-count">{fmt(rows.length)} فاتورة</span></div>{sales.isLoading?<StateBlock loading error={false} onRetry={()=>sales.refetch()} empty={false}/>:sales.isError?<StateBlock loading={false} error onRetry={()=>sales.refetch()} empty={false}/>:rows.length?<SalesTable sales={rows} onReturn={s=>setSelected(s)} onPrint={s=>setPrintTarget(s)} showAmounts={!isCashier}/>:<div className="empty-inline">لا توجد فواتير تطابق البحث.</div>}</Card>{selected&&<Modal title={`تسجيل مرتجع · ${selected.invoiceNo}`} close={()=>setSelected(null)}><form className="form-grid" onSubmit={submit}><Field label="رقم الفاتورة" name="invoiceNo" defaultValue={selected.invoiceNo} required/><label className="field"><span>المنتج</span><select name="productId" required defaultValue=""><option value="" disabled>اختر المنتج</option>{products.data?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label><Field label="الكمية" name="quantity" type="number" required defaultValue="1"/><label className="field field-wide"><span>سبب الإرجاع</span><input name="reason" required placeholder="اكتب سبب الإرجاع"/></label>{ret.isError&&<div className="form-error">تعذر تسجيل المرتجع. تحقق من الفاتورة والمنتج.</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={()=>setSelected(null)}>إلغاء</button><button className="button button-primary" disabled={ret.isPending}>{ret.isPending?'جارٍ التسجيل…':'تأكيد المرتجع'}</button></div></form></Modal>}{printTarget&&<ReceiptModal sale={printTarget} close={()=>setPrintTarget(null)}/ >}{notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}</>;
}
function AuditPage() {
  const logs=useListXStoreAuditLogs();
  return <><PageTitle eyebrow="الشفافية والمساءلة" title="سجل التدقيق" desc="سجل موحد للإجراءات الحساسة — يعرض الفاعل والمتجر والكيان والتفاصيل." action={<button className="button button-quiet" onClick={()=>logs.refetch()}><RefreshCw size={15}/> تحديث السجل</button>}/><Card><SectionHead title="الإجراءات الأخيرة" detail="سجل للقراءة فقط · كل الأوقات بالتوقيت المحلي"/>{logs.isLoading?<StateBlock loading error={false} onRetry={()=>logs.refetch()} empty={false}/>:logs.isError?<StateBlock loading={false} error onRetry={()=>logs.refetch()} empty={false}/>:logs.data?.length?<AuditRows logs={logs.data}/>:<div className="state-box"><div className="empty-symbol"><ScrollText/></div><b>لا توجد إجراءات مسجلة</b><span>ستظهر هنا عمليات الإدارة الحساسة عند تنفيذها.</span></div>}</Card><div className="audit-privacy"><ShieldCheck size={18}/><span><b>سجل موثوق</b><small>هذا العرض للقراءة فقط. لا يمكن تعديل أو حذف السجلات من الواجهة.</small></span></div></>;
}
function AuditRows({logs}:{logs:any[]}) {
  return <div className="audit-list">{logs.map((log:any,i)=><div className="audit-row" key={log.id||i}><span className={`audit-icon audit-icon-${i%4}`}><Activity size={17}/></span><div className="audit-main"><b>{log.action}</b><small>{log.actorName} · {log.tenantName||'المنصة'} · {log.entityType}{log.entityId?` · ${log.entityId}`:''}</small><span>{log.details}</span></div><time>{dateLabel(log.createdAt)}</time></div>)}</div>;
}

function ClerkCacheInvalidator() {
  const { addListener }=useClerk(), qc=useQueryClient();
  useEffect(()=>{let previous:string|null|undefined=undefined;const off=addListener(({user})=>{const id=user?.id??null;if(previous!==undefined&&previous!==id)qc.clear();previous=id});return off},[addListener,qc]);
  return null;
}
function Routed() {
  const [,setLocation]=useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={arSA} routerPush={to=>setLocation(stripBase(to))} routerReplace={to=>setLocation(stripBase(to),{replace:true})}>
    <QueryClientProvider client={queryClient}><ClerkCacheInvalidator/><ErrorBoundary><Switch><Route path="/" component={HomeRedirect}/><Route path="/sign-in/*?" component={SignInPage}/><Route path="/sign-up/*?" component={SignUpPage}/><Route path="/dashboard" component={ProtectedLayout}/><Route path="/tenants" component={ProtectedLayout}/><Route path="/subscriptions" component={ProtectedLayout}/><Route path="/team" component={ProtectedLayout}/><Route path="/pos" component={ProtectedLayout}/><Route path="/inventory" component={ProtectedLayout}/><Route path="/reports" component={ProtectedLayout}/><Route path="/sales" component={ProtectedLayout}/><Route path="/audit-log" component={ProtectedLayout}/><Route path="/settings" component={ProtectedLayout}/><Route component={NotFound}/></Switch></ErrorBoundary></QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <TooltipProvider><WouterRouter base={basePath}><Routed/></WouterRouter><Toaster/></TooltipProvider>;
}
export default App;
