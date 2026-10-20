import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetXStoreAuthStatusQueryKey, getGetXStoreContactSettingsQueryKey, getGetXStoreDashboardQueryKey, getGetXStoreSessionQueryKey,
  getListXStoreHeldSalesQueryKey, getListXStoreProductsQueryKey,
  getListXStoreSalesQueryKey, getListXStoreTeamQueryKey, getListXStoreTenantsQueryKey,
  getListXStoreSubscriptionPaymentsQueryKey,
  logoutXStore, useAddXStoreTeamMember, useCreateInitialPlatformOwner, useCreateXStoreExchange, useCreateXStoreProduct, useCreateXStoreReturn,
  useCreateXStoreSubscriptionPayment, useCreateXStoreTenant, useGetXStoreDashboard, useGetXStoreSession, useHoldXStoreSale,
  useGetXStoreAuthStatus, useGetXStoreContactSettings, useLoginXStoreWithPhone,
  useListXStoreAuditLogs, useListXStoreHeldSales, useListXStoreProducts, useListXStoreSales,
  useGetXStoreProfitLossReport, useListXStoreSubscriptionPayments, useListXStoreTeam, useListXStoreTenants, useReleaseXStoreHeldSale, useUpdateXStoreProduct,
  useUpdateXStoreTenant, useUpdateXStoreTenantCredentials, useUpdateXStoreContactSettings, useUpdateXStoreStoreSettings, useCheckoutXStoreSale,
} from '@workspace/api-client-react';
import type { AuthStatus, HeldSale, Product, Tenant, Sale } from '@workspace/api-client-react';
import { Route, Switch, Redirect, Link, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { getProductIcon, matchesProductSearch, type ProductIconKind } from '@/lib/product-icons';
import { createWhatsAppInvoiceUrl, getWhatsAppDigits } from '@/lib/whatsapp-invoice';
import './auth-unified.css';
import {
  LayoutDashboard, Store, Package, ShoppingCart, ReceiptText, ScrollText, Search, Plus,
  Bell, LogOut, Menu, X, ArrowUpLeft, ChevronLeft, ChevronDown, CreditCard, Banknote,
  Wallet, CircleCheck, Clock3, AlertTriangle, RotateCcw,
  Pause, Play, Minus, Trash2, RefreshCw, CalendarDays, Users, Boxes, Activity, ShieldCheck, ArrowLeftRight, Printer,
  Settings2, KeyRound, Phone, Mail, MessageCircle, ArrowLeft, Eye, EyeOff, LockKeyhole, Smartphone, Database, Coffee, Utensils,
} from 'lucide-react';
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaSnapchat,
  FaTelegram,
  FaThreads,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from 'react-icons/fa6';
import type { IconType } from 'react-icons';
import PlatformBackupPage from '@/pages/platform-backup';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

type SocialLinkKey = keyof AuthStatus['socialLinks'];
type SocialLinkInputValues = Record<SocialLinkKey, string>;
type PublicSocialMethod = {
  key: SocialLinkKey | 'whatsapp';
  label: string;
  icon: IconType;
  color: string;
  href: string;
};
const SOCIAL_PLATFORMS: {
  key: SocialLinkKey;
  label: string;
  icon: IconType;
  color: string;
  placeholder: string;
}[] = [
  { key: 'facebook', label: 'Facebook', icon: FaFacebook, color: '#1877F2', placeholder: 'https://facebook.com/your-page' },
  { key: 'instagram', label: 'Instagram', icon: FaInstagram, color: '#C13584', placeholder: 'https://instagram.com/your-page' },
  { key: 'tiktok', label: 'TikTok', icon: FaTiktok, color: '#111827', placeholder: 'https://tiktok.com/@your-page' },
  { key: 'snapchat', label: 'Snapchat', icon: FaSnapchat, color: '#D7B600', placeholder: 'https://snapchat.com/add/your-page' },
  { key: 'x', label: 'X', icon: FaXTwitter, color: '#111111', placeholder: 'https://x.com/your-page' },
  { key: 'youtube', label: 'YouTube', icon: FaYoutube, color: '#FF0033', placeholder: 'https://youtube.com/@your-channel' },
  { key: 'linkedin', label: 'LinkedIn', icon: FaLinkedin, color: '#0A66C2', placeholder: 'https://linkedin.com/company/your-page' },
  { key: 'telegram', label: 'Telegram', icon: FaTelegram, color: '#229ED9', placeholder: 'https://t.me/your-page' },
  { key: 'threads', label: 'Threads', icon: FaThreads, color: '#111111', placeholder: 'https://threads.net/@your-page' },
  { key: 'pinterest', label: 'Pinterest', icon: FaPinterest, color: '#BD081C', placeholder: 'https://pinterest.com/your-page' },
];

function socialLinkInputs(links?: AuthStatus['socialLinks']): SocialLinkInputValues {
  return Object.fromEntries(SOCIAL_PLATFORMS.map(({ key }) => [key, links?.[key] ?? ''])) as SocialLinkInputValues;
}

function nullableSocialLinks(links: SocialLinkInputValues): AuthStatus['socialLinks'] {
  return {
    facebook: links.facebook.trim() || null,
    instagram: links.instagram.trim() || null,
    tiktok: links.tiktok.trim() || null,
    snapchat: links.snapchat.trim() || null,
    x: links.x.trim() || null,
    youtube: links.youtube.trim() || null,
    linkedin: links.linkedin.trim() || null,
    telegram: links.telegram.trim() || null,
    threads: links.threads.trim() || null,
    pinterest: links.pinterest.trim() || null,
  };
}

const fmt = (n: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(n);
type StoreCurrency = 'EGP' | 'SAR' | 'AED' | 'USD' | 'EUR' | 'GBP';
const currencyOptions: { value: StoreCurrency; label: string; shortLabel: string }[] = [
  { value: 'EGP', label: 'الجنيه المصري (EGP)', shortLabel: 'ج.م.' },
  { value: 'SAR', label: 'الريال السعودي (SAR)', shortLabel: 'ر.س' },
  { value: 'AED', label: 'الدرهم الإماراتي (AED)', shortLabel: 'د.إ' },
  { value: 'USD', label: 'الدولار الأمريكي (USD)', shortLabel: '$' },
  { value: 'EUR', label: 'اليورو (EUR)', shortLabel: '€' },
  { value: 'GBP', label: 'الجنيه الإسترليني (GBP)', shortLabel: '£' },
];
const currencyLabels = Object.fromEntries(currencyOptions.map(({ value, label }) => [value, label])) as Record<StoreCurrency, string>;
const currencyShortLabels = Object.fromEntries(currencyOptions.map(({ value, shortLabel }) => [value, shortLabel])) as Record<StoreCurrency, string>;
const CurrencyContext = createContext<StoreCurrency>('SAR');
function ProductIconSymbol({ symbol, kind }: { symbol: string; kind: ProductIconKind }) {
  if (kind === 'jacket') {
    return <svg className="product-symbol product-symbol-jacket" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m11.5 4.5 4.5 2.7 4.5-2.7 3.8 2 3.1 9-4.2 1.5-2-4.1V28H10.8V13.1l-2 4.1-4.2-1.5 3.1-9 3.8-2Z" fill="#71866a" stroke="#405744" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="m11.5 4.5 4.5 4 4.5-4M16 8.5V28" fill="none" stroke="#eee6cf" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.9 18h4v4h-4zM17.1 18h4v4h-4z" fill="#819579" stroke="#405744" strokeWidth=".75" strokeLinejoin="round"/>
      <circle cx="16" cy="13" r=".65" fill="#eee6cf"/>
    </svg>;
  }
  return <span className="product-symbol" aria-hidden="true">
    {symbol}
    {kind === 'phone-case' && <small className="phone-case-badge">🛡️</small>}
  </span>;
}
function useMoney() {
  const currency = useContext(CurrencyContext);
  return useCallback((amount: number) => new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount), [currency]);
}
const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
function checkoutErrorMessage(error: unknown): string {
  const data = error && typeof error === 'object' && 'data' in error
    ? (error as { data?: unknown }).data
    : null;
  const serverMessage = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
    ? data.error
    : '';
  if (serverMessage === 'The amount received is less than the total.') {
    return 'المبلغ المستلم أقل من إجمالي الفاتورة.';
  }
  if (serverMessage === 'A product is no longer available.') {
    return 'أحد المنتجات لم يعد متاحاً. حدّث قائمة المنتجات وحاول مرة أخرى.';
  }
  if (serverMessage === 'Store settings not found.') {
    return 'تعذر العثور على إعدادات المتجر. راجع إعدادات المتجر وحاول مرة أخرى.';
  }
  const stockError = serverMessage.match(/^Not enough stock for (.+)\. Available: (\d+)\.$/);
  if (stockError) {
    return `الكمية المتاحة من ${stockError[1]} هي ${stockError[2]} فقط. قلّل الكمية أو حدّث المخزون.`;
  }
  if (serverMessage) return `تعذر إتمام البيع: ${serverMessage}`;
  return 'تعذر إتمام البيع. تحقق من الاتصال والبيانات ثم حاول مرة أخرى.';
}
const dateLabel = (d?: string | null) => d ? new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';
const roleNames: Record<string, string> = { platform_admin: 'مالك المنصة', tenant_admin: 'مالك المتجر', cashier: 'أمين الصندوق', warehouse_manager: 'مدير المخزون', accountant: 'محاسب' };
const statusNames: Record<string, string> = { active: 'نشط', trial: 'تجريبي', suspended: 'موقوف', completed: 'مكتملة', partially_returned: 'مستردة جزئياً', returned: 'مستردة', monthly: 'شهري', half_yearly: 'نصف سنوي', annual: 'سنوي', lifetime: 'مدى الحياة' };
const founderSetupSchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسم المؤسس').max(100, 'الاسم طويل جدًا'),
  phone: z.string().min(8, 'أدخل رقم هاتف صحيحًا').max(20, 'رقم الهاتف طويل جدًا'),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(128, 'كلمة المرور طويلة جدًا'),
  setupSecret: z.string().min(32, 'رمز التأسيس يجب أن يتكون من 32 حرفًا على الأقل').max(512, 'رمز التأسيس طويل جدًا'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});
type FounderSetupValues = z.infer<typeof founderSetupSchema>;
const nav = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['all'] },
  { href: '/pos', label: 'نقطة البيع', icon: ShoppingCart, roles: ['tenant_admin', 'cashier'] },
  { href: '/tenants', label: 'المتاجر', icon: Store, roles: ['platform_admin'] },
  { href: '/subscriptions', label: 'الاشتراكات', icon: CreditCard, roles: ['platform_admin'] },
  { href: '/inventory', label: 'المخزون', icon: Package, roles: ['tenant_admin', 'warehouse_manager'] },
  { href: '/reports', label: 'التقارير المالية', icon: Activity, roles: ['platform_admin', 'tenant_admin', 'accountant'] },
  { href: '/sales', label: 'المبيعات', icon: ReceiptText, roles: ['tenant_admin', 'cashier', 'accountant'] },
  { href: '/audit-log', label: 'سجل التدقيق', icon: ScrollText, roles: ['platform_admin'] },
  { href: '/platform-backup', label: 'النسخ الاحتياطي', icon: Database, roles: ['platform_admin'] },
  { href: '/settings', label: 'إعدادات المنصة', icon: Settings2, roles: ['platform_admin'] },
  { href: '/store-settings', label: 'إعدادات المتجر', icon: Settings2, roles: ['tenant_admin'] },
  { href: '/team', label: 'فريق العمل', icon: Users, roles: ['tenant_admin'] },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" data-testid="link-brand"><img src={`${basePath}/x-store-mark.png`} alt="" /><span>X-Store</span>{!compact && <small>نظام إدارة متجرك</small>}</Link>;
}
function SiteFooter() {
  const { data: status } = useGetXStoreAuthStatus();
  const whatsappDigits = getWhatsAppDigits(status?.supportWhatsapp)
    || status?.supportWhatsapp?.replace(/[٠-٩۰-۹]/g, digit => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x660 && code <= 0x669 ? code - 0x660 : code - 0x6f0);
    }).replace(/\D/g, '')
    || '';
  const socialLinks: { key: string; label: string; icon: IconType; color: string; href?: string | null }[] = [
    { key: 'facebook', label: 'فيسبوك', icon: FaFacebook, color: '#1877F2', href: status?.socialLinks?.facebook },
    { key: 'whatsapp', label: 'واتساب', icon: FaWhatsapp, color: '#25D366', href: whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined },
    { key: 'instagram', label: 'إنستغرام', icon: FaInstagram, color: '#E4405F', href: status?.socialLinks?.instagram },
  ];

  return <footer className="site-footer" dir="rtl">
    <div className="site-footer-inner">
      <div className="site-footer-brand">
        <Logo compact/>
        <p>أدوات متجرك اليومية، في مساحة عمل واحدة واضحة.</p>
        <span className="site-footer-note"><ShieldCheck size={15}/> نظام إدارة متجرك</span>
        <div className="site-footer-social">
          <b>تابعنا على منصات التواصل</b>
          <div className="site-footer-social-links" aria-label="حسابات X-Store على منصات التواصل">
            {socialLinks.map(({ key, label, icon: Icon, color, href }) => href
              ? <a key={key} className="site-footer-social-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`X-Store على ${label}`} title={label}>
                  <Icon size={18} aria-hidden="true" style={{ color }}/>
                </a>
              : <span key={key} className="site-footer-social-link site-footer-social-link-disabled" aria-label={`رابط ${label} غير مضاف`} title={`أضف رابط ${label} من إعدادات التواصل`}>
                  <Icon size={18} aria-hidden="true" style={{ color }}/>
                </span>)}
          </div>
        </div>
      </div>
      <nav className="site-footer-nav" aria-label="روابط سريعة">
        <b>روابط سريعة</b>
        <Link href="/">الرئيسية</Link>
        <Link href="/contact">اتصل بنا</Link>
        <Link href="/sign-in">تسجيل الدخول</Link>
      </nav>
      <div className="site-footer-account">
        <span>مساحة عملك</span>
        <b>كل متجرك، في مكان واحد.</b>
        <Link href="/sign-in">دخول الحساب <ArrowUpLeft size={16}/></Link>
      </div>
    </div>
    <div className="site-footer-bottom">
      <span>© {new Date().getFullYear()} X-Store. جميع الحقوق محفوظة.</span>
      <span>إدارة أوضح. متجر أقوى.</span>
    </div>
    <span className="site-footer-glow" aria-hidden="true"/>
  </footer>;
}
function Home() {
  const [, go] = useLocation();
  return <>
  <main dir="rtl" className="landing">
    <header className="landing-nav"><Logo /><div className="landing-actions"><Link href="/contact" className="button button-quiet" data-testid="button-contact-us">اتصل بنا</Link><Link href="/sign-in" className="button button-primary">دخول الحساب <ArrowUpLeft size={16}/></Link></div></header>
    <section className="landing-hero">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> إدارة واضحة. يوم عمل أهدأ.</div><h1>كل متجرك،<br/><em>في مكان واحد.</em></h1><p>نقطة بيع سريعة ومخزون مرتب وتقارير موثوقة — أدوات يومية تساعد أصحاب المتاجر وفرقهم على العمل بثقة.</p><div className="hero-ctas"><button onClick={() => go('/sign-in')} className="button button-primary button-large" data-testid="button-start">دخول إلى حسابك <ChevronLeft size={18}/></button><button onClick={() => go('/sign-in')} className="text-link" data-testid="button-login">تحتاج حساباً؟ تواصل مع إدارة المنصة</button></div><div className="hero-proof"><span><CircleCheck size={16}/> إعداد بسيط</span><span><ShieldCheck size={16}/> بياناتك بأمان</span><span><Clock3 size={16}/> جاهز لليوم</span></div></div>
      <div className="hero-visual"><div className="dashboard-window"><div className="window-top"><span className="window-brand"><img src={`${basePath}/x-store-mark.png`}/> X-Store</span><span className="window-date">الأربعاء، ١٤ مايو</span><span className="window-avatar">م</span></div><div className="window-body" dir="rtl"><div className="window-greeting">مرحباً، متجر النخبة <span>صباح الخير</span></div><div className="mock-stats"><div><small>مبيعات اليوم</small><b>٤٬٨٢٠ <i>ر.س</i></b><span className="positive">↑ ١٢٪ عن أمس</span></div><div><small>الطلبات</small><b>٣٨</b><span>اليوم</span></div></div><div className="mock-chart"><div className="chart-title"><b>حركة المبيعات</b><span>آخر ٧ أيام</span></div><div className="bars">{[34,50,42,67,56,83,62,91,68,78,56,72,46,65].map((h,i)=><span key={i} style={{height:`${h}%`}} className={i===7?'bar-hot':''}/>)}</div><div className="chart-days"><span>السبت</span><span>الإثنين</span><span>الأربعاء</span><span>الجمعة</span></div></div><div className="mock-bottom"><span><i className="mini-stock"/> مخزون منخفض</span><b>٥ منتجات تحتاج متابعة</b><ChevronLeft size={14}/></div></div></div><div className="hero-float"><span className="float-check"><CircleCheck size={16}/></span><div><b>عملية بيع ناجحة</b><small>فاتورة X-2048 · منذ لحظات</small></div><strong>٢٤٥ ر.س</strong></div><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/></div>
    </section>
    <section className="landing-ribbon"><span>مصمم لروتين المتجر الحقيقي</span><b>من أول مسح للمنتج</b><i/><b>حتى إغلاق الوردية</b><i/><b>كل شيء واضح</b></section>
    <section className="feature-section"><div className="section-heading"><div className="eyebrow">أدوات يومية، بدون تعقيد</div><h2>تركيز على ما يحتاجه<br/>متجرك فعلاً.</h2><p>واجهة عربية مريحة وسير عمل مترابط يقلل الخطوات ويترك لك مساحة للاهتمام بعملائك.</p></div><div className="feature-grid"><article className="feature feature-large"><span className="feature-icon"><ShoppingCart size={21}/></span><div><h3>بيع أسرع عند الصندوق</h3><p>ابحث أو امسح الباركود، أضف الخصم واختر طريقة الدفع. شاشة واضحة تبقى سهلة القراءة طوال الوردية.</p><span className="feature-foot">نقطة بيع سريعة <ArrowUpLeft size={15}/></span></div><div className="feature-receipt"><div className="receipt-head">X-Store <span>فاتورة</span></div><div className="receipt-line">قميص قطني <b>١٢٠ ر.س</b></div><div className="receipt-line">حزام جلدي <b>٨٥ ر.س</b></div><div className="receipt-total">الإجمالي <b>٢٠٥ ر.س</b></div><span className="receipt-mark">تم الدفع</span></div></article><article className="feature"><span className="feature-icon feature-icon-gold"><Boxes size={21}/></span><h3>مخزون يعرف تفاصيله</h3><p>تابع المقاسات والألوان والكميات وتواريخ الصلاحية من قائمة واحدة.</p><div className="stock-preview"><span><i/> حذاء رياضي · ٣ ألوان</span><b>١٨ قطعة</b></div></article><article className="feature"><span className="feature-icon feature-icon-red"><Activity size={21}/></span><h3>صورة صادقة عن الأداء</h3><p>اطّلع على المبيعات والاشتراكات ونشاط المتجر حسب صلاحيتك.</p><div className="mini-metrics"><span>المبيعات <b>١٢٨</b></span><span>متاجر نشطة <b>٢٤</b></span></div></article></div></section>
    <section className="landing-quote"><div className="quote-mark">“</div><blockquote>عندما تكون الأرقام واضحة،<br/>تكون قرارات اليوم أسهل.</blockquote><span>صُمم لأصحاب المتاجر الذين يديرون التفاصيل كل يوم.</span><div className="quote-seal"><img src={`${basePath}/x-store-mark.png`} alt=""/></div></section>
    <section className="store-fit-section" aria-labelledby="store-fit-title">
      <div className="store-fit-inner">
        <div className="store-fit-heading">
          <div>
            <span className="store-fit-eyebrow">مجالات مختلفة، إدارة واحدة</span>
            <h2 id="store-fit-title">كل نشاط له تفاصيله،<br/><em>وإدارته تستحق الوضوح.</em></h2>
          </div>
          <div className="store-fit-heading-copy">
            <p>من نقطة البيع إلى المخزون وتقارير الأداء، X-Store يجمع أدوات يومك في تجربة واحدة مرتّبة.</p>
            <div className="store-fit-meta"><span><strong>٠٦</strong> قطاعات متنوعة</span><i aria-hidden="true"/><span>نظام واحد متكامل</span></div>
          </div>
        </div>
        <div className="store-fit-grid">
          <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">👕</span><h3>الملابس والأحذية</h3></article>
          <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">🛒</span><h3>البقالة والسوبرماركت</h3></article>
          <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">📱</span><h3>الإلكترونيات والإكسسوارات</h3></article>
          <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">💄</span><h3>العطور والتجميل</h3></article>
          <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">☕</span><h3>الكافيهات</h3></article>
          <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">🍽️</span><h3>المطاعم</h3></article>
        </div>
      </div>
    </section>
  </main>
  </>;
}
function ContactPage() {
  const contact = useGetXStoreAuthStatus();
  return <main dir="rtl" className="contact-page">
    <header className="contact-nav">
      <Logo/>
      <div className="contact-nav-actions">
        <Link href="/" className="contact-home-link">الرئيسية</Link>
        <Link href="/sign-in" className="button button-primary">دخول الحساب <ArrowUpLeft size={16}/></Link>
      </div>
    </header>
    <section className="contact-hero">
      <div className="contact-hero-copy">
        <span className="contact-eyebrow"><i/> مركز التواصل الرسمي</span>
        <h1>خلّينا نساعدك<br/><em>تكمّل شغلك بثقة.</em></h1>
        <p>تواصل مع إدارة X-Store بالطريقة الأنسب لك. كل قنوات التواصل الرسمية في مكان واحد.</p>
      </div>
      <div className="contact-hero-art" aria-hidden="true">
        <span className="contact-orbit contact-orbit-outer"/>
        <span className="contact-orbit contact-orbit-inner"/>
        <span className="contact-message-icon"><MessageCircle size={35} strokeWidth={1.6}/></span>
        <span className="contact-art-chip"><ShieldCheck size={15}/> قنوات التواصل الرسمية</span>
      </div>
    </section>
    <section className="contact-content">
      <div className="contact-options-panel">
        <div className="contact-section-heading">
          <span className="contact-section-kicker">قنوات التواصل</span>
          <h2>اختر الطريقة الأنسب لك</h2>
          <p>تقدر تتواصل مباشرة أو تتابعنا على منصات التواصل.</p>
        </div>
        {contact.isLoading
          ? <div className="contact-page-state" role="status"><span className="contact-state-icon"><Clock3 size={21}/></span><b>جارٍ تحميل معلومات التواصل</b><span>لحظات ونظهر لك طرق التواصل المتاحة.</span></div>
          : contact.isError
            ? <div className="contact-page-state contact-page-state-error" role="alert"><span className="contact-state-icon"><AlertTriangle size={21}/></span><b>تعذر تحميل معلومات التواصل</b><span>تحقق من الاتصال ثم أعد المحاولة.</span><button className="button button-quiet" type="button" onClick={()=>void contact.refetch()} data-testid="button-retry-contact"><RefreshCw size={15}/> إعادة المحاولة</button></div>
            : <ContactMethods status={contact.data} displayMode="page"/>}
      </div>
      <aside className="contact-help-panel">
        <span className="contact-help-icon"><MessageCircle size={20}/></span>
        <span className="contact-section-kicker">مساحة عملك</span>
        <h2>تحتاج مساعدة في حسابك؟</h2>
        <p>سجّل الدخول للوصول إلى حسابك وإدارة متجرك من مكان واحد.</p>
        <Link href="/sign-in" className="contact-login-link">الذهاب لتسجيل الدخول <ArrowUpLeft size={16}/></Link>
      </aside>
    </section>
  </main>;
}
function AuthPage({ kind }: { kind: 'in' | 'up' }) {
  const status = useGetXStoreAuthStatus();
  if (kind === 'up') return <Redirect to="/sign-in"/>;
  const bootstrapRequired = status.data?.bootstrapRequired === true;
  const founderSetupRequired = status.data?.founderSetupRequired === true;
  const setupRequired = bootstrapRequired || founderSetupRequired;
  return <main dir="rtl" className="auth-screen xsu-page">
    <div className="xsu-shell">
      <section className="xsu-brand" aria-label="هوية X-Store">
        <div className="xsu-brand-top">
          <Link href="/" className="xsu-brand-lockup" data-testid="link-brand" aria-label="X-Store — نظام إدارة متجرك">
            <span className="xsu-logo-frame"><img src={`${basePath}/x-store-mark.png`} alt=""/></span>
            <span className="xsu-brand-name">X-Store</span>
            <span className="xsu-brand-divider"/>
            <span className="xsu-brand-caption">نظام إدارة متجرك</span>
          </Link>
          <span className="xsu-secure-pill"><ShieldCheck size={15} strokeWidth={1.8}/><span>مساحة آمنة</span></span>
        </div>
        <div className="xsu-brand-copy">
          <span className="xsu-eyebrow"><span className="xsu-eyebrow-dot"/>يومك التجاري يبدأ بهدوء</span>
          <h2>كل تفاصيل<br/>متجرك، <em>في مكانها.</em></h2>
          <p>مساحة عمل واحدة تساعدك على متابعة شؤون متجرك بثقة، من أول اليوم إلى آخره.</p>
        </div>
        <div className="xsu-brand-footer">
          <span className="xsu-footer-mark"><LockKeyhole size={17} strokeWidth={1.7}/></span>
          <div><strong>عملك محفوظ بعناية</strong><span>دخول موثوق لفريقك، كل يوم.</span></div>
          <span className="xsu-footer-index">01 / 01</span>
        </div>
        <span className="xsu-orbit xsu-orbit-one" aria-hidden="true"/>
        <span className="xsu-orbit xsu-orbit-two" aria-hidden="true"/>
        <span className="xsu-orbit xsu-orbit-three" aria-hidden="true"/>
        <span className="xsu-brand-glint" aria-hidden="true"/>
      </section>
      <section className="xsu-login" aria-label="تسجيل الدخول إلى X-Store">
        <div className="xsu-login-inner">
          {status.isLoading
            ? <div className="auth-status-state" role="status">جارٍ التحقق من إعداد المنصة…</div>
            : status.isError
              ? <div className="auth-status-state" role="alert"><span>{apiErrorMessage(status.error, 'تعذر التحقق من إعداد حساب المالك.')}</span><button className="button button-quiet button-small" type="button" onClick={() => void status.refetch()} data-testid="button-retry-auth-status">إعادة المحاولة</button></div>
              : setupRequired
                ? <FounderSetupForm recoveringExistingOwner={bootstrapRequired}/>
                : <PhoneLoginForm/>}
          {status.data && <ContactMethods status={status.data}/>}
          {status.data && !setupRequired && <p className="xsu-footnote"><ShieldCheck size={14} strokeWidth={1.8}/><span>بياناتك تبقى خاصة وآمنة</span></p>}
        </div>
      </section>
    </div>
  </main>;
}
function PhoneLoginForm() {
  const login = useLoginXStoreWithPhone();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
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
  return <>
    <div className="xsu-heading">
      <div className="xsu-heading-icon"><Smartphone size={20} strokeWidth={1.75}/></div>
      <div><span className="xsu-heading-kicker">مرحباً بعودتك</span><h1 id="xsu-title">تسجيل الدخول</h1></div>
    </div>
    <p className="xsu-intro">أدخل بيانات حسابك للعودة إلى مساحة عملك.</p>
    <form className="xsu-form" onSubmit={submit}>
      <div className="xsu-field">
        <label className="xsu-field-label" htmlFor="signin-phone">رقم الهاتف</label>
        <span className="xsu-input-wrap"><Smartphone size={17} aria-hidden="true"/><input id="signin-phone" name="phone" type="tel" autoComplete="username" inputMode="tel" required placeholder="مثال: ‎+20 10 1234 5678"/></span>
      </div>
      <div className="xsu-field">
        <label className="xsu-field-label" htmlFor="signin-password">كلمة المرور</label>
        <span className="xsu-input-wrap">
          <LockKeyhole size={17} aria-hidden="true"/>
          <input id="signin-password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" required placeholder="أدخل كلمة المرور"/>
          <button className="xsu-visibility" type="button" onClick={()=>setShowPassword(visible=>!visible)} aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'} aria-pressed={showPassword}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button>
        </span>
      </div>
      {login.isError&&<div className="form-error xsu-login-error" role="alert">{apiErrorMessage(login.error,'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.')}</div>}
      <button className="button button-primary auth-submit xsu-submit" disabled={login.isPending}><span>{login.isPending?'جارٍ تسجيل الدخول…':'دخول إلى متجري'}</span><ArrowLeft size={17} strokeWidth={2} aria-hidden="true"/></button>
    </form>
  </>;
}
function FounderSetupForm({ recoveringExistingOwner }: { recoveringExistingOwner: boolean }) {
  const createOwner = useCreateInitialPlatformOwner();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const form = useForm<FounderSetupValues>({
    resolver: zodResolver(founderSetupSchema),
    defaultValues: { name: '', phone: '', password: '', setupSecret: '', confirmPassword: '' },
  });
  function submit(values: FounderSetupValues) {
    createOwner.mutate(
      { data: { name: values.name, phone: values.phone, password: values.password, setupSecret: values.setupSecret } },
      {
        onSuccess: (user) => {
          qc.setQueryData(getGetXStoreSessionQueryKey(), user);
          void qc.invalidateQueries({ queryKey: getGetXStoreAuthStatusQueryKey() });
          setLocation('/dashboard');
        },
        onError: () => {
          void qc.invalidateQueries({ queryKey: getGetXStoreAuthStatusQueryKey() });
        },
      },
    );
  }
  return <>
    <div className="auth-card-heading xsu-setup-heading"><span className="auth-icon"><ShieldCheck size={20}/></span><div><h1>{recoveringExistingOwner?'تفعيل حساب مالك المنصة':'إعداد حساب المؤسس'}</h1><p>{recoveringExistingOwner?'أكمل بيانات الدخول لحساب المالك الحالي.':'أنشئ الحساب الأول، وسيصبح مالك المنصة.'}</p></div></div>
    <Form {...form}>
      <form className="auth-form xsu-setup-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <FormField control={form.control} name="name" render={({ field }) => <FormItem className="field">
          <FormLabel>اسم المؤسس</FormLabel><FormControl><input {...field} autoComplete="name" maxLength={100} data-testid="input-founder-name" disabled={createOwner.isPending}/></FormControl><FormMessage/>
        </FormItem>}/>
        <FormField control={form.control} name="phone" render={({ field }) => <FormItem className="field">
          <FormLabel>رقم الهاتف</FormLabel><FormControl><input {...field} type="tel" autoComplete="tel" minLength={8} maxLength={20} placeholder="مثال: ‎+20 10 1234 5678" data-testid="input-founder-phone" disabled={createOwner.isPending}/></FormControl><FormMessage/>
        </FormItem>}/>
        <FormField control={form.control} name="password" render={({ field }) => <FormItem className="field">
          <FormLabel>كلمة المرور</FormLabel><FormControl><input {...field} type="password" autoComplete="new-password" minLength={1} maxLength={128} placeholder="اكتب كلمة المرور" data-testid="input-founder-password" disabled={createOwner.isPending}/></FormControl><FormMessage/>
        </FormItem>}/>
        <FormField control={form.control} name="setupSecret" render={({ field }) => <FormItem className="field">
          <FormLabel>رمز التأسيس السري</FormLabel><FormControl><input {...field} type="password" autoComplete="off" minLength={32} maxLength={512} data-testid="input-founder-secret" disabled={createOwner.isPending}/></FormControl><FormMessage/>
        </FormItem>}/>
        <FormField control={form.control} name="confirmPassword" render={({ field }) => <FormItem className="field">
          <FormLabel>تأكيد كلمة المرور</FormLabel><FormControl><input {...field} type="password" autoComplete="new-password" minLength={1} maxLength={128} data-testid="input-founder-confirm-password" disabled={createOwner.isPending}/></FormControl><FormMessage/>
        </FormItem>}/>
        {createOwner.isError && <div className="form-error" role="alert">{apiErrorMessage(createOwner.error, 'تعذر إنشاء حساب المالك. حاول مرة أخرى.')}</div>}
        <div className="role-hint"><ShieldCheck size={16}/><span>يُطلب الرمز لحماية الإعداد الأول فقط. في نسخة Replit جديدة، أضف XSTORE_BOOTSTRAP_SECRET إلى Secrets واستخدم قيمته هنا؛ لا تضعه في ملفات المشروع. بعد الإعداد، يختفي هذا النموذج.</span></div>
        <button className="button button-primary auth-submit" type="submit" disabled={createOwner.isPending}>{createOwner.isPending ? 'جارٍ حفظ بيانات المالك…' : recoveringExistingOwner?'حفظ بيانات الدخول':'إنشاء حساب المالك'}</button>
      </form>
    </Form>
  </>;
}
function ContactMethods({status,displayMode='compact'}:{status?:Pick<AuthStatus,'supportPhone'|'supportWhatsapp'|'supportEmail'|'socialLinks'>;displayMode?:'compact'|'page'}) {
  const methods=[
    status?.supportPhone&&{icon:Phone,label:'اتصال',href:`tel:${status.supportPhone}`,value:status.supportPhone},
    status?.supportEmail&&{icon:Mail,label:'البريد',href:`mailto:${status.supportEmail}`,value:status.supportEmail},
  ].filter(Boolean) as {icon:typeof Phone;label:string;href:string;value:string}[];
  const socialMethods:PublicSocialMethod[]=SOCIAL_PLATFORMS.flatMap(platform=>{
    const href=status?.socialLinks?.[platform.key];
    return href?[{...platform,href}]:[];
  });
  const whatsappDigits=getWhatsAppDigits(status?.supportWhatsapp)
    ||status?.supportWhatsapp?.replace(/[٠-٩۰-۹]/g,digit=>{
      const code=digit.charCodeAt(0);
      return String(code>=0x660&&code<=0x669?code-0x660:code-0x6f0);
    }).replace(/\D/g,'')
    ||'';
  if(whatsappDigits)socialMethods.splice(2,0,{
    key:'whatsapp',
    label:'WhatsApp',
    icon:FaWhatsapp,
    color:'#25D366',
    href:`https://wa.me/${whatsappDigits}`,
  });
  if(!methods.length&&!socialMethods.length)return displayMode==='page'
    ? <div className="contact-page-empty"><span className="contact-state-icon"><MessageCircle size={21}/></span><b>لا توجد قنوات تواصل مضافة حالياً</b><span>لم تُضف إدارة المنصة معلومات التواصل بعد.</span></div>
    : <div className="auth-contact-empty">لم تُضف إدارة المنصة معلومات التواصل بعد.</div>;
  if(displayMode==='page')return <>
    {!!methods.length&&<div className="contact-channel-grid">
      {methods.map(item=><a key={item.label} className="contact-channel-card" href={item.href}>
        <span className={`contact-channel-icon ${item.label==='البريد'?'contact-channel-icon-email':''}`}><item.icon size={21} strokeWidth={1.8}/></span>
        <span className="contact-channel-copy"><small>{item.label==='اتصال'?'تواصل هاتفي':'راسلنا'}</small><b>{item.label==='اتصال'?'اتصال مباشر':'البريد الإلكتروني'}</b><span>{item.value}</span></span>
        <ArrowUpLeft className="contact-channel-arrow" size={17}/>
      </a>)}
    </div>}
    {!!socialMethods.length&&<section className="contact-social-section" aria-label="حساباتنا على منصات التواصل">
      <div className="contact-social-heading"><b>تابعنا على منصات التواصل</b><span>حساباتنا الرسمية</span></div>
      <div className="contact-social-grid">
        {socialMethods.map(item=><a key={item.key} className="contact-social-card" href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`تابعنا على ${item.label}`}>
          <span className="contact-social-icon"><item.icon size={19} aria-hidden="true" style={{color:item.color}}/></span>
          <span>{item.label}</span><ArrowUpLeft size={14} className="contact-social-arrow"/>
        </a>)}
      </div>
    </section>}
  </>;
  return <div className="auth-contact-list">
    <span>تحتاج مساعدة؟ تواصل مع إدارة المنصة</span>
    {methods.map(item=><a key={item.label} href={item.href}><item.icon size={15}/><b>{item.label}</b><span>{item.value}</span></a>)}
    {!!socialMethods.length&&<div className="auth-social-links" aria-label="حساباتنا على منصات التواصل">
      {socialMethods.map(item=><a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`تابعنا على ${item.label}`} title={item.label}>
        <item.icon size={17} aria-hidden="true" style={{color:item.color}}/><span>{item.label}</span>
      </a>)}
    </div>}
  </div>;
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
  const [location] = useLocation(); const [open,setOpen] = useState(false);
  const qc=useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const { data:user, isLoading, isError, refetch } = useGetXStoreSession();
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutXStore();
      qc.clear();
      window.location.replace(`${basePath}/sign-in`);
    } catch {
      setLoggingOut(false);
      window.alert('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مرة أخرى.');
    }
  }
  if (isLoading) return <div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>;
  if (isError || !user) return <div className="auth-required" dir="rtl"><div className="empty-symbol"><ShieldCheck/></div><h2>يلزم تسجيل الدخول</h2><p>سجّل الدخول باستخدام حساب X-Store للوصول إلى مساحة العمل.</p><Link href="/sign-in" className="button button-primary">تسجيل الدخول</Link><button className="button button-quiet" onClick={()=>refetch()}>إعادة المحاولة</button></div>;
  const items = nav.filter(n=>n.roles.includes('all') || n.roles.includes(user.role));
   return <CurrencyContext.Provider value={(user.currency as StoreCurrency | null) || 'SAR'}><div dir="rtl" className="app-frame">
     <aside className={`sidebar ${open?'sidebar-open':''}`}><div className="sidebar-top"><Logo/><button className="icon-button sidebar-close" onClick={()=>setOpen(false)} aria-label="إغلاق القائمة"><X size={19}/></button></div><div className="store-chip"><span className="store-avatar">{(user.tenantName||user.name).slice(0,1)}</span><span><b>{user.tenantName || 'إدارة المنصة'}</b><small>{roleNames[user.role]||user.role}</small></span><ChevronDown size={15}/></div><div className="nav-caption">القائمة الرئيسية</div><nav className="side-nav">{items.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={`nav-link ${location===item.href?'nav-active':''}`} data-testid={`link-nav-${item.href.slice(1)}`}><item.icon size={18}/><span>{item.label}</span>{location===item.href&&<i/>}</Link>)}</nav><div className="sidebar-bottom"><div className="support-box"><span className="support-icon"><ShieldCheck size={17}/></span><b>كل شيء تحت السيطرة</b><p>بيانات المتجر محفوظة ومحدّثة.</p></div><div className="profile-row"><span className="profile-avatar">{user.name.slice(0,1)}</span><span className="profile-info"><b>{user.name}</b><small>{user.phone}</small></span><button type="button" className="icon-button" onClick={()=>void handleLogout()} disabled={loggingOut} title={loggingOut?'جارٍ تسجيل الخروج…':'تسجيل الخروج'} aria-label={loggingOut?'جارٍ تسجيل الخروج':'تسجيل الخروج'} data-testid="button-sign-out"><LogOut size={17}/></button></div></div></aside>
    {open&&<button aria-label="إغلاق القائمة" className="mobile-scrim" onClick={()=>setOpen(false)}/>}
    <div className="workspace"><header className="topbar"><button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={()=>setOpen(true)}><Menu size={20}/></button><div className="crumbs"><span>مساحة العمل</span><ChevronLeft size={14}/><b>{items.find(i=>i.href===location)?.label||'لوحة التحكم'}</b></div><div className="topbar-tools"><span className="today"><CalendarDays size={15}/> {new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span><button className="icon-button notification" aria-label="الإشعارات"><Bell size={18}/><i/></button><span className="top-avatar">{user.name.slice(0,1)}</span></div></header><main className="main-content">{children}</main></div>
   </div></CurrencyContext.Provider>;
}
function ProtectedLayout() {
  const [location] = useLocation(); const session=useGetXStoreSession();
  const allowed:Record<string,string[]>={'/tenants':['platform_admin'],'/subscriptions':['platform_admin'],'/settings':['platform_admin'],'/platform-backup':['platform_admin'],'/store-settings':['tenant_admin'],'/team':['tenant_admin'],'/pos':['tenant_admin','cashier'],'/inventory':['tenant_admin','warehouse_manager'],'/reports':['platform_admin','tenant_admin','accountant'],'/sales':['tenant_admin','cashier','accountant'],'/audit-log':['platform_admin']};
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
     <Route path="/platform-backup" component={PlatformBackupPage}/>
    <Route path="/store-settings" component={StoreSettingsPage}/>
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
  const money=useMoney();
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
  return <div className="table-wrap"><table><thead><tr><th>المتجر</th><th>المالك</th>{!compact&&<th>نوع النشاط</th>}<th>العملة</th><th>الحالة</th><th>الخطة</th>{!compact&&<th>الفروع</th>}</tr></thead><tbody>{tenants.map(t=><tr key={t.id}><td><b>{t.name}</b><small>{t.email||t.phone||'—'}</small></td><td>{t.ownerName}</td>{!compact&&<td>{t.businessType}</td>}<td>{currencyLabels[t.currency as StoreCurrency] || t.currency}</td><td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{statusNames[t.plan]}</td>{!compact&&<td>{fmt(t.branchCount)}</td>}</tr>)}</tbody></table></div>;
}
function SalesTable({sales,compact=false,onReturn,onPrint,showAmounts=true}:{sales:Sale[];compact?:boolean;onReturn?:(s:Sale)=>void;onPrint?:(s:Sale)=>void;showAmounts?:boolean}) {
  const money=useMoney();
  if(!sales.length)return <div className="empty-inline">لا توجد عمليات بيع لعرضها.</div>;
  return <div className="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الأصناف</th>{!compact&&<th>الدفع</th>}{showAmounts&&<th>الإجمالي</th>}<th>الحالة</th>{(onReturn||onPrint)&&<th>إجراء</th>}</tr></thead><tbody>{sales.map(s=><tr key={s.id}><td className="ltr-id">{s.invoiceNo}</td><td>{dateLabel(s.createdAt)}</td><td>{fmt(s.itemCount)}</td>{!compact&&<td>{paymentName(s.paymentMethod)}</td>}{showAmounts&&<td><b>{money(s.total)}</b></td>}<td><span className={`status-pill status-${s.status}`}>{statusNames[s.status]}</span></td>{(onReturn||onPrint)&&<td className="table-actions-cell">{onPrint&&<button className="table-action" onClick={()=>onPrint(s)} data-testid={`button-print-${s.id}`}><Printer size={14}/> إيصال</button>}{onReturn&&<button className="table-action" onClick={()=>onReturn(s)} data-testid={`button-return-${s.id}`}><RotateCcw size={14}/> مرتجع</button>}</td>}</tr>)}</tbody></table></div>;
}
function paymentName(p:string) { return p==='cash'?'نقداً':p==='card'?'بطاقة':'محفظة'; }
function createHeldInvoiceReference() { return `XS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,7).toUpperCase()}`; }
function heldWhatsAppMessage(held:HeldSale, products:Product[], money:(value:number)=>string) {
  const productNames=new Map(products.map(product=>[product.id,product.name]));
  return [
    `فاتورة معلّقة رقم ${held.reference}`,
    'الحالة: معلّقة - غير مدفوعة',
    `العميل: ${held.customerName||'عميل نقدي'}`,
    `التاريخ: ${dateLabel(held.createdAt)}`,
    'الأصناف:',
    ...held.items.map(item=>`- ${productNames.get(item.productId)||'منتج'} × ${fmt(item.quantity)} · ${money(item.unitPrice*item.quantity)}`),
    `الخصم: ${money(held.discountAmount)}`,
    `الإجمالي شامل الضريبة: ${money(held.estimatedTotal)}`,
    `طريقة الدفع المختارة: ${paymentName(held.paymentMethod)}`,
    'لم يتم استلام أي مبلغ بعد.',
    'شكراً لزيارتكم',
  ].join('\n');
}
function ReceiptModal({sale,close}:{sale:Sale;close:()=>void}) {
  const money=useMoney();
  const whatsappMessage=[
    `فاتورة بيع رقم ${sale.invoiceNo}`,
    `الحالة: ${sale.status==='completed'?'مدفوعة':statusNames[sale.status]}`,
    ...(sale.customerName?[`العميل: ${sale.customerName}`]:[]),
    `التاريخ: ${dateLabel(sale.createdAt)}`,
    `عدد الأصناف: ${fmt(sale.itemCount)}`,
    `طريقة الدفع: ${paymentName(sale.paymentMethod)}`,
    `المجموع الفرعي: ${money(sale.subtotal)}`,
    `الخصم: ${money(sale.discountAmount)}`,
    `الضريبة: ${money(sale.taxAmount)}`,
    `الإجمالي: ${money(sale.total)}`,
    `المبلغ المستلم: ${money(sale.amountReceived)}`,
    `الباقي: ${money(sale.changeAmount)}`,
    'شكراً لزيارتكم',
  ].join('\n');
  const whatsappUrl=createWhatsAppInvoiceUrl(sale.customerPhone,whatsappMessage);
  return <div className="modal-backdrop receipt-backdrop"><section className="modal receipt-modal" role="dialog" aria-modal="true" dir="rtl"><div className="receipt-brand"><img src={`${basePath}/x-store-mark.png`} alt=""/><b>X-Store</b><span>إيصال بيع</span></div><div className="receipt-number"><span>رقم الفاتورة</span><b className="ltr-id">{sale.invoiceNo}</b></div><div className="receipt-detail"><span>الحالة</span><b>{sale.status==='completed'?'مدفوعة':statusNames[sale.status]}</b></div>{sale.customerName&&<div className="receipt-detail"><span>اسم العميل</span><b>{sale.customerName}</b></div>}<div className="receipt-detail"><span>التاريخ</span><b>{dateLabel(sale.createdAt)}</b></div><div className="receipt-detail"><span>رقم هاتف العميل</span><b className="ltr-id">{sale.customerPhone||'—'}</b></div><div className="receipt-detail"><span>عدد الأصناف</span><b>{fmt(sale.itemCount)}</b></div><div className="receipt-detail"><span>طريقة الدفع</span><b>{paymentName(sale.paymentMethod)}</b></div><div className="receipt-divider"/><div className="receipt-detail"><span>المجموع الفرعي</span><b>{money(sale.subtotal)}</b></div><div className="receipt-detail"><span>الخصم</span><b>{money(sale.discountAmount)}</b></div><div className="receipt-detail"><span>الضريبة</span><b>{money(sale.taxAmount)}</b></div><div className="receipt-grand"><span>الإجمالي</span><b>{money(sale.total)}</b></div><div className="receipt-detail"><span>المبلغ المستلم</span><b>{money(sale.amountReceived)}</b></div><div className="receipt-detail"><span>الباقي</span><b>{money(sale.changeAmount)}</b></div><p className="receipt-thanks">شكراً لزيارتكم</p><div className="modal-actions receipt-actions"><button className="button button-quiet" onClick={close}>إغلاق</button>{whatsappUrl&&<a className="button button-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/> إرسال عبر واتساب</a>}<button className="button button-primary" onClick={()=>window.print()}><Printer size={16}/> طباعة الإيصال</button></div></section></div>;
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
  function changeCurrency(tenant:Tenant, currency:StoreCurrency, select:HTMLSelectElement) {
    if(currency===tenant.currency)return;
    if(!window.confirm('تغيير العملة لن يحوّل أسعار المنتجات أو المبيعات القديمة؛ ستظهر الأرقام كما هي بالعملة الجديدة. هل تريد المتابعة؟')) {
      select.value=tenant.currency;
      return;
    }
    update.mutate({tenantId:tenant.id,data:{currency}},{onSuccess:()=>{refreshTenants();setNotice(`تم تحديث العملة الأساسية لمتجر ${tenant.name}`);},onError:error=>{select.value=tenant.currency;setNotice(apiErrorMessage(error,'تعذر تحديث عملة المتجر.'))}});
  }
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
       currency:String(f.get('currency')) as StoreCurrency,
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
      {tenants.isLoading?<StateBlock loading error={false} onRetry={()=>tenants.refetch()} empty={false}/>:tenants.isError?<StateBlock loading={false} error onRetry={()=>tenants.refetch()} empty={false}/>:filtered.length?<div className="table-wrap"><table><thead><tr><th>المتجر</th><th>المالك</th><th>نوع النشاط</th><th>العملة الأساسية</th><th>الحالة</th><th>الخطة</th><th>انتهاء الاشتراك</th><th>الفروع</th><th>إجراء</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><b>{t.name}</b><small>{t.email||t.phone}</small></td><td>{t.ownerName}<small dir="ltr">{t.phone}</small></td><td>{t.businessType}</td><td><select aria-label={`تغيير العملة الأساسية لمتجر ${t.name}`} defaultValue={t.currency} disabled={update.isPending} onChange={e=>changeCurrency(t,e.currentTarget.value as StoreCurrency,e.currentTarget)}>{currencyOptions.map(currency=><option key={currency.value} value={currency.value}>{currency.label}</option>)}</select></td><td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{statusNames[t.plan]}</td><td>{dateLabel(t.subscriptionEndsAt)}</td><td>{fmt(t.branchCount)}</td><td><div className="table-actions-cell"><select aria-label={`تغيير حالة ${t.name}`} value={t.status} disabled={update.isPending} onChange={e=>update.mutate({tenantId:t.id,data:{status:e.target.value as 'active'|'trial'|'suspended'}},{onSuccess:()=>{refreshTenants();setNotice(`تم تحديث حالة ${t.name}`)}})}><option value="active">نشط</option><option value="trial">تجريبي</option><option value="suspended">إيقاف</option></select><button className="table-action" onClick={()=>setAccessTenant(t)}><KeyRound size={14}/> بيانات الدخول</button></div></td></tr>)}</tbody></table></div>:<div className="empty-inline">لا توجد متاجر تطابق البحث.</div>}
    </Card>
    {notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
    {dialog&&<Modal title="إضافة متجر وحساب مالكه" close={()=>setDialog(false)}><form className="form-grid" onSubmit={submit}>
      <Field label="اسم المتجر" name="name" required/><Field label="اسم المالك" name="ownerName" required/>
      <Field label="رقم هاتف الدخول" name="phone" type="tel" required placeholder="+20 10 1234 5678"/>
      <Field label="كلمة مرور المالك" name="ownerPassword" type="password" required maxLength={128} placeholder="اكتب كلمة المرور"/>
      <Field label="البريد الإلكتروني (اختياري)" name="email" type="email"/>
      <Field label="نوع النشاط" name="businessType" required placeholder="مثال: ملابس"/>
       <label className="field"><span>العملة الأساسية</span><select name="currency" defaultValue="SAR">{currencyOptions.map(currency=><option key={currency.value} value={currency.value}>{currency.label}</option>)}</select></label>
      <label className="field"><span>الخطة</span><select name="plan"><option value="monthly">شهري</option><option value="half_yearly">نصف سنوي</option><option value="annual">سنوي</option><option value="lifetime">مدى الحياة</option></select></label>
       <div className="role-hint field-wide"><Banknote size={16}/><span>ستُستخدم العملة لعرض أسعار المنتجات والمبيعات والتقارير. تغييرها لاحقاً لا يحوّل الأرقام المحفوظة.</span></div>
      <div className="role-hint field-wide"><ShieldCheck size={16}/><span>سيتم حفظ كلمة المرور مشفّرة فقط، ولن تظهر مرة أخرى بعد إنشاء الحساب.</span></div>
      {create.isError&&<div className="form-error">{apiErrorMessage(create.error,'تعذر إضافة المتجر. تحقق من الهاتف وكلمة المرور.')}</div>}
      <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setDialog(false)}>إلغاء</button><button className="button button-primary" disabled={create.isPending}>{create.isPending?'جارٍ الحفظ…':'إنشاء المتجر والحساب'}</button></div>
    </form></Modal>}
    {accessTenant&&<Modal title={`بيانات دخول المالك · ${accessTenant.name}`} close={()=>setAccessTenant(null)}><form className="form-grid" onSubmit={submitCredentials}>
      <Field label="رقم الهاتف" name="phone" type="tel" required defaultValue={accessTenant.phone||''}/>
      <Field label="كلمة مرور جديدة" name="password" type="password" required maxLength={128} placeholder="اكتب كلمة المرور الجديدة"/>
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
      <Field label="كلمة المرور" name="password" type="password" required maxLength={128} placeholder="اكتب كلمة المرور"/>
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
  const queryClient=useQueryClient();
  const settings=useGetXStoreContactSettings();
  const update=useUpdateXStoreContactSettings();
  const [values,setValues]=useState({
    supportPhone:'',
    supportWhatsapp:'',
    supportEmail:'',
    socialLinks:socialLinkInputs(),
  });
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(settings.data)setValues({
      supportPhone:settings.data.supportPhone||'',
      supportWhatsapp:settings.data.supportWhatsapp||'',
      supportEmail:settings.data.supportEmail||'',
      socialLinks:socialLinkInputs(settings.data.socialLinks),
    });
  },[settings.data]);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    update.mutate({data:{
      supportPhone:values.supportPhone.trim()||null,
      supportWhatsapp:values.supportWhatsapp.trim()||null,
      supportEmail:values.supportEmail.trim().toLowerCase()||null,
      socialLinks:nullableSocialLinks(values.socialLinks),
    }},{onSuccess:result=>{
      queryClient.setQueryData(getGetXStoreContactSettingsQueryKey(),result);
      void queryClient.invalidateQueries({queryKey:getGetXStoreAuthStatusQueryKey()});
      setNotice('تم تحديث معلومات التواصل وروابط التواصل الاجتماعي التي تظهر للزوار.');
    }});
  }
  return <><PageTitle eyebrow="إعدادات المنصة" title="معلومات التواصل" desc="تظهر هذه البيانات للزوار في زر اتصل بنا وصفحة تسجيل الدخول."/>
    <Card className="settings-card"><SectionHead title="وسائل التواصل" detail="اترك الحقل فارغاً لإخفائه من صفحة اتصل بنا."/>
      {settings.isLoading?<StateBlock loading error={false} onRetry={()=>settings.refetch()} empty={false}/>:settings.isError?<StateBlock loading={false} error onRetry={()=>settings.refetch()} empty={false}/>:<form className="form-grid settings-form" onSubmit={submit}>
        <label className="field"><span>رقم هاتف الدعم</span><input type="tel" value={values.supportPhone} onChange={e=>setValues({...values,supportPhone:e.target.value})} placeholder="+20 10 1234 5678"/></label>
        <label className="field"><span>رقم واتساب</span><input type="tel" value={values.supportWhatsapp} onChange={e=>setValues({...values,supportWhatsapp:e.target.value})} placeholder="+20 10 1234 5678"/><small className="field-hint">أدخل الرقم مع رمز الدولة؛ سيظهر للزوار كرابط واتساب تلقائيًا.</small></label>
        <label className="field field-wide"><span>البريد الإلكتروني للدعم</span><input type="email" value={values.supportEmail} onChange={e=>setValues({...values,supportEmail:e.target.value})} placeholder="support@example.com"/></label>
        <div className="social-settings-block field-wide">
          <div className="social-settings-heading">
            <div><b>روابط صفحات التواصل الاجتماعي</b><span>أضف رابط الصفحة، وسيظهر للزوار باسم المنصة وأيقونتها.</span></div>
            <span className="social-links-count">{SOCIAL_PLATFORMS.length} منصة</span>
          </div>
          <div className="social-settings-grid">
            {SOCIAL_PLATFORMS.map(platform=>{
              const Icon=platform.icon;
              return <label className="social-link-field" key={platform.key}>
                <span className="social-link-label">
                  <i className="social-brand-icon" style={{color:platform.color}}><Icon size={16} aria-hidden="true"/></i>
                  {platform.label}
                </span>
                <input
                  type="url"
                  value={values.socialLinks[platform.key]}
                  onChange={e=>setValues(current=>({
                    ...current,
                    socialLinks:{...current.socialLinks,[platform.key]:e.target.value},
                  }))}
                  placeholder={platform.placeholder}
                  maxLength={2048}
                  aria-label={`رابط صفحة ${platform.label}`}
                  data-testid={`input-social-link-${platform.key}`}
                />
              </label>;
            })}
          </div>
        </div>
        {update.isError&&<div className="form-error">{apiErrorMessage(update.error,'تعذر حفظ معلومات التواصل.')}</div>}
        {notice&&<div className="settings-success"><CircleCheck size={16}/>{notice}</div>}
        <div className="modal-actions"><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ الحفظ…':'حفظ معلومات التواصل'}</button></div>
      </form>}
    </Card>
  </>;
}
function StoreSettingsPage() {
  const qc=useQueryClient();
  const session=useGetXStoreSession();
  const update=useUpdateXStoreStoreSettings();
  const [vatPercent,setVatPercent]=useState('15');
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(session.data?.vatRate!=null)setVatPercent(String(session.data.vatRate*100));
  },[session.data?.vatRate]);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const percent=Number(vatPercent);
    if(!Number.isFinite(percent)||percent<0||percent>100)return;
    update.mutate({data:{vatRate:percent/100}},{onSuccess:settings=>{
      setVatPercent(String(settings.vatRate*100));
      qc.setQueryData(getGetXStoreSessionQueryKey(),current=>current?{...current,vatRate:settings.vatRate}:current);
      void qc.invalidateQueries({queryKey:getGetXStoreSessionQueryKey()});
      setNotice('تم تحديث نسبة ضريبة القيمة المضافة، وستُطبق على الفواتير الجديدة.');
    }});
  }
  return <><PageTitle eyebrow="إعدادات المتجر" title="ضريبة القيمة المضافة" desc="حدد النسبة التي تُحسب على فواتير البيع والاستبدال الجديدة."/>
    <Card className="settings-card"><SectionHead title="نسبة الضريبة" detail="تُحفظ النسبة للمتجر كله، وتظهر لأمناء الصندوق عند البيع."/>
      {session.isLoading?<StateBlock loading error={false} onRetry={()=>session.refetch()} empty={false}/>:session.isError?<StateBlock loading={false} error onRetry={()=>session.refetch()} empty={false}/>:<form className="form-grid settings-form" onSubmit={submit}>
        <label className="field field-wide"><span>نسبة ضريبة القيمة المضافة</span><div className="vat-rate-input"><input aria-label="نسبة ضريبة القيمة المضافة" type="number" min="0" max="100" step="0.01" required value={vatPercent} onChange={e=>{setVatPercent(e.target.value);setNotice('')}}/><span>%</span></div></label>
        <div className="role-hint field-wide"><ShieldCheck size={16}/><span>اكتب النسبة من ٠ إلى ١٠٠٪. تغييرها لا يعدّل الفواتير السابقة.</span></div>
        {update.isError&&<div className="form-error">{apiErrorMessage(update.error,'تعذر حفظ نسبة الضريبة.')}</div>}
        {notice&&<div className="settings-success"><CircleCheck size={16}/>{notice}</div>}
        <div className="modal-actions"><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ الحفظ…':'حفظ نسبة الضريبة'}</button></div>
      </form>}
    </Card>
  </>;
}
function SubscriptionsPage() {
  const qc=useQueryClient(), tenants=useListXStoreTenants(), payments=useListXStoreSubscriptionPayments(), update=useUpdateXStoreTenant(), createPayment=useCreateXStoreSubscriptionPayment();
  const money=useMoney();
  const [renewTenant,setRenewTenant]=useState<Tenant|null>(null),[paymentOpen,setPaymentOpen]=useState(false),[notice,setNotice]=useState('');
  function saveRenewal(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!renewTenant)return;const f=new FormData(e.currentTarget);update.mutate({tenantId:renewTenant.id,data:{plan:String(f.get('plan')) as 'monthly'|'half_yearly'|'annual'|'lifetime',subscriptionEndsAt:String(f.get('subscriptionEndsAt')),status:'active'}},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListXStoreTenantsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});setRenewTenant(null);setNotice('تم تحديث الخطة وتاريخ التجديد للمتجر المحدد')}})}
  function savePayment(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);createPayment.mutate({data:{tenantId:String(f.get('tenantId')),amount:Number(f.get('amount')),plan:String(f.get('plan')) as 'monthly'|'half_yearly'|'annual'|'lifetime',paymentMethod:String(f.get('paymentMethod')) as 'cash'|'card'|'transfer'}},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListXStoreSubscriptionPaymentsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});setPaymentOpen(false);setNotice('تم تسجيل الدفعة يدوياً')}})}
  const planNames:Record<string,string>={monthly:'شهري',half_yearly:'نصف سنوي',annual:'سنوي',lifetime:'مدى الحياة'};
  const payMethod:Record<string,string>={cash:'نقداً',card:'بطاقة',transfer:'تحويل بنكي'};
  return <><PageTitle eyebrow="الخطط والتحصيل" title="الاشتراكات" desc="تابع الخطة وموعد التجديد لكل متجر وسجّل الدفعات يدوياً." action={<button className="button button-primary" onClick={()=>setPaymentOpen(true)} data-testid="button-record-payment"><Plus size={16}/> تسجيل دفعة</button>}/><div className="stat-grid"><StatCard label="الاشتراكات النشطة" value={fmt((tenants.data||[]).filter(t=>t.status==='active').length)} detail="متاجر بخطة سارية" icon={ShieldCheck}/><StatCard label="تجريبية" value={fmt((tenants.data||[]).filter(t=>t.status==='trial').length)} detail="تحتاج متابعة التجديد" icon={Clock3} tint="gold"/><StatCard label="منتهية / موقوفة" value={fmt((tenants.data||[]).filter(t=>t.status==='suspended').length)} detail="حالة الاشتراك موقوفة" icon={AlertTriangle} tint="red"/><StatCard label="دفعات مسجلة" value={fmt(payments.data?.length||0)} detail="سجل التحصيل اليدوي" icon={Banknote} tint="sage"/></div><Card><SectionHead title="خطط المتاجر" detail="إجراء التجديد يحدّث خطة المتجر المحدد وتاريخ انتهاء اشتراكه."/><div className="table-wrap">{tenants.isLoading?<StateBlock loading error={false} onRetry={()=>tenants.refetch()} empty={false}/>:tenants.isError?<StateBlock loading={false} error onRetry={()=>tenants.refetch()} empty={false}/>:tenants.data?.length?<table><thead><tr><th>المتجر</th><th>الخطة الحالية</th><th>الحالة</th><th>تاريخ الانتهاء</th><th>الفروع</th><th>إجراء</th></tr></thead><tbody>{tenants.data.map(t=><tr key={t.id}><td><b>{t.name}</b><small>{t.ownerName} · {t.email}</small></td><td>{planNames[t.plan]}</td><td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{dateLabel(t.subscriptionEndsAt)}</td><td>{fmt(t.branchCount)}</td><td><button className="table-action" onClick={()=>setRenewTenant(t)} data-testid={`button-renew-${t.id}`}><RefreshCw size={14}/> تجديد / تعديل</button></td></tr>)}</tbody></table>:<div className="empty-inline">لا توجد اشتراكات مسجلة.</div>}</div></Card><Card className="payments-panel"><SectionHead title="سجل الدفعات" detail="دفعات الاشتراكات المسجلة يدوياً بواسطة مدير المنصة." action={<button className="text-link" onClick={()=>payments.refetch()}>تحديث <RefreshCw size={14}/></button>}/>{payments.isLoading?<StateBlock loading error={false} onRetry={()=>payments.refetch()} empty={false}/>:payments.isError?<StateBlock loading={false} error onRetry={()=>payments.refetch()} empty={false}/>:payments.data?.length?<div className="table-wrap"><table><thead><tr><th>المتجر</th><th>الخطة</th><th>طريقة الدفع</th><th>المبلغ</th><th>تاريخ التسجيل</th></tr></thead><tbody>{payments.data.map(p=><tr key={p.id}><td><b>{p.tenantName}</b></td><td>{planNames[p.plan]}</td><td>{payMethod[p.paymentMethod]}</td><td><b>{money(p.amount)}</b></td><td>{dateLabel(p.createdAt)}</td></tr>)}</tbody></table></div>:<div className="empty-inline">لم تُسجل دفعات بعد.</div>}</Card>{renewTenant&&<Modal title={`تجديد اشتراك · ${renewTenant.name}`} close={()=>setRenewTenant(null)}><form className="form-grid" onSubmit={saveRenewal}><label className="field"><span>الخطة الجديدة</span><select name="plan" defaultValue={renewTenant.plan}><option value="monthly">شهري</option><option value="half_yearly">نصف سنوي</option><option value="annual">سنوي</option><option value="lifetime">مدى الحياة</option></select></label><Field label="تاريخ الانتهاء" name="subscriptionEndsAt" type="date" required defaultValue={renewTenant.subscriptionEndsAt?.slice(0,10)||''}/><div className="role-hint field-wide"><ShieldCheck size={16}/><span>سيُعاد تفعيل هذا المتجر عند حفظ التجديد. لإثبات التحصيل، سجّل الدفعة بشكل منفصل.</span></div>{update.isError&&<div className="form-error">تعذر تحديث الاشتراك.</div>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setRenewTenant(null)}>إلغاء</button><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ التحديث…':'حفظ التجديد'}</button></div></form></Modal>}{paymentOpen&&<Modal title="تسجيل دفعة اشتراك" close={()=>setPaymentOpen(false)}><form className="form-grid" onSubmit={savePayment}><label className="field field-wide"><span>المتجر المعني</span><select name="tenantId" defaultValue="" required><option value="" disabled>اختر متجراً</option>{tenants.data?.map(t=><option key={t.id} value={t.id}>{t.name} · {t.ownerName}</option>)}</select></label><Field label="المبلغ المستلم" name="amount" type="number" required/><label className="field"><span>الخطة المدفوعة</span><select name="plan"><option value="monthly">شهري</option><option value="half_yearly">نصف سنوي</option><option value="annual">سنوي</option><option value="lifetime">مدى الحياة</option></select></label><label className="field field-wide"><span>طريقة الدفع</span><select name="paymentMethod"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل بنكي</option></select></label><div className="role-hint field-wide"><ShieldCheck size={16}/><span>سيُسجل اسم المتجر والخطة والمبلغ والطريقة في سجل الدفعات والتدقيق.</span></div>{createPayment.isError&&<div className="form-error">تعذر تسجيل الدفعة. تحقق من المتجر والمبلغ.</div>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setPaymentOpen(false)}>إلغاء</button><button className="button button-primary" disabled={createPayment.isPending}>{createPayment.isPending?'جارٍ التسجيل…':'تسجيل الدفعة'}</button></div></form></Modal>}{notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}</>;
}
function Field({label,name,type='text',required=false,placeholder='',defaultValue='',maxLength,min,step,className=''}:{label:string;name:string;type?:string;required?:boolean;placeholder?:string;defaultValue?:string;maxLength?:number;min?:number;step?:number;className?:string}) {return <label className={`field ${className}`.trim()}><span>{label}</span><input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} maxLength={maxLength} min={min} step={step}/></label>}
function Modal({title,close,children,className=''}:{title:string;close:()=>void;children:ReactNode;className?:string}) {return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className={`modal ${className}`.trim()} role="dialog" aria-modal="true"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="إغلاق"><X size={18}/></button></div>{children}</section></div>}
function InventoryPage() {
  const qc = useQueryClient();
  const q = useListXStoreProducts();
  const create = useCreateXStoreProduct();
  const update = useUpdateXStoreProduct();
  const session = useGetXStoreSession();
  const money=useMoney();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('__all__');
  const [stockFilter, setStockFilter] = useState<'all'|'low'|'out'>('all');
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const isWarehouseManager = session.data?.role === 'warehouse_manager';
  const canManage = session.data?.role === 'tenant_admin' || isWarehouseManager;
  const allProducts = q.data || [];
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,'ar'));
  const rows = allProducts.filter(p => {
    const matchesSearch = matchesProductSearch(p, search);
    const matchesCategory = categoryFilter === '__all__' || p.category === categoryFilter;
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'low' && p.quantity > 0 && p.quantity <= 5)
      || (stockFilter === 'out' && p.quantity <= 0);
    return matchesSearch && matchesCategory && matchesStock;
  });
  const lowStockCount = allProducts.filter(p => p.quantity > 0 && p.quantity <= 5).length;
  const outOfStockCount = allProducts.filter(p => p.quantity <= 0).length;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      name: String(f.get('name')),
      sku: edit?.sku ?? `XST-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
      barcode: String(f.get('barcode') || '') || null,
      category: edit ? edit.category : 'عام',
      price: isWarehouseManager ? 0 : Number(f.get('price')),
      costPrice: isWarehouseManager ? 0 : Number(f.get('costPrice') || 0),
      quantity: Number(f.get('quantity')),
      color: String(f.get('color') || '') || null,
      size: String(f.get('size') || '') || null,
      partNumber: String(f.get('partNumber') || '') || null,
      expiresAt: edit?.expiresAt?.slice(0, 10) || null,
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

  return <div className="inventory-page">
    <PageTitle
      eyebrow="كتالوج المتجر"
      title="المخزون"
      desc="تابع أرصدة المنتجات، ابحث بسرعة، وحدّث الكميات من مكان واحد."
      action={canManage
        ? <button className="button button-primary" onClick={() => { setEdit(null); setDialog(true); }} data-testid="button-add-product"><Plus size={17}/> إضافة منتج</button>
        : null}
    />
    <div className="stat-grid inventory-stats">
      <StatCard label="إجمالي المنتجات" value={q.isLoading?'—':fmt(allProducts.length)} detail="منتجات مسجلة في المتجر" icon={Package}/>
      <StatCard label="قريب من النفاد" value={q.isLoading?'—':fmt(lowStockCount)} detail="رصيد من ١ إلى ٥ وحدات" icon={AlertTriangle} tint="gold"/>
      <StatCard label="قيمة المخزون" value={isWarehouseManager ? '—' : money(inventoryValue)} detail={isWarehouseManager ? 'متاح لمالك المتجر فقط' : 'محسوبة بسعر البيع'} icon={Banknote}/>
      <StatCard label="التصنيفات" value={q.isLoading?'—':fmt(categories.length)} detail="فئات المنتجات المسجلة" icon={Boxes} tint="sage"/>
    </div>
    <Card className="inventory-catalog">
      <SectionHead title="المنتجات" detail={`${fmt(rows.length)} من ${fmt(allProducts.length)} منتج`}/>
      <div className="inventory-toolbar">
        <label className="search-box inventory-search"><Search size={19}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالعربي أو English أو بالكود والباركود" data-testid="input-search-products"/>
          {search&&<button type="button" className="inventory-clear-search" aria-label="مسح البحث" onClick={()=>setSearch('')}><X size={16}/></button>}
        </label>
        <label className="inventory-category-filter"><span>التصنيف</span><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} data-testid="select-inventory-category">
          <option value="__all__">كل التصنيفات</option>{categories.map(category=><option value={category} key={category}>{category}</option>)}
        </select></label>
        <button className="button button-quiet inventory-refresh" onClick={() => q.refetch()} data-testid="button-refresh-inventory"><RefreshCw size={16}/> تحديث</button>
      </div>
      <div className="inventory-filter-row" role="group" aria-label="تصفية المنتجات حسب الرصيد">
        <button type="button" className={`inventory-filter ${stockFilter==='all'?'is-active':''}`} aria-pressed={stockFilter==='all'} onClick={()=>setStockFilter('all')} data-testid="button-inventory-filter-all">كل المنتجات <span>{fmt(allProducts.length)}</span></button>
        <button type="button" className={`inventory-filter ${stockFilter==='low'?'is-active':''}`} aria-pressed={stockFilter==='low'} onClick={()=>setStockFilter('low')} data-testid="button-inventory-filter-low"><i className="stock-dot stock-dot-low"/>قريب من النفاد <span>{fmt(lowStockCount)}</span></button>
        <button type="button" className={`inventory-filter ${stockFilter==='out'?'is-active':''}`} aria-pressed={stockFilter==='out'} onClick={()=>setStockFilter('out')} data-testid="button-inventory-filter-out"><i className="stock-dot stock-dot-out"/>نفد المخزون <span>{fmt(outOfStockCount)}</span></button>
      </div>
      {q.isLoading
        ? <StateBlock loading error={false} onRetry={() => q.refetch()} empty={false}/>
        : q.isError
          ? <StateBlock loading={false} error onRetry={() => q.refetch()} empty={false}/>
          : rows.length
            ? <>
              <div className="inventory-desktop-view">
                <div className="table-wrap inventory-table-wrap"><table className="inventory-table">
                  <thead><tr><th>المنتج</th><th>رمز المنتج</th><th>التصنيف</th><th>المواصفات</th>{!isWarehouseManager && <th>سعر البيع</th>}<th>الرصيد</th>{canManage && <th>تحديث الكمية</th>}</tr></thead>
                  <tbody>{rows.map(p=>{const {symbol,tone,kind}=getProductIcon(p);return <tr key={p.id} data-testid={`row-inventory-product-${p.id}`}>
                    <td><div className="inventory-product"><span className={`inventory-product-icon art-${tone}`} data-product-icon={kind}><ProductIconSymbol symbol={symbol} kind={kind}/></span><span className="inventory-product-copy"><b>{p.name}</b><small>{p.partNumber?`رقم القطعة: ${p.partNumber}`:p.barcode?`باركود: ${p.barcode}`:'—'}</small></span></div></td>
                    <td className="ltr-id inventory-sku">{p.sku}</td>
                    <td><span className="inventory-category-chip">{p.category}</span></td>
                    <td><div className="inventory-variants">{p.color&&<span>{p.color}</span>}{p.size&&<span>{p.size}</span>}{!p.color&&!p.size&&<small>—</small>}</div></td>
                    {!isWarehouseManager && <td className="inventory-price">{money(p.price)}</td>}
                    <td><div className="inventory-quantity"><b className={`quantity ${p.quantity<=5?'quantity-low':''}`}>{fmt(p.quantity)}</b><span className={`inventory-stock-status ${p.quantity<=0?'is-out':p.quantity<=5?'is-low':'is-available'}`}>{p.quantity<=0?'نفد':p.quantity<=5?'منخفض':'متاح'}</span></div></td>
                    {canManage&&<td><div className="inventory-row-actions">
                      <button className="qty-control" aria-label={`تقليل كمية ${p.name}`} title="تقليل الكمية" disabled={p.quantity<=0} onClick={()=>changeQuantity(p,-1)} data-testid={`button-inventory-decrease-${p.id}`}><Minus size={16}/></button>
                      <button className="qty-control" aria-label={`زيادة كمية ${p.name}`} title="زيادة الكمية" onClick={()=>changeQuantity(p,1)} data-testid={`button-inventory-increase-${p.id}`}><Plus size={16}/></button>
                      {!isWarehouseManager&&<button className="inventory-edit-button" onClick={()=>{setEdit(p);setDialog(true)}} data-testid={`button-edit-product-${p.id}`}>تعديل البيانات</button>}
                    </div></td>}
                  </tr>})}</tbody>
                </table></div>
              </div>
              <div className="inventory-mobile-list">
                {rows.map(p=>{const {symbol,tone,kind}=getProductIcon(p);return <article className="inventory-mobile-card" key={p.id} data-testid={`card-inventory-product-${p.id}`}>
                  <div className="inventory-mobile-head"><div className="inventory-product"><span className={`inventory-product-icon art-${tone}`} data-product-icon={kind}><ProductIconSymbol symbol={symbol} kind={kind}/></span><span className="inventory-product-copy"><b>{p.name}</b><small className="ltr-id">{p.sku}</small></span></div><span className={`inventory-stock-status ${p.quantity<=0?'is-out':p.quantity<=5?'is-low':'is-available'}`}>{p.quantity<=0?'نفد المخزون':p.quantity<=5?'رصيد منخفض':'متاح'}</span></div>
                  <div className="inventory-mobile-details">
                    <div><small>التصنيف</small><b>{p.category}</b></div>
                    {!isWarehouseManager&&<div><small>سعر البيع</small><b>{money(p.price)}</b></div>}
                    <div><small>الكمية المتاحة</small><b className={p.quantity<=5?'quantity-low':''}>{fmt(p.quantity)} وحدة</b></div>
                    <div className="inventory-mobile-variants"><small>اللون والمقاس</small><b>{[p.color,p.size].filter(Boolean).join(' · ')||'—'}</b></div>
                    {(p.partNumber||p.barcode)&&<div className="inventory-mobile-variants"><small>بيانات إضافية</small><b>{p.partNumber?`رقم القطعة: ${p.partNumber}`:`باركود: ${p.barcode}`}</b></div>}
                  </div>
                  {canManage&&<div className="inventory-mobile-actions"><div><span>تحديث الكمية</span><button className="qty-control" aria-label={`تقليل كمية ${p.name}`} disabled={p.quantity<=0} onClick={()=>changeQuantity(p,-1)} data-testid={`button-inventory-mobile-decrease-${p.id}`}><Minus size={16}/></button><button className="qty-control" aria-label={`زيادة كمية ${p.name}`} onClick={()=>changeQuantity(p,1)} data-testid={`button-inventory-mobile-increase-${p.id}`}><Plus size={16}/></button></div>{!isWarehouseManager&&<button className="inventory-edit-button" onClick={()=>{setEdit(p);setDialog(true)}} data-testid={`button-edit-product-mobile-${p.id}`}>تعديل المنتج</button>}</div>}
                </article>})}
              </div>
            </>
            : <div className="inventory-empty" role="status" data-testid="status-inventory-empty"><span className="inventory-empty-icon"><Package size={24}/></span><b>{allProducts.length?'لا توجد منتجات مطابقة':'المخزون فارغ حتى الآن'}</b><span>{allProducts.length?'غيّر البحث أو الفلاتر لعرض منتجات أخرى.':'أضف منتجاتك لتبدأ متابعة الكميات والأسعار من هنا.'}</span>{(search||categoryFilter!=='__all__'||stockFilter!=='all')&&<button className="button button-quiet" onClick={()=>{setSearch('');setCategoryFilter('__all__');setStockFilter('all')}} data-testid="button-clear-inventory-filters">مسح البحث والفلاتر</button>}</div>
      }
    </Card>
    {dialog && <Modal className="product-modal" title={edit ? 'تعديل المنتج' : 'إضافة منتج'} close={() => { setDialog(false); setEdit(null); }}>
      <form className={`form-grid product-form ${isWarehouseManager ? 'product-form--warehouse' : ''}`} onSubmit={submit}>
        <div className="product-form-intro field-wide">
          <span className="product-form-icon"><Package size={21}/></span>
          <div className="product-form-intro-copy">
            <strong>{edit ? 'حدّث بيانات المنتج' : 'أضف منتجًا إلى مخزونك'}</strong>
            <span>رمز المنتج يُنشأ تلقائيًا، والتصنيف الافتراضي «عام».</span>
          </div>
          <span className="product-form-required-note"><i/> الحقول المطلوبة عليها علامة *</span>
        </div>
        <div className="product-form-section field-wide">
          <span className="product-form-section-number">01</span>
          <div><b>بيانات المنتج</b><small>الاسم والباركود للتعرّف عليه بسهولة.</small></div>
        </div>
        <Field className="product-form-field" label="اسم المنتج" name="name" required placeholder="مثال: تيشيرت قطني أسود" defaultValue={edit?.name}/>
        <Field className="product-form-field" label="الباركود (اختياري)" name="barcode" placeholder="اكتب الرقم أو امسح الكود" defaultValue={edit?.barcode || ''}/>
        <div className="product-form-section field-wide">
          <span className="product-form-section-number">02</span>
          <div>
            <b>{isWarehouseManager ? 'الكمية والمخزون' : 'السعر والمخزون'}</b>
            <small>{isWarehouseManager ? 'أدخل الكمية المتاحة؛ يحدد مالك المتجر الأسعار.' : 'أدخل أسعار الوحدة والكمية المتاحة.'}</small>
          </div>
        </div>
        {!isWarehouseManager && <>
          <Field className="product-form-field" label="سعر البيع" name="price" type="number" min={0} step={0.01} required placeholder="0.00" defaultValue={edit ? String(edit.price) : ''}/>
          <Field className="product-form-field" label="سعر التكلفة (اختياري)" name="costPrice" type="number" min={0} step={0.01} placeholder="اتركه فارغًا لو غير متاح" defaultValue={edit ? String(edit.costPrice ?? 0) : ''}/>
        </>}
        <Field className={`product-form-field ${isWarehouseManager ? 'field-wide' : ''}`} label="الكمية" name="quantity" type="number" min={0} step={1} required placeholder="0" defaultValue={edit ? String(edit.quantity) : '0'}/>
        <div className="product-form-section field-wide">
          <span className="product-form-section-number">03</span>
          <div><b>تفاصيل إضافية</b><small>كل هذه المعلومات اختيارية.</small></div>
        </div>
        <Field className="product-form-field" label="اللون (اختياري)" name="color" placeholder="مثال: أسود" defaultValue={edit?.color || ''}/>
        <Field className="product-form-field" label="المقاس (اختياري)" name="size" placeholder="مثال: M أو 42" defaultValue={edit?.size || ''}/>
        <Field className="product-form-field field-wide" label="رقم القطعة (اختياري)" name="partNumber" placeholder="رقم الموديل أو كود المورد" defaultValue={edit?.partNumber || ''}/>
        {isWarehouseManager && <div className="role-hint field-wide"><ShieldCheck size={16}/><span>يمكنك إضافة بيانات المنتج وتحديث الكمية؛ يحدد مالك المتجر الأسعار.</span></div>}
        {(create.isError || update.isError) && <div className="form-error">تعذر حفظ المنتج. يرجى مراجعة البيانات.</div>}
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={() => { setDialog(false); setEdit(null); }}>إلغاء</button>
          <button className="button button-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جارٍ الحفظ…' : 'حفظ المنتج'}</button>
        </div>
      </form>
    </Modal>}
    {notice && <div className="toast-note" role="status">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
  </div>;
}
function PosPage() {
  const qc=useQueryClient(), products=useListXStoreProducts(), held=useListXStoreHeldSales(), session=useGetXStoreSession(), checkout=useCheckoutXStoreSale(), hold=useHoldXStoreSale(), release=useReleaseXStoreHeldSale(), exchange=useCreateXStoreExchange();
  const money=useMoney(), currency=useContext(CurrencyContext);
  const vatRate=session.data?.vatRate??.15;
  const [cart,setCart]=useState<Record<string,number>>({}),[term,setTerm]=useState(''),[discount,setDiscount]=useState('0'),[received,setReceived]=useState(''),[payment,setPayment]=useState<'cash'|'card'|'wallet'>('cash'),[heldOpen,setHeldOpen]=useState(false),[exchangeOpen,setExchangeOpen]=useState(false),[notice,setNotice]=useState('');
  const [customerName,setCustomerName]=useState(''),[customerPhone,setCustomerPhone]=useState(''),[invoiceReference,setInvoiceReference]=useState(createHeldInvoiceReference),[receiptSale,setReceiptSale]=useState<Sale|null>(null);
  const customerWhatsappNumber=getWhatsAppDigits(customerPhone);
  const customerPhoneInvalid=Boolean(customerPhone.trim()&&!customerWhatsappNumber);
  const visible=(products.data||[]).filter(p=>matchesProductSearch(p,term));
  const cartLines=(products.data||[]).filter(p=>cart[p.id]).map(p=>({...p,count:cart[p.id]}));
  useEffect(()=>{if(!cartLines.length){if(customerPhone)setCustomerPhone('');if(customerName)setCustomerName('')}},[cartLines.length,customerPhone,customerName]);
  const subtotal=roundMoney(cartLines.reduce((s,p)=>s+p.price*p.count,0)), disc=Math.min(subtotal,roundMoney(Math.max(0,Number(discount)||0))), tax=roundMoney((subtotal-disc)*vatRate), total=roundMoney(subtotal-disc+tax);
  const add=(p:Product)=>setCart(c=>({...c,[p.id]:Math.min(p.quantity,(c[p.id]||0)+1)}));
  const mutateCart=(id:string,n:number)=>setCart(c=>{const value=(c[id]||0)+n;if(value<=0){const next={...c};delete next[id];return next}return {...c,[id]:value}});
  function finish(){if(!cartLines.length||customerPhoneInvalid)return;checkout.mutate({data:{invoiceNo:invoiceReference,items:cartLines.map(p=>({productId:p.id,quantity:p.count})),discountAmount:disc,paymentMethod:payment,amountReceived:roundMoney(Number(received)||total),customerName:customerName.trim()||null,customerPhone:customerPhone.trim()||null}},{onSuccess:s=>{setCart({});setDiscount('0');setReceived('');setCustomerName('');setCustomerPhone('');setInvoiceReference(createHeldInvoiceReference());setPayment('cash');setReceiptSale(s);qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});setNotice(`تمت عملية البيع · ${s.invoiceNo}`)}})}
  function park(){if(!cartLines.length||customerPhoneInvalid)return;hold.mutate({data:{reference:invoiceReference,items:cartLines.map(p=>({productId:p.id,quantity:p.count})),customerName:customerName.trim()||null,customerPhone:customerPhone.trim()||null,discountAmount:disc,paymentMethod:payment,amountReceived:roundMoney(Number(received)||0)}},{onSuccess:heldSale=>{setCart({});setDiscount('0');setReceived('');setCustomerName('');setCustomerPhone('');setInvoiceReference(createHeldInvoiceReference());setPayment('cash');qc.invalidateQueries({queryKey:getListXStoreHeldSalesQueryKey()});setNotice(`تم تعليق الفاتورة ${heldSale.reference}`)}})}
  function clearCurrentCart(){setCart({});setDiscount('0');setReceived('');setCustomerName('');setCustomerPhone('');setInvoiceReference(createHeldInvoiceReference())}
  function submitExchange(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);exchange.mutate({data:{invoiceNo:String(f.get('invoiceNo')),returnItems:[{productId:String(f.get('returnProduct')),quantity:Number(f.get('returnQuantity'))}],replacementItems:[{productId:String(f.get('replacementProduct')),quantity:Number(f.get('replacementQuantity'))}],discountAmount:0,paymentMethod:String(f.get('paymentMethod')) as 'cash'|'card'|'wallet',amountReceived:Number(f.get('amountReceived'))||0}},{onSuccess:r=>{setExchangeOpen(false);setNotice(`تم الاستبدال ذرياً · ${r.exchangeInvoiceNo}`);qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()})}})}
  return <>
    <div className="pos-page">
      <PageTitle eyebrow="نقطة البيع" title="صندوق البيع" desc="أضف المنتجات وأكمل الدفع بخطوات قليلة."
        action={<div className="pos-head-actions">
          <button className="button button-quiet" onClick={()=>setExchangeOpen(true)}><ArrowLeftRight size={16}/> استبدال منتج</button>
          <button className="button button-quiet held-toggle" onClick={()=>{const nextOpen=!heldOpen;setHeldOpen(nextOpen);if(nextOpen)void held.refetch()}}><Pause size={16}/> الفواتير المعلّقة <span className="count-bubble">{held.data?.length||0}</span></button>
        </div>}
      />
      <div className="pos-layout">
        <section className="pos-products">
          <label className="search-box pos-search"><Search size={18}/><input autoFocus value={term} onChange={e=>setTerm(e.target.value)} aria-label="البحث عن منتج بالعربي أو English أو مسح الباركود" placeholder="ابحث باسم المنتج بأي لهجة أو English..." data-testid="input-pos-search"/><kbd>⌘ K</kbd></label>
          {products.isLoading
            ? <div className="product-grid">{[1,2,3,4].map(i=><div className="product-skeleton" key={i}/>)}</div>
            : products.isError
              ? <StateBlock loading={false} error onRetry={()=>products.refetch()} empty={false}/>
              : visible.length
                ? <div className="product-grid">{visible.map(p=>{const {symbol,tone,kind}=getProductIcon(p);return <button key={p.id} onClick={()=>add(p)} disabled={!p.quantity} aria-label={`إضافة ${p.name} إلى الفاتورة`} className={`product-tile ${!p.quantity?'tile-disabled':''}`} data-testid={`button-pos-product-${p.id}`}>
                    <span className={`product-art art-${tone}`} data-product-icon={kind}><ProductIconSymbol symbol={symbol} kind={kind}/>{cart[p.id]?<i>{cart[p.id]}</i>:null}</span>
                    <span className="tile-category">{p.category}</span><b>{p.name}</b><small className="ltr-id">{p.sku}</small>
                    <span className="tile-bottom"><strong>{money(p.price)}</strong><span>متاح {fmt(p.quantity)}</span></span>
                  </button>})}</div>
                : <div className="state-box"><div className="empty-symbol"><Package/></div><b>{term?'لا توجد نتائج':'لا توجد منتجات'}</b><span>{term?'جرّب البحث بكلمة مختلفة.':'أضف المنتجات إلى المخزون لتبدأ البيع.'}</span></div>
          }
        </section>
        <aside className="cart-panel">
          <div className="cart-head"><div><h2>الطلب الحالي</h2><span>{fmt(cartLines.reduce((a,p)=>a+p.count,0))} أصناف</span></div><button className="table-action" onClick={clearCurrentCart} disabled={!cartLines.length}><Trash2 size={14}/> تفريغ</button></div>
          <div className="cart-invoice-number"><span>رقم الفاتورة</span><b className="ltr-id">{invoiceReference}</b></div>
          <div className="cart-lines">
            {cartLines.map(p=>{const {symbol,tone,kind}=getProductIcon(p);return <div className="cart-line" key={p.id}>
              <span className={`cart-line-art art-${tone}`} data-product-icon={kind}><ProductIconSymbol symbol={symbol} kind={kind}/></span><div className="cart-line-title"><b>{p.name}</b><small>{money(p.price)}</small></div>
              <div className="stepper"><button onClick={()=>mutateCart(p.id,-1)} aria-label="إنقاص"><Minus size={13}/></button><b>{p.count}</b><button onClick={()=>mutateCart(p.id,1)} aria-label="زيادة" disabled={p.count>=p.quantity}><Plus size={13}/></button></div>
              <strong>{money(p.price*p.count)}</strong>
            </div>})}
            {!cartLines.length&&<div className="cart-empty"><div className="cart-empty-icon"><ShoppingCart size={20}/></div><b>السلة فارغة</b><span>اختر منتجاً لإضافته إلى الفاتورة.</span></div>}
          </div>
          <div className="cart-calculation">
            <div><span>المجموع الفرعي</span><b>{money(subtotal)}</b></div>
            <label><span>الخصم</span><div className="discount-input"><input aria-label="قيمة الخصم" type="number" min="0" value={discount} onChange={e=>setDiscount(e.target.value)} disabled={!cartLines.length}/><span>{currencyShortLabels[currency]}</span></div></label>
            <div><span>ضريبة القيمة المضافة · {fmt(vatRate*100)}٪</span><b>{money(tax)}</b></div><div className="cart-total"><span>الإجمالي</span><b>{money(total)}</b></div>
          </div>
          <div className="payment-tabs">{(['cash','card','wallet'] as const).map((m,i)=>{const I=[Banknote,CreditCard,Wallet][i];return <button key={m} onClick={()=>setPayment(m)} className={payment===m?'payment-active':''}><I size={16}/>{paymentName(m)}</button>})}</div>
          {payment==='cash'&&<label className="received-field"><span>المبلغ المستلم</span><div><input type="number" min={total} value={received} onChange={e=>setReceived(e.target.value)} placeholder={fmt(total)}/><small>الباقي {money(Math.max(0,(Number(received)||total)-total))}</small></div></label>}
          <label className="customer-phone-field customer-name-field"><span><Users size={14}/> اسم العميل <em>اختياري</em></span><input type="text" maxLength={150} autoComplete="name" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="اكتب اسم العميل" aria-label="اسم العميل على الفاتورة" data-testid="input-customer-name" disabled={!cartLines.length}/></label>
          <label className="customer-phone-field"><span><Phone size={14}/> رقم هاتف العميل على الفاتورة <em>اختياري</em></span><input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="+20 10 1234 5678" aria-label="رقم هاتف العميل على الفاتورة" data-testid="input-customer-phone" disabled={!cartLines.length}/><small>اكتب الرقم بمفتاح الدولة لتفعيل الإرسال عبر واتساب.</small>{customerPhoneInvalid&&<small className="customer-phone-error" role="alert">تأكد من كتابة الرقم الدولي مع مفتاح الدولة، مثل +20.</small>}</label>
          <div className="cart-actions">
            <button className="button button-quiet" onClick={park} disabled={!cartLines.length||hold.isPending||customerPhoneInvalid}><Pause size={15}/>{hold.isPending?'جارٍ الحفظ':'تعليق'}</button>
            <button className="button button-confirm" onClick={finish} disabled={!cartLines.length||checkout.isPending||customerPhoneInvalid||(payment==='cash'&&Number(received)>0&&roundMoney(Number(received))<total)}>{checkout.isPending?'جارٍ إتمام البيع':<><CircleCheck size={17}/> إتمام البيع</>}</button>
          </div>
          {checkout.isError&&<div className="form-error" role="alert">{checkoutErrorMessage(checkout.error)}</div>}
          {hold.isError&&<div className="form-error" role="alert">تعذر حفظ الفاتورة المعلقة. تحقق من الاتصال وحاول مرة أخرى.</div>}
        </aside>
      </div>
      {notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
      {receiptSale&&<ReceiptModal sale={receiptSale} close={()=>setReceiptSale(null)}/>}
      {heldOpen&&<Modal title="الفواتير المعلّقة" close={()=>setHeldOpen(false)}><div className="held-list">
        {cartLines.length>0&&<div className="held-restore-hint">أفرغ الطلب الحالي قبل استعادة فاتورة معلّقة حتى لا تفقد بياناته.</div>}
        {held.isLoading?<div className="skeleton-table"><span/><span/></div>:held.isError?<StateBlock loading={false} error onRetry={()=>held.refetch()} empty={false}/>:held.data?.length?held.data.map(h=>{
          const whatsappUrl=createWhatsAppInvoiceUrl(h.customerPhone,heldWhatsAppMessage(h,products.data||[],money));
          return <div className="held-item" key={h.id}>
            <div className="held-item-main">
              <b className="ltr-id">{h.reference}</b>
              <small>{h.customerName||'عميل نقدي'} · {fmt(h.itemCount)} أصناف</small>
              <small className="held-status">معلّقة · غير مدفوعة</small>
            </div>
            <strong>{money(h.estimatedTotal)}</strong>
            <div className="held-actions">
              {whatsappUrl&&<a className="button button-whatsapp button-small" href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={`إرسال الفاتورة ${h.reference} عبر واتساب`}><MessageCircle size={14}/> واتساب</a>}
              <button className="button button-primary button-small" disabled={release.isPending||cartLines.length>0} onClick={()=>release.mutate({heldSaleId:h.id},{onSuccess:()=>{
                setCart(Object.fromEntries(h.items.map(item=>[item.productId,item.quantity])));
                setDiscount(String(h.discountAmount));
                setReceived(h.amountReceived?String(h.amountReceived):'');
                setPayment(h.paymentMethod);
                setCustomerName(h.customerName||'');
                setCustomerPhone(h.customerPhone||'');
                setInvoiceReference(h.reference);
                qc.invalidateQueries({queryKey:getListXStoreHeldSalesQueryKey()});
                setHeldOpen(false);
                setNotice(`تم استعادة الفاتورة ${h.reference} إلى شاشة الدفع`);
              }})}><Play size={14}/> استعادة</button>
            </div>
          </div>;
        }):<div className="empty-inline">لا توجد فواتير معلّقة.</div>}
        {release.isError&&<div className="form-error" role="alert">تعذر استعادة الفاتورة. حاول مرة أخرى.</div>}
      </div></Modal>}
      {exchangeOpen&&<Modal title="استبدال منتج" close={()=>setExchangeOpen(false)}><form className="form-grid" onSubmit={submitExchange}>
        <Field label="رقم الفاتورة الأصلية" name="invoiceNo" required placeholder="X-2048"/>
        <label className="field"><span>المنتج المرتجع</span><select name="returnProduct" defaultValue="" required><option value="" disabled>اختر المنتج المرتجع</option>{products.data?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
        <Field label="كمية المرتجع" name="returnQuantity" type="number" required defaultValue="1"/>
        <label className="field"><span>المنتج البديل</span><select name="replacementProduct" defaultValue="" required><option value="" disabled>اختر المنتج البديل</option>{products.data?.filter(p=>p.quantity>0).map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku} · {money(p.price)}</option>)}</select></label>
        <Field label="كمية المنتج البديل" name="replacementQuantity" type="number" required defaultValue="1"/>
        <label className="field"><span>طريقة الدفع / التسوية</span><select name="paymentMethod"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="wallet">محفظة</option></select></label>
        <Field label="المبلغ المستلم" name="amountReceived" type="number" defaultValue="0"/>
        <div className="role-hint field-wide"><ArrowLeftRight size={17}/><span>يُسجل المرتجع والمنتج البديل كعملية واحدة ذرية؛ لا يتم حفظ نصف العملية.</span></div>
        {exchange.isError&&<div className="form-error">تعذر إتمام الاستبدال. تحقق من الفاتورة والكميات.</div>}
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={()=>setExchangeOpen(false)}>إلغاء</button><button className="button button-confirm" disabled={exchange.isPending}>{exchange.isPending?'جارٍ تنفيذ الاستبدال…':'تأكيد الاستبدال'}</button></div>
      </form></Modal>}
    </div>
  </>;
}
function ReportsPage() {
  const money=useMoney();
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
  const money=useMoney();
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

function Routed() {
  return <ErrorBoundary><Switch><Route path="/" component={HomeRedirect}/><Route path="/contact" component={ContactPage}/><Route path="/sign-in/*?" component={SignInPage}/><Route path="/sign-up/*?" component={SignUpPage}/><Route path="/dashboard" component={ProtectedLayout}/><Route path="/tenants" component={ProtectedLayout}/><Route path="/subscriptions" component={ProtectedLayout}/><Route path="/team" component={ProtectedLayout}/><Route path="/pos" component={ProtectedLayout}/><Route path="/inventory" component={ProtectedLayout}/><Route path="/reports" component={ProtectedLayout}/><Route path="/sales" component={ProtectedLayout}/><Route path="/audit-log" component={ProtectedLayout}/><Route path="/settings" component={ProtectedLayout}/><Route path="/platform-backup" component={ProtectedLayout}/><Route path="/store-settings" component={ProtectedLayout}/><Route component={NotFound}/></Switch></ErrorBoundary>;
}
function App() {
  return <TooltipProvider><QueryClientProvider client={queryClient}><WouterRouter base={basePath}><div className="site-layout"><div className="site-route"><Routed/></div><SiteFooter/></div></WouterRouter></QueryClientProvider><Toaster/></TooltipProvider>;
}
export default App;
