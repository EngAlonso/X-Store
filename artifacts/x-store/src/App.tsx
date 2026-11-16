import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetXStoreAuthStatusQueryKey, getGetXStoreContactSettingsQueryKey, getGetXStoreDashboardQueryKey, getGetXStoreProfitLossReportQueryKey, getGetXStoreSessionQueryKey,
  getGetXStoreSaleInvoiceItemsQueryKey,
  getListXStoreHeldSalesQueryKey, getListXStoreProductsQueryKey,
  getListXStoreSalesQueryKey, getListXStoreTeamQueryKey, getListXStoreTenantsQueryKey,
  getListXStoreSubscriptionPaymentsQueryKey,
  logoutXStore, useAddXStoreTeamMember, useCreateInitialPlatformOwner, useCreateXStoreExchange, useCreateXStoreProduct, useCreateXStoreReturnBatch,
  useDeleteXStoreTeamMember, useUpdateXStoreTeamMember,
  useCreateXStoreSubscriptionPayment, useCreateXStoreTenant, useGetXStoreDashboard, useGetXStoreSession, useHoldXStoreSale,
  useIssueXStoreOfflineLicense,
  useGetXStoreAuthStatus, useGetXStoreContactSettings, useGetXStoreSaleInvoiceItems, useLoginXStoreWithPhone,
  useListXStoreAuditLogs, useListXStoreHeldSales, useListXStoreProducts, useListXStoreSales,
  useGetXStoreProfitLossReport, useListXStoreSubscriptionPayments, useListXStoreTeam, useListXStoreTenants, useReleaseXStoreHeldSale, useUpdateXStoreProduct,
  useUpdateXStoreTenant, useUpdateXStoreTenantCredentials, useUpdateXStoreContactSettings, useUpdateXStoreStoreSettings, useCheckoutXStoreSale,
} from '@workspace/api-client-react';
import type { AuthStatus, HeldSale, Product, Tenant, Sale, SaleInvoiceItem, SessionUser, TeamMember, TeamPermission } from '@workspace/api-client-react';
import { Route, Switch, Redirect, Link, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { getProductIcon, matchesProductSearch, type ProductIconKind } from '@/lib/product-icons';
import { APP_EGYPT_DATE_LOCALE, APP_NUMBER_LOCALE, APP_SAUDI_DATE_LOCALE, latinizeDigits } from '@/lib/formatting';
import { createWhatsAppInvoiceUrl, getWhatsAppDigits } from '@/lib/whatsapp-invoice';
import { getPhoneCountry, phoneCountries, phoneNumberForCountry, splitInternationalPhone } from '@/lib/phone-countries';
import './auth-unified.css';
import {
  LayoutDashboard, Store, Package, ShoppingCart, ReceiptText, ScrollText, Search, Plus,
  Bell, LogOut, Menu, X, ArrowUpLeft, ChevronLeft, ChevronDown, CreditCard, Banknote,
  Wallet, CircleCheck, Clock3, AlertTriangle, RotateCcw,
  Pause, Play, Minus, Trash2, RefreshCw, CalendarDays, Users, Boxes, Activity, ShieldCheck, ArrowLeftRight, Printer,
  Settings2, KeyRound, Phone, Mail, MessageCircle, ArrowLeft, ArrowUp, Eye, EyeOff, LockKeyhole, Smartphone, Database, Coffee, Utensils, Pencil, Bird,
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
import PlatformDatabasePage from '@/pages/platform-database';
import StoreBackupPage from '@/pages/store-backup';
import RestaurantMenuPage from '@/pages/restaurant-menu';
import PublicRestaurantMenu from '@/pages/public-restaurant-menu';
import type { OfflineActivationRequest } from './offline/licensing';
import { isOfflineHardwareFingerprint, type OfflineLicensePlan } from './offline/model';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

type SocialLinkKey = keyof AuthStatus['socialLinks'];
type SocialLinkInputValues = Record<SocialLinkKey, string>;
type InvoiceFormat = NonNullable<SessionUser['invoiceFormat']>;
const invoiceFormatOptions: {
  value: InvoiceFormat;
  label: string;
  detail: string;
  sampleClass: string;
}[] = [
  { value: 'wide', label: 'عريضة A5 (الحالي)', detail: 'التصميم الحالي، مناسب للطباعة على ورق A5.', sampleClass: 'wide' },
  { value: 'thermal_80mm', label: 'حراري 80 مم', detail: 'مناسب لرولات الطابعة الحرارية الكبيرة.', sampleClass: 'thermal-80' },
  { value: 'thermal_58mm', label: 'حراري 58 مم', detail: 'مناسب لرولات الطابعة الحرارية الصغيرة.', sampleClass: 'thermal-58' },
];
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

const fmt = (n: number) => new Intl.NumberFormat(APP_NUMBER_LOCALE, { maximumFractionDigits: 2 }).format(n);
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
const storeTypeOptions = [
  { value: 'clothing_shoes', label: 'الملابس والأحذية' },
  { value: 'grocery_supermarket', label: 'البقالة والسوبرماركت' },
  { value: 'electronics_accessories', label: 'الإلكترونيات والإكسسوارات' },
  { value: 'perfume_beauty', label: 'العطور والتجميل' },
  { value: 'cafe', label: 'الكافيهات' },
  { value: 'restaurant', label: 'المطاعم' },
  { value: 'poultry', label: 'الدواجن والفراخ' },
] as const;
function storeTypeName(value: string | null | undefined) {
  return storeTypeOptions.find((type) => type.value === value)?.label ?? 'غير محدد';
}
type SaleType = Sale['saleType'];
type RestaurantOrderType = 'internal' | 'external';
const wholesaleEligibleStoreTypes = new Set([
  'clothing_shoes',
  'grocery_supermarket',
  'electronics_accessories',
  'perfume_beauty',
]);
function storeTypeSupportsWholesale(value: string | null | undefined) {
  return Boolean(value && wholesaleEligibleStoreTypes.has(value));
}
function salePriceForProduct(product: Product, saleType: SaleType) {
  return saleType === 'wholesale' ? product.wholesalePrice : product.price;
}
const CurrencyContext = createContext<StoreCurrency>('SAR');
const XStoreSessionContext = createContext<SessionUser | null>(null);
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
  return useCallback((amount: number) => new Intl.NumberFormat(APP_NUMBER_LOCALE, {
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
  if (serverMessage === 'Enter the cash amount received and make sure it covers the total.') {
    return 'اكتب المبلغ النقدي المستلم، ويجب ألا يقل عن إجمالي الفاتورة.';
  }
  if (serverMessage === 'Enter the sender number for this transfer.') {
    return 'اكتب رقم أو حساب المرسل الذي حوّل المبلغ.';
  }
  if (serverMessage === 'A product is no longer available.') {
    return 'أحد المنتجات لم يعد متاحاً. حدّث قائمة المنتجات وحاول مرة أخرى.';
  }
  if (serverMessage === 'Store settings not found.') {
    return 'تعذر العثور على إعدادات المتجر. راجع إعدادات المتجر وحاول مرة أخرى.';
  }
  const stockError = serverMessage.match(/^Not enough stock for (.+)\. Available: (\d+)\.$/);
  if (stockError) {
    return `الكمية المتاحة من ${latinizeDigits(stockError[1])} هي ${latinizeDigits(stockError[2])} فقط. قلّل الكمية أو حدّث المخزون.`;
  }
  if (serverMessage) return `تعذر إتمام البيع: ${latinizeDigits(serverMessage)}`;
  return 'تعذر إتمام البيع. تحقق من الاتصال والبيانات ثم حاول مرة أخرى.';
}
const dateLabel = (d?: string | null) => d ? new Intl.DateTimeFormat(APP_SAUDI_DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';
const dateTimeLabel = (d?: string | null) => d ? new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(d)) : '—';
const roleNames: Record<string, string> = { platform_admin: 'مالك المنصة', tenant_admin: 'مالك المتجر', cashier: 'أمين الصندوق', warehouse_manager: 'مدير المخزون', accountant: 'محاسب', custom: 'دور مخصص' };
const teamPermissionOptions: { value: TeamPermission; label: string; description: string }[] = [
  { value: 'retail_sales', label: 'بيع قطاعي', description: 'إتمام الفواتير بسعر القطاعي ومعالجة فواتير القطاعي.' },
  { value: 'wholesale_sales', label: 'بيع جملة', description: 'إتمام الفواتير بسعر الجملة عند تفعيل قسم الجملة للمتجر.' },
  { value: 'warehouse_manager', label: 'إدارة المخزون', description: 'عرض المنتجات وتعديل الكميات دون تغيير أسعار المنتجات.' },
  { value: 'accountant', label: 'التقارير المالية', description: 'عرض التقارير المالية والمبيعات المسجلة.' },
  { value: 'collector', label: 'التحصيل', description: 'عرض حسابات العملاء وتسجيل التحصيل فقط.' },
];
const teamPermissionNames: Record<TeamPermission, string> = {
  retail_sales: 'بيع قطاعي',
  wholesale_sales: 'بيع جملة',
  cashier: 'نقطة البيع والمبيعات',
  warehouse_manager: 'إدارة المخزون',
  accountant: 'التقارير المالية',
  collector: 'التحصيل',
};
function normalizeTeamPermissions(permissions: TeamPermission[]): TeamPermission[] {
  const normalized = new Set<TeamPermission>(
    permissions.filter((permission) => permission !== 'cashier'),
  );
  if (permissions.includes('cashier')) {
    normalized.add('retail_sales');
    normalized.add('wholesale_sales');
  }
  return [...normalized];
}
function canSellSaleType(user: SessionUser | null | undefined, saleType: SaleType): boolean {
  if (!user) return false;
  if (user.role === 'platform_admin' || user.role === 'tenant_admin' || user.role === 'cashier') return true;
  if (user.role !== 'custom') return false;
  const permissions = user.permissions || [];
  return permissions.includes('cashier') || permissions.includes(saleType === 'retail' ? 'retail_sales' : 'wholesale_sales');
}
function hasAppRole(user: SessionUser | null | undefined, roles: readonly string[]): boolean {
  if (!user) return false;
  if (roles.includes(user.role)) return true;
  if (user.role !== 'custom') return false;
  const permissions = user.permissions || [];
  return permissions.some((permission) => roles.includes(permission)) ||
    (roles.includes('cashier') &&
      permissions.some((permission) => permission === 'retail_sales' || permission === 'wholesale_sales'));
}
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
  { href: '/platform-database', label: 'قاعدة البيانات', icon: Database, roles: ['platform_admin'] },
  { href: '/platform-backup', label: 'النسخ الاحتياطي', icon: Database, roles: ['platform_admin'] },
  { href: '/store-backup', label: 'النسخ الاحتياطي', icon: Database, roles: ['tenant_admin'] },
  { href: '/restaurant-menu', label: 'المنيو', icon: Utensils, roles: ['tenant_admin'] },
  { href: '/settings', label: 'إعدادات المنصة', icon: Settings2, roles: ['platform_admin'] },
  { href: '/store-settings', label: 'إعدادات المتجر', icon: Settings2, roles: ['tenant_admin'] },
  { href: '/team', label: 'فريق العمل', icon: Users, roles: ['tenant_admin'] },
  { href: '/poultry-customers', label: 'العملاء والحسابات', icon: Bird, roles: ['tenant_admin', 'cashier', 'accountant', 'custom'] },
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
      <span>صُنع بـ ❤️ في مصر</span>
    </div>
    <span className="site-footer-glow" aria-hidden="true"/>
  </footer>;
}
function Home() {
  const [, go] = useLocation();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return <>
    <main dir="rtl" className="landing landing-v2">
      <header className="landing-nav landing-nav-v2">
        <Logo />
        <nav className="landing-nav-links" aria-label="التنقل الرئيسي">
          <a href="#features">المميزات</a>
          <a href="#sectors">القطاعات</a>
          <Link href="/contact">تواصل معنا</Link>
        </nav>
        <div className="landing-actions">
          <Link href="/sign-in" className="landing-login-link">تسجيل الدخول</Link>
          <button onClick={() => go('/sign-in')} className="button button-primary landing-nav-cta">ابدأ الآن <ArrowUpLeft size={16}/></button>
        </div>
      </header>

      <section className="landing-hero landing-hero-v2">
        <div className="hero-copy hero-copy-v2">
          <div className="hero-kicker-v2"><span className="hero-kicker-dot"/> نظام واحد لإدارة يومك التجاري</div>
          <h1>إدارة متجرك<br/><em>بشكل أذكى وأبسط.</em></h1>
          <p>نقطة بيع سريعة، مخزون مرتب، وتقارير واضحة — كل الأدوات التي تحتاجها لإدارة شغلك من شاشة واحدة.</p>
          <div className="hero-ctas hero-ctas-v2">
            <button onClick={() => go('/sign-in')} className="button button-primary button-large">دخول إلى حسابك <ChevronLeft size={18}/></button>
            <Link href="/contact" className="hero-secondary-cta">تعرّف على X-Store <ArrowLeft size={17}/></Link>
          </div>
          <div className="hero-trust-v2">
            <span><CircleCheck size={16}/> واجهة عربية سهلة</span>
            <span><ShieldCheck size={16}/> صلاحيات وأمان</span>
            <span><Clock3 size={16}/> جاهز لروتينك اليومي</span>
          </div>
        </div>

        <div className="hero-visual hero-visual-v2" aria-label="معاينة لوحة تحكم X-Store">
          <div className="hero-glow-v2"/>
          <div className="dashboard-window dashboard-window-v2">
            <div className="window-top window-top-v2">
              <span className="window-brand"><img src={`${basePath}/x-store-mark.png`}/> X-Store</span>
              <span className="window-top-center">لوحة التحكم</span>
              <span className="window-avatar">م</span>
            </div>
            <div className="window-body window-body-v2">
              <div className="mock-sidebar-v2">
                <span className="mock-sidebar-active"><LayoutDashboard size={15}/> الرئيسية</span>
                <span><ShoppingCart size={15}/> نقطة البيع</span>
                <span><Package size={15}/> المخزون</span>
                <span><ReceiptText size={15}/> المبيعات</span>
              </div>
              <div className="mock-main-v2">
                <div className="mock-welcome-v2"><div><small>الأربعاء، 14 مايو</small><b>مرحباً، متجر النخبة</b></div><span className="mock-status-v2"><i/> المتجر مفتوح</span></div>
                <div className="mock-stats mock-stats-v2">
                  <div><small>مبيعات اليوم</small><b>4,820 <i>ر.س</i></b><span className="positive">↑ 12٪ عن أمس</span></div>
                  <div><small>الطلبات</small><b>38</b><span>اليوم</span></div>
                  <div><small>متوسط الفاتورة</small><b>127 <i>ر.س</i></b><span>↑ 8٪</span></div>
                </div>
                <div className="mock-chart mock-chart-v2">
                  <div className="chart-title"><b>حركة المبيعات</b><span>آخر 7 أيام</span></div>
                  <div className="bars">{[34,50,42,67,56,83,62,91,68,78,56,72,46,65].map((h,i)=><span key={i} style={{height:`${h}%`}} className={i===7?'bar-hot':''}/>)}</div>
                  <div className="chart-days"><span>السبت</span><span>الإثنين</span><span>الأربعاء</span><span>الجمعة</span></div>
                </div>
                <div className="mock-bottom mock-bottom-v2"><span><i className="mini-stock"/> مخزون منخفض</span><b>5 منتجات تحتاج متابعة</b><ChevronLeft size={14}/></div>
              </div>
            </div>
          </div>
          <div className="hero-float hero-float-v2"><span className="float-check"><CircleCheck size={16}/></span><div><b>عملية بيع ناجحة</b><small>فاتورة X-2048 · منذ لحظات</small></div><strong>245 ر.س</strong></div>
          <div className="hero-badge-v2"><span>+24%</span><small>نمو المبيعات</small><i>↗</i></div>
        </div>
      </section>

      <section className="landing-ribbon landing-ribbon-v2"><span>مصمم للمتجر الحقيقي</span><b>بيع أسرع</b><i/><b>مخزون أدق</b><i/><b>تقارير أوضح</b><i/><b>قرارات أذكى</b></section>

      <section id="features" className="feature-section feature-section-v2">
        <div className="feature-showcase">
          <div className="feature-showcase-heading">
            <div>
              <span className="feature-showcase-kicker">كل ما تحتاجه في مكان واحد</span>
              <h2>أدوات قوية، <em>بدون زحمة.</em></h2>
            </div>
            <p>صممنا X-Store حول المهام التي تتكرر كل يوم، عشان تشتغل أسرع وتفهم أرقامك بسهولة.</p>
          </div>

          <div className="feature-showcase-list">
            <article className="feature-showcase-item feature-showcase-primary">
              <div className="feature-item-number">01</div>
              <div className="feature-item-icon"><ShoppingCart size={22}/></div>
              <div className="feature-item-copy">
                <h3>نقطة بيع سريعة</h3>
                <p>ابحث عن المنتج أو امسح الباركود، أضف الخصم واختر طريقة الدفع — بخطوات قليلة وواضحة.</p>
                <span className="feature-item-link">شاشة مصممة للسرعة <ArrowUpLeft size={15}/></span>
              </div>
              <div className="feature-item-preview feature-receipt-clean">
                <div className="receipt-clean-head"><b>X-Store</b><span>فاتورة #2048</span></div>
                <div className="receipt-clean-row"><span>قميص قطني</span><b>120 ر.س</b></div>
                <div className="receipt-clean-row"><span>حزام جلدي</span><b>85 ر.س</b></div>
                <div className="receipt-clean-total"><span>الإجمالي</span><b>205 ر.س</b></div>
                <span className="receipt-clean-paid">تم الدفع ✓</span>
              </div>
            </article>

            <article className="feature-showcase-item">
              <div className="feature-item-number">02</div>
              <div className="feature-item-icon"><Boxes size={22}/></div>
              <div className="feature-item-copy">
                <h3>مخزون تحت السيطرة</h3>
                <p>تابع الكميات والمقاسات والألوان واعرف الأصناف التي تحتاج تدخل قبل ما تنفد.</p>
              </div>
              <div className="feature-item-preview stock-clean-preview">
                <span className="stock-clean-product"><i/> حذاء رياضي · 3 ألوان</span>
                <strong>18 قطعة</strong>
              </div>
            </article>

            <article className="feature-showcase-item">
              <div className="feature-item-number">03</div>
              <div className="feature-item-icon"><Activity size={22}/></div>
              <div className="feature-item-copy">
                <h3>أرقام تفهمها بسرعة</h3>
                <p>تقارير واضحة عن المبيعات والأداء تساعدك تاخد القرار الصح في الوقت الصح.</p>
              </div>
              <div className="feature-item-preview metrics-clean-preview">
                <div><span>المبيعات</span><b>128</b></div>
                <div><span>النمو</span><b>+24%</b></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="sectors" className="store-fit-section store-fit-section-v2">
        <div className="store-fit-inner">
          <div className="store-fit-heading store-fit-heading-v2">
            <div><span className="store-fit-eyebrow">مصمم لأنشطة مختلفة</span><h2>أيًّا كان نشاطك،<br/><em>إدارتك في مكان واحد.</em></h2></div>
            <div className="store-fit-heading-copy"><p>من الملابس والمطاعم إلى الإلكترونيات والسوبرماركت، X-Store يتكيف مع طريقة شغلك.</p><div className="store-fit-meta"><span><strong>06</strong> قطاعات</span><i/><span>نظام واحد متكامل</span></div></div>
          </div>
          <div className="store-fit-grid store-fit-grid-v2">
            {[
              ['👕','الملابس والأحذية'],['🛒','البقالة والسوبرماركت'],['📱','الإلكترونيات والإكسسوارات'],
              ['💄','العطور والتجميل'],['☕','الكافيهات'],['🍽️','المطاعم']
            ].map(([icon,title])=><article className="store-fit-card store-fit-card-v2" key={title}><span className="store-fit-icon">{icon}</span><div><h3>{title}</h3><span>إدارة سهلة ومتخصصة</span></div><ArrowUpLeft size={16}/></article>)}
          </div>
        </div>
      </section>

      <section className="landing-quote landing-quote-v2">
        <div className="quote-v2-content"><span className="quote-kicker-v2">X-STORE</span><blockquote>خلّي النظام يهتم بالتفاصيل،<br/><em>وأنت اهتم بنمو متجرك.</em></blockquote><span>أدوات يومية واضحة لأصحاب المتاجر وفرقهم.</span><button onClick={() => go('/sign-in')} className="button button-light-v2">ابدأ إدارة متجرك <ArrowLeft size={17}/></button></div>
        <div className="quote-v2-mark"><img src={`${basePath}/x-store-mark.png`} alt=""/></div>
      </section>

      {showScrollTop && (
        <button
          type="button"
          className="landing-scroll-top"
          onClick={scrollToTop}
          aria-label="العودة إلى أعلى الصفحة"
          title="العودة إلى أعلى الصفحة"
        >
          <ArrowUp size={19} strokeWidth={2.4}/>
        </button>
      )}
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
      onSuccess: async user => {
        const sessionKey = getGetXStoreSessionQueryKey();
        await qc.cancelQueries({ queryKey: sessionKey });
        qc.setQueryData(sessionKey, user);
        void qc.invalidateQueries({ queryKey: getGetXStoreAuthStatusQueryKey() });
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

function AppShell({ children, user, refetch }: { children: ReactNode; user: SessionUser; refetch: () => unknown }) {
  const isPoultryStore = user.storeType === 'poultry';
  const [location, setLocation] = useLocation(); const [open,setOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || event.changedTouches.length !== 1) return;
      if (window.matchMedia('(max-width: 900px)').matches === false) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      if (dx < 0) setOpen(true);
      else setOpen(false);
    };
    const handleTouchCancel = () => { touchStartRef.current = null; };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const notificationProducts = useListXStoreProducts(undefined, { query: { refetchInterval: 30000, enabled: !isPoultryStore } });
  const notificationSales = useListXStoreSales({ limit: 100 }, { query: { refetchInterval: 30000, enabled: !isPoultryStore } });
  const [poultryNotifications, setPoultryNotifications] = useState<any[]>([]);
  const qc=useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => { if (!user || user.storeType !== 'poultry') { setPoultryNotifications([]); return; } let cancelled=false; const load=()=>fetch('/api/xstore/poultry/notifications',{credentials:'include'}).then(async r=>r.ok?r.json():[]).then(v=>{if(!cancelled)setPoultryNotifications(Array.isArray(v)?v:[])}).catch(()=>{}); void load(); const timer=window.setInterval(load,30000); return()=>{cancelled=true;window.clearInterval(timer)}; }, [user?.id,user?.storeType]);
  useEffect(() => { if (!user) return; try { setReadNotificationIds(JSON.parse(localStorage.getItem(`xstore-notifications:${user.id}`) || '[]') as string[]); } catch { setReadNotificationIds([]); } }, [user?.id]);
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutXStore();
      qc.clear();
      setOpen(false);
      setLocation('/sign-in');
    } catch {
      setLoggingOut(false);
      window.alert('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مرة أخرى.');
    }
  }
  const [restaurantFeatureEnabled, setRestaurantFeatureEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user || user.role !== 'tenant_admin' || (user.storeType !== null && user.storeType !== undefined)) {
      setRestaurantFeatureEnabled(null);
      return;
    }
    let cancelled = false;
    void fetch('/api/xstore/restaurant-feature', { credentials: 'include' })
      .then(async response => response.ok ? response.json() as Promise<{ enabled?: boolean }> : { enabled: false })
      .then(result => { if (!cancelled) setRestaurantFeatureEnabled(result.enabled === true); })
      .catch(() => { if (!cancelled) setRestaurantFeatureEnabled(false); });
    return () => { cancelled = true; };
  }, [user?.role, user?.storeType]);

  if (isLoading) return <div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>;
  if (isError || !user) return <div className="auth-required" dir="rtl"><div className="empty-symbol"><ShieldCheck/></div><h2>يلزم تسجيل الدخول</h2><p>سجّل الدخول باستخدام حساب X-Store للوصول إلى مساحة العمل.</p><Link href="/sign-in" className="button button-primary">تسجيل الدخول</Link><button className="button button-quiet" onClick={()=>refetch()}>إعادة المحاولة</button></div>;
  const restaurantMenuEnabled = user.role === 'tenant_admin' && (
    user.storeType === 'cafe' || user.storeType === 'restaurant' ||
    (user.storeType == null && restaurantFeatureEnabled === true)
  );
  const poultryCustomersEnabled = user.storeType === 'poultry' && (user.role !== 'custom' || user.permissions?.includes('collector') || user.permissions?.includes('accountant'));
  const items = nav.filter(n =>
    (n.href !== '/restaurant-menu' || restaurantMenuEnabled) &&
    (n.href !== '/poultry-customers' || poultryCustomersEnabled) &&
    (!isPoultryStore || !['/pos', '/inventory', '/sales'].includes(n.href)) &&
    (n.roles.includes('all') || hasAppRole(user, n.roles))
  );
  const canSeeSalesNotifications = !isPoultryStore && (hasAppRole(user,['platform_admin','tenant_admin','cashier','accountant']) || (user.role==='custom' && Boolean(user.permissions?.some(p=>p==='retail_sales'||p==='wholesale_sales'))));
  const canSeeInventoryNotifications = !isPoultryStore && hasAppRole(user,['platform_admin','tenant_admin','warehouse_manager']);
  const notificationRows = [
    ...(canSeeSalesNotifications?(notificationSales.data||[]).filter(s=>Date.now()-new Date(s.createdAt).getTime()<7*86400000).map(s=>({id:`sale:${s.id}`,title:`تمت فاتورة ${s.invoiceNo}`,detail:`${s.cashierName} · ${moneyLabel(s.total)}`,date:new Date(s.createdAt),icon:ReceiptText,href:'/sales'})):[]),
    ...(canSeeSalesNotifications ? (notificationSales.data || []).flatMap((sale) => {
      const returned = sale.status !== 'completed' ? [{ id: `return:${sale.id}`, title: sale.status === 'returned' ? `تم استرجاع الفاتورة ${sale.invoiceNo}` : `تم تسجيل مرتجع للفاتورة ${sale.invoiceNo}`, detail: 'راجع تفاصيل المرتجع في سجل المبيعات', date: new Date(sale.createdAt), icon: RotateCcw, href: '/sales' }] : [];
      const exchanges = sale.exchangeEvents.map((event) => ({ id: `exchange:${sale.id}:${event.createdAt}`, title: `تم استبدال من الفاتورة ${sale.invoiceNo}`, detail: `فاتورة البديل ${event.replacementInvoiceNo}`, date: new Date(event.createdAt), icon: ArrowLeftRight, href: '/sales' }));
      return [...returned, ...exchanges];
    }) : []),
    ...(canSeeInventoryNotifications?(notificationProducts.data||[]).filter(p=>p.quantity<=5).map(p=>({id:`stock:${p.id}:${p.quantity<=0?'out':'low'}`,title:p.quantity<=0?`نفد مخزون ${p.name}`:`مخزون ${p.name} قرب يخلص`,detail:`المتبقي: ${fmt(p.quantity)}`,date:new Date(),icon:Package,href:'/inventory'})):[]),
    ...(user.storeType === 'poultry' ? poultryNotifications.map(n=>({id:n.id,title:n.title,detail:n.detail,date:new Date(n.createdAt),icon:n.type==='payment'?Wallet:ReceiptText,href:n.href})) : []),
  ].sort((a,b)=>b.date.getTime()-a.date.getTime()).slice(0,100);
  const unseenNotifications=notificationRows.filter(n=>!readNotificationIds.includes(n.id)).length;
  function markNotificationsRead(){const next=Array.from(new Set([...readNotificationIds,...notificationRows.map(n=>n.id)]));setReadNotificationIds(next);try{localStorage.setItem(`xstore-notifications:${user.id}`,JSON.stringify(next))}catch{}}
     return <XStoreSessionContext.Provider value={user}>
      <CurrencyContext.Provider value={(user.currency as StoreCurrency | null) || 'SAR'}>
        <div dir="rtl" className="app-frame">
      <aside className={`sidebar ${open?'sidebar-open':''}`}><div className="sidebar-top"><Logo/><button className="icon-button sidebar-close" onClick={()=>setOpen(false)} aria-label="إغلاق القائمة"><X size={19}/></button></div><div className="store-chip"><span className="store-avatar">{(user.tenantName||user.name).slice(0,1)}</span><span><b>{user.tenantName || 'إدارة المنصة'}</b><small>{user.roleName || roleNames[user.role] || user.role}</small></span><ChevronDown size={15}/></div><div className="nav-caption">القائمة الرئيسية</div><nav className="side-nav">{items.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={`nav-link ${location===item.href?'nav-active':''}`} data-testid={`link-nav-${item.href.slice(1)}`}><item.icon size={18}/><span>{item.label}</span>{location===item.href&&<i/>}</Link>)}</nav><div className="sidebar-bottom"><div className="support-box"><span className="support-icon"><ShieldCheck size={17}/></span><b>كل شيء تحت السيطرة</b><p>بيانات المتجر محفوظة ومحدّثة.</p></div><div className="profile-row"><span className="profile-avatar">{user.name.slice(0,1)}</span><span className="profile-info"><b>{user.name}</b><small>{user.phone}</small></span><button type="button" className="icon-button" onClick={()=>void handleLogout()} disabled={loggingOut} title={loggingOut?'جارٍ تسجيل الخروج…':'تسجيل الخروج'} aria-label={loggingOut?'جارٍ تسجيل الخروج':'تسجيل الخروج'} data-testid="button-sign-out"><LogOut size={17}/></button></div></div></aside>
    {open&&<button aria-label="إغلاق القائمة" className="mobile-scrim" onClick={()=>setOpen(false)}/>}
     <div className="workspace"><header className="topbar"><button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={()=>setOpen(true)}><Menu size={20}/></button><div className="crumbs"><span>مساحة العمل</span><ChevronLeft size={14}/><b>{items.find(i=>i.href===location)?.label||'لوحة التحكم'}</b></div><div className="topbar-tools"><span className="today"><CalendarDays size={15}/> {new Intl.DateTimeFormat(APP_SAUDI_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span><div className="notification-wrap"><button className="icon-button notification" aria-label="الإشعارات" aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={18}/>{unseenNotifications>0&&<i/>}</button>{notificationsOpen&&<section className="notification-panel" dir="rtl"><header><b>الإشعارات</b><button onClick={markNotificationsRead} disabled={!unseenNotifications}>تحديد الكل كمقروء</button></header><div className="notification-list">{notificationRows.length?notificationRows.map(item=><Link key={item.id} href={item.href} className={`notification-row ${readNotificationIds.includes(item.id)?'is-read':''}`} onClick={()=>{const next=[...new Set([...readNotificationIds,item.id])];setReadNotificationIds(next);try{localStorage.setItem(`xstore-notifications:${user.id}`,JSON.stringify(next))}catch{}setNotificationsOpen(false)}}><span><item.icon size={16}/></span><div><b>{item.title}</b><small>{item.detail} · {dateLabel(item.date.toISOString())}</small></div></Link>):<p className="notification-empty">لا توجد إشعارات حالياً</p>}</div></section>}</div><span className="top-avatar">{user.name.slice(0,1)}</span></div></header><main className="main-content">{children}</main></div>
   </div>
      </CurrencyContext.Provider>
    </XStoreSessionContext.Provider>;
}
function ProtectedLayout() {
  const [location] = useLocation(); const session=useGetXStoreSession({ query: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, refetchOnReconnect: false } });
  const [restaurantFeature, setRestaurantFeature] = useState<boolean | null>(null);
  useEffect(() => {
    if (session.isLoading || !session.data || location !== '/restaurant-menu') return;
    if (session.data.role !== 'tenant_admin' || session.data.storeType === 'cafe' || session.data.storeType === 'restaurant') {
      setRestaurantFeature(null);
      return;
    }
    let cancelled = false;
    void fetch('/api/xstore/restaurant-feature', { credentials: 'include' })
      .then(async response => response.ok ? response.json() as Promise<{ enabled?: boolean }> : { enabled: false })
      .then(result => { if (!cancelled) setRestaurantFeature(result.enabled === true); })
      .catch(() => { if (!cancelled) setRestaurantFeature(false); });
    return () => { cancelled = true; };
  }, [session.isLoading, session.data?.id, session.data?.role, session.data?.storeType, location]);
  const restaurantMenuAccessLoading = session.isLoading || (location === '/restaurant-menu' && session.data?.role === 'tenant_admin' && session.data?.storeType == null && restaurantFeature === null);
  const restaurantMenuEnabled = session.data?.role === 'tenant_admin' && (
    session.data?.storeType === 'cafe' ||
    session.data?.storeType === 'restaurant' ||
    (session.data?.storeType == null && restaurantFeature === true)
  );
  const allowed:Record<string,string[]>={'/poultry-customers':['tenant_admin','cashier','accountant','custom'],'/tenants':['platform_admin'],'/subscriptions':['platform_admin'],'/offline-license-issuer':['platform_admin'],'/settings':['platform_admin'],'/platform-backup':['platform_admin'],'/platform-database':['platform_admin'],'/store-backup':['tenant_admin'],'/restaurant-menu':['tenant_admin'],'/store-settings':['tenant_admin'],'/team':['tenant_admin'],'/pos':['tenant_admin','cashier'],'/inventory':['tenant_admin','warehouse_manager'],'/reports':['platform_admin','tenant_admin','accountant'],'/sales':['tenant_admin','cashier','accountant'],'/audit-log':['platform_admin']};
  if (session.data?.storeType === 'poultry' && ['/pos', '/inventory', '/sales'].includes(location)) return <Redirect to="/poultry-customers" />;
  if(session.data&&allowed[location]&&!hasAppRole(session.data, allowed[location]))return <Redirect to="/dashboard"/>;
  if(location === '/restaurant-menu' && !restaurantMenuAccessLoading && !restaurantMenuEnabled)return <Redirect to="/dashboard"/>;
  if(session.isLoading)return <div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>;
  if(session.isError||!session.data)return <Redirect to="/sign-in"/>;
  return <AppShell user={session.data} refetch={session.refetch}><Switch>
    <Route path="/dashboard" component={DashboardPage}/><Route path="/poultry-customers" component={PoultryCustomersPage}/><Route path="/tenants" component={TenantsPage}/>
    <Route path="/subscriptions" component={SubscriptionsPage}/>
    <Route path="/offline-license-issuer" component={OfflineLicenseIssuerPage}/>
    <Route path="/team" component={TeamPage}/>
    <Route path="/pos" component={PosPage}/><Route path="/inventory" component={InventoryPage}/>
    <Route path="/reports" component={ReportsPage}/><Route path="/sales" component={SalesPage}/><Route path="/audit-log" component={AuditPage}/>
    <Route path="/settings" component={PlatformSettingsPage}/>
      <Route path="/platform-database" component={PlatformDatabasePage}/>
     <Route path="/platform-backup" component={PlatformBackupPage}/><Route path="/store-backup" component={StoreBackupPage}/><Route path="/restaurant-menu" component={RestaurantMenuPage}/>
    <Route path="/store-settings" component={StoreSettingsPage}/>
    <Route component={NotFound}/>
  </Switch>{location === '/subscriptions' && <OfflineLicenseIssuerPanel />}</AppShell>;
}
function PageTitle({ eyebrow, title, desc, action }: { eyebrow:string; title:string; desc:string; action?:ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>{action&&<div className="page-action">{action}</div>}</div>;
}
function OfflineLicenseIssuerPanel() {
  const [activationRequest, setActivationRequest] = useState<OfflineActivationRequest | null>(null);
  const [plan, setPlan] = useState<OfflineLicensePlan>('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const issueOfflineLicense = useIssueXStoreOfflineLicense();

  async function readRequestFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError('');
    setNotice('');
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!isOfflineActivationRequest(value)) {
        throw new Error('ملف طلب التفعيل غير صالح أو غير متوافق.');
      }
      setActivationRequest(value);
    } catch (issue) {
      setActivationRequest(null);
      setError(issue instanceof Error ? issue.message : 'تعذر قراءة ملف طلب التفعيل.');
    } finally {
      input.value = '';
    }
  }

  async function issueLicense() {
    if (!activationRequest) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await issueOfflineLicense.mutateAsync({
        data: { request: activationRequest, plan },
      });
      const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `xstore-offline-license-${result.payload.licenseId}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('تم إصدار ملف التفعيل وتنزيله. أرسله لصاحب المتجر لإدخاله على الجهاز المطلوب.');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'تعذر إصدار ملف التفعيل.');
    } finally {
      setBusy(false);
    }
  }

  return <Card className="payments-panel">
      <SectionHead title="تفعيل نسخة الأوفلاين" detail="حوّل طلب التفعيل القادم من المتجر إلى ملف موقّع يعمل على الجهاز المحدد فقط. لا يتضمن الطلب بيانات المبيعات أو المخزون." />
      <div className="form-grid">
        <label className="field field-wide"><span>ملف طلب التفعيل</span><input type="file" accept=".json,application/json" onChange={(event) => void readRequestFile(event)} /></label>
        <label className="field"><span>مدة الترخيص</span><select value={plan} onChange={(event) => setPlan(event.target.value as OfflineLicensePlan)}><option value="monthly">شهري</option><option value="half_yearly">نصف سنوي</option><option value="annual">سنوي</option><option value="lifetime">دائم</option></select></label>
      </div>
      {activationRequest && <div className="notice-box"><b>الطلب جاهز</b><span>المتجر: {activationRequest.storeName || 'بدون اسم'}</span><span>معرّف الجهاز: <bdi dir="ltr">{activationRequest.installationId}</bdi></span></div>}
      {error && <div className="form-error">{error}</div>}
      {notice && <div className="notice-box success">{notice}</div>}
      <div className="form-actions"><button type="button" className="btn primary" disabled={!activationRequest || busy} onClick={() => void issueLicense()}><KeyRound size={16} />{busy ? 'جارٍ إصدار الملف…' : 'إصدار ملف التفعيل'}</button></div>
  </Card>;
}

function OfflineLicenseIssuerPage() {
  return <Redirect to="/subscriptions" />;
}

function isOfflineActivationRequest(value: unknown): value is OfflineActivationRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Record<string, unknown>;
  return request.format === 'xstore-offline-activation-request' &&
    request.version === 2 &&
    typeof request.installationId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.installationId) &&
    isOfflineHardwareFingerprint(request.deviceFingerprint) &&
    typeof request.storeName === 'string' && request.storeName.length <= 160 &&
    typeof request.requestedAt === 'string' && Number.isFinite(Date.parse(request.requestedAt));
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

function PoultryCustomersPage() {
  const { data: session } = useGetXStoreSession();
  const [customers,setCustomers]=useState<any[]>([]);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<any|null>(null);
  const [statement,setStatement]=useState<any|null>(null);
  const [from,setFrom]=useState(new Date().toISOString().slice(0,8)+"01");
  const [to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [newCustomer,setNewCustomer]=useState({name:"",phone:"",shopName:"",shopAddress:""});
  const [invoice,setInvoice]=useState({productName:"فراخ",quantityKg:"",unitPrice:"",amountPaid:""});
  const [payment,setPayment]=useState("");
  const [lastInvoice,setLastInvoice]=useState<any|null>(null);
  const canSell=session?.role==="tenant_admin"||session?.role==="cashier";
  async function loadCustomers(q=search){
    const r=await fetch("/api/xstore/poultry/customers?search="+encodeURIComponent(q),{credentials:"include"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||"تعذر تحميل العملاء.");
    setCustomers(j);
  }
  useEffect(()=>{void loadCustomers().catch(e=>setError(e.message));},[]);
  async function createCustomer(){
    setBusy(true);setError("");setNotice("");
    try{const r=await fetch("/api/xstore/poultry/customers",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(newCustomer)});const j=await r.json();if(!r.ok)throw new Error(j.error||"تعذر إضافة العميل.");setNewCustomer({name:"",phone:"",shopName:"",shopAddress:""});setNotice("تم إضافة العميل.");await loadCustomers();setSelected(j);}catch(e){setError(e instanceof Error?e.message:"تعذر إضافة العميل.");}finally{setBusy(false);}
  }
  async function loadStatement(customer=selected){
    if(!customer)return;
    setBusy(true);setError("");
    try{const r=await fetch("/api/xstore/poultry/customers/"+customer.id+"/statement?from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to),{credentials:"include"});const j=await r.json();if(!r.ok)throw new Error(j.error||"تعذر تحميل كشف الحساب.");setStatement(j);}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل كشف الحساب.");}finally{setBusy(false);}
  }
  async function createInvoice(){
    if(!selected)return;
    setBusy(true);setError("");setNotice("");
    try{const r=await fetch("/api/xstore/poultry/customers/"+selected.id+"/invoices",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({items:[{productName:invoice.productName,quantityKg:Number(invoice.quantityKg),unitPrice:Number(invoice.unitPrice)}],amountPaid:Number(invoice.amountPaid)||0})});const j=await r.json();if(!r.ok)throw new Error(j.error||"تعذر تسجيل الفاتورة.");setLastInvoice({...j,customerName:selected.name});setNotice("تم تسجيل الفاتورة "+j.invoiceNo+" بقيمة "+fmt(j.total)+" جنيه.");setInvoice({productName:"فراخ",quantityKg:"",unitPrice:"",amountPaid:""});await loadCustomers();await loadStatement(selected);}catch(e){setError(e instanceof Error?e.message:"تعذر تسجيل الفاتورة.");}finally{setBusy(false);}
  }
  async function collectPayment(){
    if(!selected)return;
    setBusy(true);setError("");setNotice("");
    try{const r=await fetch("/api/xstore/poultry/customers/"+selected.id+"/payments",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({amount:Number(payment)})});const j=await r.json();if(!r.ok)throw new Error(j.error||"تعذر تسجيل التحصيل.");setNotice("تم تسجيل تحصيل "+fmt(j.amount)+" جنيه.");setPayment("");await loadCustomers();await loadStatement(selected);}catch(e){setError(e instanceof Error?e.message:"تعذر تسجيل التحصيل.");}finally{setBusy(false);}
  }
  function whatsappInvoice(){ if(!lastInvoice||!selected)return; const text="فاتورة "+lastInvoice.invoiceNo+"\nالعميل: "+selected.name+"\nالقيمة: "+fmt(lastInvoice.total)+" جنيه\nالمدفوع: "+fmt(lastInvoice.amountPaid)+" جنيه\nالمتبقي: "+fmt(lastInvoice.balance)+" جنيه\nالتاريخ والوقت: "+new Intl.DateTimeFormat("ar-EG",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"Africa/Cairo"}).format(new Date(lastInvoice.createdAt)); window.open("https://wa.me/"+String(selected.phone).replace(/\D/g,"")+"?text="+encodeURIComponent(text),"_blank"); }
  function whatsappStatement(){
    if(!selected||!statement)return;
    const s=statement.summary;
    const text="كشف حساب "+selected.name+"\nالفترة: "+from+" إلى "+to+"\nإجمالي الكمية: "+fmt(s.totalKg)+" كجم\nالمبيعات: "+fmt(s.sales)+" جنيه\nالمدفوع: "+fmt(s.paid)+" جنيه\nالمتبقي: "+fmt(s.remaining)+" جنيه";
    window.open("https://wa.me/"+String(selected.phone).replace(/\D/g,"")+"?text="+encodeURIComponent(text),"_blank");
  }
  return <div dir="rtl">
    <PageTitle eyebrow="الدواجن والفراخ" title="حسابات العملاء" desc="بيع آجل، تحصيل، وكشف حساب دقيق لكل عميل مع حفظ سعر الكيلو وقت الفاتورة." action={<button className="button button-primary" onClick={()=>window.print()}><Printer size={16}/> طباعة</button>}/>
    {error&&<div className="form-error">{error}</div>}{notice&&<div className="notice-box success">{notice}</div>}
    <div className="dashboard-grid poultry-grid">
      <Card><SectionHead title="العملاء" detail="ابحث بالاسم أو رقم الهاتف أو اسم المحل."/>
        <div className="form-grid"><label className="field field-wide"><span>بحث</span><input value={search} onChange={e=>{setSearch(e.target.value);void loadCustomers(e.target.value)}} placeholder="اسم العميل أو الهاتف أو المحل"/></label></div>
        <div className="poultry-customer-list">{customers.map(c=><button type="button" className={"poultry-customer "+(selected?.id===c.id?"selected":"")} key={c.id} onClick={()=>{setSelected(c);setStatement(null);}}><span className="poultry-customer-icon"><Bird size={18}/></span><span><b>{c.name}</b><small>{c.shopName||"بدون اسم محل"} · {c.phone}</small></span><strong>{fmt(c.balance)} ج.م</strong></button>)}</div>
        <div className="form-grid poultry-add"><label className="field"><span>اسم العميل</span><input value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer,name:e.target.value})}/></label><label className="field"><span>رقم الهاتف</span><input value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})}/></label><label className="field"><span>اسم المحل</span><input value={newCustomer.shopName} onChange={e=>setNewCustomer({...newCustomer,shopName:e.target.value})}/></label><label className="field"><span>عنوان المحل</span><input value={newCustomer.shopAddress} onChange={e=>setNewCustomer({...newCustomer,shopAddress:e.target.value})}/></label></div>
        <button className="button button-primary" disabled={busy||!newCustomer.name||!newCustomer.phone} onClick={()=>void createCustomer()}><Plus size={16}/> إضافة عميل</button>
      </Card>
      <Card>{selected?<><SectionHead title={selected.name} detail={(selected.shopName||"بدون اسم محل")+" · "+selected.phone}/>
        <div className="poultry-customer-meta"><span><b>المحل</b>{selected.shopName||"—"}</span><span><b>العنوان</b>{selected.shopAddress||"—"}</span><span><b>الرصيد الحالي</b>{fmt(selected.balance)} ج.م</span></div>
        <div className="form-grid"><label className="field"><span>من تاريخ</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field"><span>إلى تاريخ</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
        <div className="form-actions"><button className="button button-primary" onClick={()=>void loadStatement()} disabled={busy}>عرض الجرد</button>{statement&&<><button className="button button-quiet" onClick={whatsappStatement}><MessageCircle size={16}/> واتساب</button><button className="button button-quiet" onClick={()=>window.print()}><Printer size={16}/> طباعة / PDF</button></>}</div>
        {lastInvoice&&<div className="notice-box success poultry-last-invoice"><b>آخر فاتورة: {lastInvoice.invoiceNo}</b><span>القيمة {fmt(lastInvoice.total)} ج.م · المدفوع {fmt(lastInvoice.amountPaid)} ج.م · المتبقي {fmt(lastInvoice.balance)} ج.م</span><div className="form-actions"><button className="button button-quiet" onClick={whatsappInvoice}><MessageCircle size={16}/> إرسال الفاتورة واتساب</button><button className="button button-quiet" onClick={()=>window.print()}><Printer size={16}/> طباعة / PDF</button></div></div>}{canSell&&<div className="poultry-action-box"><h3>فاتورة جديدة</h3><div className="form-grid"><label className="field"><span>الصنف</span><input value={invoice.productName} onChange={e=>setInvoice({...invoice,productName:e.target.value})}/></label><label className="field"><span>الكمية بالكيلو</span><input type="number" step="0.001" value={invoice.quantityKg} onChange={e=>setInvoice({...invoice,quantityKg:e.target.value})}/></label><label className="field"><span>سعر الكيلو</span><input type="number" step="0.01" value={invoice.unitPrice} onChange={e=>setInvoice({...invoice,unitPrice:e.target.value})}/></label><label className="field"><span>المدفوع</span><input type="number" step="0.01" value={invoice.amountPaid} onChange={e=>setInvoice({...invoice,amountPaid:e.target.value})}/></label></div><button className="button button-primary" disabled={busy} onClick={()=>void createInvoice()}><ReceiptText size={16}/> تسجيل الفاتورة</button></div>}
        <div className="poultry-action-box"><h3>تحصيل</h3><div className="form-grid"><label className="field"><span>المبلغ</span><input type="number" step="0.01" value={payment} onChange={e=>setPayment(e.target.value)} placeholder="0.00"/></label></div><button className="button button-primary" disabled={busy||!payment} onClick={()=>void collectPayment()}><Wallet size={16}/> تسجيل التحصيل</button></div>
      </>:<div className="state-box"><div className="empty-symbol"><Bird size={22}/></div><b>اختر عميلًا</b><span>اعرض حسابه أو سجل فاتورة أو تحصيل.</span></div>}</Card>
    </div>
    {statement&&<Card className="poultry-statement"><SectionHead title="كشف الحساب" detail={"من "+from+" إلى "+to}/><div className="stat-grid"><StatCard label="إجمالي الكمية" value={fmt(statement.summary.totalKg)+" كجم"} detail="إجمالي الوزن خلال الفترة" icon={Bird}/><StatCard label="المبيعات" value={fmt(statement.summary.sales)+" ج.م"} detail="قيمة الفواتير" icon={ReceiptText} tint="gold"/><StatCard label="المدفوع" value={fmt(statement.summary.paid)+" ج.م"} detail="إجمالي التحصيل" icon={Wallet} tint="sage"/><StatCard label="المتبقي" value={fmt(statement.summary.remaining)+" ج.م"} detail="الرصيد بعد الفترة" icon={CreditCard}/></div><div className="table-wrap"><table><thead><tr><th>التاريخ والوقت</th><th>الحركة</th><th>الكيلو</th><th>سعر الكيلو</th><th>القيمة</th><th>الموظف</th></tr></thead><tbody>{statement.rows.map((row:any)=><tr key={row.id}><td>{new Intl.DateTimeFormat("ar-EG",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"Africa/Cairo"}).format(new Date(row.date))}</td><td><b>{row.type==="invoice"?"فاتورة "+row.invoiceNo:"تحصيل"}</b></td><td>{row.items.length?fmt(row.items.reduce((s:number,x:any)=>s+x.quantityKg,0)):"—"}</td><td>{row.items.length?fmt(row.items[0].unitPrice)+" ج.م":"—"}</td><td>{fmt(row.type==="invoice"?row.total:row.paid)} ج.م</td><td>{row.actorName}</td></tr>)}</tbody></table></div></Card>}
  </div>;
}

function PoultryDashboardPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadPoultryData(query = '') {
    setLoading(true);
    try {
      const [customersResponse, notificationsResponse] = await Promise.all([
        fetch('/api/xstore/poultry/customers?search=' + encodeURIComponent(query), { credentials: 'include', cache: 'no-store' }),
        fetch('/api/xstore/poultry/notifications', { credentials: 'include', cache: 'no-store' }),
      ]);
      const customerData = customersResponse.ok ? await customersResponse.json() : [];
      const notificationData = notificationsResponse.ok ? await notificationsResponse.json() : [];
      setCustomers(Array.isArray(customerData) ? customerData : []);
      setNotifications(Array.isArray(notificationData) ? notificationData : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPoultryData(); }, []);

  const totalOutstanding = customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0);
  const invoiceCount = notifications.filter(item => item.type === 'invoice').length;
  const paymentCount = notifications.filter(item => item.type === 'payment').length;
  return <div dir="rtl" className="poultry-dashboard">
    <PageTitle
      eyebrow="إدارة الدواجن والفراخ"
      title="لوحة الدواجن"
      desc="بيع بالكيلو، حسابات العملاء الآجلة، التحصيل وكشوف الحساب — بدون نظام الملابس أو نقطة بيع المنتجات التقليدية."
      action={<Link href="/poultry-customers" className="button button-primary"><Bird size={16}/> حسابات العملاء</Link>}
    />
    <div className="stat-grid">
      <StatCard label="العملاء" value={fmt(customers.length)} detail="حسابات العملاء المسجلة" icon={Users}/>
      <StatCard label="إجمالي المستحق" value={fmt(totalOutstanding) + ' ج.م'} detail="رصيد العملاء الحالي" icon={CreditCard} tint="gold"/>
      <StatCard label="فواتير حديثة" value={fmt(invoiceCount)} detail="حركة بيع بالكيلو" icon={ReceiptText}/>
      <StatCard label="تحصيلات حديثة" value={fmt(paymentCount)} detail="عمليات تحصيل مسجلة" icon={Wallet} tint="sage"/>
    </div>
    <div className="dashboard-grid">
      <Card>
        <SectionHead title="حسابات العملاء" detail="ابحث بالاسم أو الهاتف أو اسم المحل." action={<Link href="/poultry-customers" className="text-link">فتح الحسابات <ChevronLeft size={15}/></Link>}/>
        <div className="table-toolbar">
          <label className="search-box sales-search"><Search size={18}/><input value={search} onChange={e => { setSearch(e.target.value); void loadPoultryData(e.target.value); }} placeholder="اسم العميل أو الهاتف أو المحل"/></label>
        </div>
        {loading ? <div className="skeleton-table"><span/><span/><span/></div> : customers.length ? (
          <div className="poultry-dashboard-customers">
            {customers.slice(0, 8).map(customer => (
              <Link href="/poultry-customers" className="poultry-dashboard-customer" key={customer.id}>
                <span className="poultry-customer-icon"><Bird size={17}/></span>
                <span><b>{customer.name}</b><small>{customer.shopName || 'بدون اسم محل'} · {customer.phone}</small></span>
                <strong>{fmt(Number(customer.balance || 0))} ج.م</strong>
              </Link>
            ))}
          </div>
        ) : <div className="empty-inline">لا توجد حسابات عملاء حتى الآن.</div>}
      </Card>
      <Card>
        <SectionHead title="آخر الحركة" detail="الفواتير والتحصيلات التي تمت على حسابات العملاء."/>
        {notifications.length ? <div className="quick-list poultry-dashboard-activity">
          {notifications.slice(0, 6).map(item => (
            <div key={item.id}>
              <span className={"quick-icon " + (item.type === 'payment' ? 'green' : 'yellow')}>{item.type === 'payment' ? <Wallet size={17}/> : <ReceiptText size={17}/>}</span>
              <span><b>{item.title}</b><small>{item.detail}</small></span>
              <small>{dateLabel(item.createdAt)}</small>
            </div>
          ))}
        </div> : <div className="empty-inline">لا توجد حركة مسجلة بعد.</div>}
      </Card>
    </div>
    <Card className="poultry-dashboard-actions">
      <SectionHead title="إجراءات سريعة" detail="العمليات الأساسية لمتجر الدواجن."/>
      <div className="quick-list">
        <div><span className="quick-icon green"><Plus size={17}/></span><span><b>إضافة عميل</b><small>اسم العميل، الهاتف، المحل والعنوان</small></span><Link href="/poultry-customers" className="table-action">فتح</Link></div>
        <div><span className="quick-icon yellow"><ReceiptText size={17}/></span><span><b>تسجيل فاتورة بالكيلو</b><small>سعر الكيلو يُحفظ مع كل فاتورة</small></span><Link href="/poultry-customers" className="table-action">فتح</Link></div>
        <div><span className="quick-icon pale"><Wallet size={17}/></span><span><b>تسجيل تحصيل</b><small>الموظف المخصص للتحصيل يقدر يسجل الدفع</small></span><Link href="/poultry-customers" className="table-action">فتح</Link></div>
      </div>
    </Card>
  </div>;
}

function DashboardPage() {
  const session = useContext(XStoreSessionContext);
  if (session?.storeType === 'poultry') return <PoultryDashboardPage />;
  return <StandardDashboardPage />;
}

function StandardDashboardPage() {
  const session = useContext(XStoreSessionContext);
  const dash=useGetXStoreDashboard();
  const money=useMoney();
  const d=dash.data;
  const isPlatform=session?.role==='platform_admin';
  const isCashier=hasAppRole(session,['cashier'])&&!hasAppRole(session,['accountant']);
  const isInventoryOnly=hasAppRole(session,['warehouse_manager'])&&!hasAppRole(session,['platform_admin','tenant_admin','cashier','accountant']);
  const canViewSales=hasAppRole(session,['platform_admin','tenant_admin','cashier','accountant']);
  const actionHref=isPlatform?'/tenants':hasAppRole(session,['tenant_admin','cashier'])?'/pos':hasAppRole(session,['warehouse_manager'])?'/inventory':hasAppRole(session,['accountant'])?'/reports':'/dashboard';
  const actionLabel=isPlatform?'إدارة المتاجر':actionHref==='/inventory'?'فتح المخزون':actionHref==='/reports'?'عرض التقارير المالية':'بدء عملية بيع';
  const activityHref=isPlatform?'/tenants':canViewSales?'/sales':actionHref;
  return <><PageTitle eyebrow="نظرة عامة" title={isPlatform?'صورة المنصة اليوم':'أهلاً بك في متجرك'} desc={isPlatform?'متابعة حالة المتاجر والاشتراكات ونشاط المنصة.':'ملخص عمل متجرك — كل التفاصيل المهمة في نظرة واحدة.'} action={<Link href={actionHref} className="button button-primary">{actionLabel} <ArrowUpLeft size={16}/></Link>}/>
    {dash.isLoading?<div className="stat-grid">{[1,2,3,4].map(x=><div className="stat-card stat-skeleton" key={x}/>)}</div>:dash.isError?<StateBlock loading={false} error onRetry={()=>dash.refetch()} empty={false}/>:d&&<>
      <div className="stat-grid">
        {isPlatform?<><StatCard label="المتاجر المسجلة" value={fmt(d.totalTenants)} detail={`${fmt(d.activeTenants)} متجر نشط`} icon={Store}/><StatCard label="الاشتراكات النشطة" value={fmt(d.activeSubscriptions)} detail={`${fmt(d.expiringSubscriptions)} تنتهي قريباً`} icon={Users} tint="gold"/><StatCard label="إيراد الاشتراكات" value={money(d.subscriptionRevenue)} detail="إجمالي الاشتراكات" icon={Banknote}/><StatCard label="متاجر موقوفة" value={fmt(d.suspendedTenants)} detail="تحتاج مراجعة" icon={AlertTriangle} tint="red"/></>
        :isCashier?<><StatCard label="عمليات اليوم" value={fmt(d.todaySales)} detail="فواتير مكتملة" icon={ReceiptText}/><StatCard label="نقطة البيع" value="جاهزة" detail="ابدأ عملية جديدة" icon={ShoppingCart} tint="sage"/><StatCard label="متجرك" value={session?.tenantName||'متجرك'} detail="مساحة عمل آمنة" icon={Store} tint="gold"/><StatCard label="مساعدة الصندوق" value="متاحة" detail="البيع والمرتجعات" icon={ShieldCheck}/></>
        :isInventoryOnly?<><StatCard label="منتجات منخفضة المخزون" value={fmt(d.lowStockCount)} detail="تحتاج مراجعة" icon={Boxes}/><StatCard label="دورك" value={session?.roleName||roleNames[session?.role||'']||'مخصص'} detail="صلاحيات محددة من مالك المتجر" icon={ShieldCheck} tint="sage"/><StatCard label="مبيعات اليوم" value={fmt(d.todaySales)} detail="عدد الفواتير المكتملة" icon={ReceiptText}/><StatCard label="البيانات المالية" value="غير متاحة" detail="ليست ضمن صلاحياتك" icon={Banknote} tint="gold"/></>
        :<><StatCard label="مبيعات اليوم" value={fmt(d.todaySales)} detail="عملية بيع مكتملة" icon={ReceiptText}/><StatCard label="إيراد اليوم" value={money(d.todayRevenue)} detail="إجمالي المبيعات اليوم" icon={Banknote} tint="gold"/><StatCard label="قيمة المخزون" value={money(d.inventoryValue)} detail={`${fmt(d.lowStockCount)} منتجات منخفضة`} icon={Boxes}/><StatCard label={session?.role==='custom'?'الدور':'الاشتراك'} value={session?.role==='custom'?(session.roleName||'مخصص'):(statusNames[session?.role||'']||'نشط')} detail={session?.tenantName||'متجرك'} icon={ShieldCheck} tint="sage"/></>}
      </div>
      <div className="dashboard-grid">
        <Card><SectionHead title={isPlatform?'أحدث المتاجر':canViewSales?'آخر المبيعات':'مخزون يحتاج متابعة'} detail={isPlatform?'المتاجر المنضمة حديثاً':canViewSales?'الحركة الأخيرة في متجرك':'المنتجات التي تحتاج إلى مراجعة'} action={<Link href={activityHref} className="text-link">{isPlatform?'عرض المتاجر':canViewSales?'عرض الفواتير':'فتح المخزون'} <ChevronLeft size={15}/></Link>}/>
          {isPlatform?<TenantTable tenants={d.latestTenants||[]} compact/>:canViewSales?<SalesTable sales={d.latestSales||[]} compact showAmounts={!isCashier} showOrderType={session?.storeType==='cafe'||session?.storeType==='restaurant'}/>:<div className="empty-inline">افتح المخزون لمراجعة المنتجات والكميات المتاحة.</div>}
        </Card>
        <Card><SectionHead title={isCashier?'اختصارات الصندوق':isInventoryOnly?'اختصارات المخزون':'مؤشرات سريعة'} detail={isCashier?'إجراءات أساسية خلال الوردية':isInventoryOnly?'إجراءات تناسب صلاحياتك':'تحديث مباشر من بيانات العمل'}/>
          {isCashier?<div className="quick-list"><div><span className="quick-icon green"><ShoppingCart size={17}/></span><span><b>عملية بيع جديدة</b><small>امسح أو ابحث عن منتج</small></span><Link href="/pos" className="table-action">فتح</Link></div><div><span className="quick-icon yellow"><RotateCcw size={17}/></span><span><b>المرتجعات</b><small>من شاشة المبيعات</small></span><Link href="/sales" className="table-action">عرض</Link></div><div><span className="quick-icon pale"><ReceiptText size={17}/></span><span><b>سجل الفواتير</b><small>الوصول لإيصال البيع</small></span><Link href="/sales" className="table-action">عرض</Link></div></div>
          :isInventoryOnly?<div className="quick-list"><div><span className="quick-icon green"><Package size={17}/></span><span><b>إدارة المخزون</b><small>تحديث الكميات والمنتجات</small></span><Link href="/inventory" className="table-action">فتح</Link></div><div><span className="quick-icon yellow"><Boxes size={17}/></span><span><b>منتجات منخفضة المخزون</b><small>عدد المنتجات التي تحتاج متابعة</small></span><strong>{fmt(d.lowStockCount)}</strong></div><div><span className="quick-icon pale"><ShieldCheck size={17}/></span><span><b>{session?.roleName||'صلاحيات المخزون'}</b><small>لا تشمل تعديل أسعار المنتجات</small></span></div></div>
          :<><div className="quick-list"><div><span className="quick-icon green"><Package size={17}/></span><span><b>مخزون يحتاج متابعة</b><small>منتجات وصلت حد التنبيه</small></span><strong>{fmt(d.lowStockCount)}</strong></div><div><span className="quick-icon yellow"><Clock3 size={17}/></span><span><b>اشتراكات تنتهي قريباً</b><small>خلال الفترة القادمة</small></span><strong>{fmt(d.expiringSubscriptions)}</strong></div><div><span className="quick-icon pale"><Activity size={17}/></span><span><b>حالة الخدمة</b><small>جميع الأنظمة تعمل</small></span><span className="status-pill status-active">مستقر</span></div></div><div className="subscription-note"><span><ShieldCheck size={18}/></span><div><b>مساحة عمل آمنة</b><small>تُسجّل الإجراءات الحساسة للرجوع إليها.</small></div></div></>}
        </Card>
      </div>
      {isPlatform&&<Card className="audit-preview"><SectionHead title="آخر إجراءات المنصة" action={<Link href="/audit-log" className="text-link">سجل التدقيق <ChevronLeft size={15}/></Link>}/><AuditRows logs={d.latestAuditLogs||[]}/></Card>}
    </>}
  </>;
}
function TenantTable({tenants,compact=false}:{tenants:Tenant[];compact?:boolean}) {
  if(!tenants.length)return <div className="empty-inline">لا توجد متاجر لعرضها.</div>;
  return <div className="platform-tenant-list"><div className="platform-tenant-table table-wrap"><table><thead><tr><th>المتجر</th><th>المالك</th>{!compact&&<th>نوع المتجر</th>}<th>العملة</th><th>الحالة</th><th>الخطة</th>{!compact&&<th>الفروع</th>}</tr></thead><tbody>{tenants.map(t=><tr key={t.id}><td><div className="platform-store-cell"><span className="platform-store-avatar">{t.name.slice(0,1)}</span><span><b>{t.name}</b><small>{t.email||t.phone||'—'}</small></span></div></td><td><b>{t.ownerName}</b></td>{!compact&&<td><b>{storeTypeName(t.storeType)}</b><small>{t.businessType}</small></td>}<td>{currencyLabels[t.currency as StoreCurrency] || t.currency}</td><td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{statusNames[t.plan]}</td>{!compact&&<td>{fmt(t.branchCount)}</td>}</tr>)}</tbody></table></div><div className="platform-tenant-mobile">{tenants.map(t=><article className="platform-store-card" key={t.id}><div className="platform-store-card-head"><span className="platform-store-avatar">{t.name.slice(0,1)}</span><div><b>{t.name}</b><small>{t.ownerName}</small></div><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></div><div className="platform-store-card-grid"><div><span>نوع المتجر</span><b>{storeTypeName(t.storeType)}</b></div><div><span>الخطة</span><b>{statusNames[t.plan]}</b></div><div><span>العملة</span><b>{currencyLabels[t.currency as StoreCurrency] || t.currency}</b></div>{!compact&&<div><span>الفروع</span><b>{fmt(t.branchCount)}</b></div>}</div><div className="platform-store-card-foot"><small>{t.businessType||'نشاط تجاري'}</small><small>{t.email||t.phone||'—'}</small></div></article>)}</div></div>;
}
function SaleItemsTable({items,money,variant='history'}:{items:NonNullable<Sale['items']>;money:(value:number)=>string;variant?:'history'|'receipt'|'thermal'}) {
  if(!items.length)return <p className={variant==='receipt'||variant==='thermal'?'receipt-lines-empty':'sale-lines-empty'}>لا توجد تفاصيل أصناف محفوظة لهذه الفاتورة.</p>;
  if(variant==='thermal')return <div className="thermal-lines-wrap">{items.map((item,index)=><article className="thermal-line-item" key={`${item.productId}-${index}`}>
    <b>{latinizeDigits(item.name)}</b>
    {item.sku&&<small>{latinizeDigits(item.sku)}</small>}
    {item.returnedQuantity>0&&<small className="sale-line-returned">مرتجع: {fmt(item.returnedQuantity)}</small>}
    <div><span>{fmt(item.quantity)} × {money(item.unitPrice)}</span><strong>{money(roundMoney(item.unitPrice*item.quantity))}</strong></div>
  </article>)}</div>;
  const receipt=variant==='receipt';
  return <div className={variant==='receipt'?'receipt-lines-wrap':'sale-lines-wrap'}>
    <table className={receipt?'receipt-lines-table':'sale-lines-table'} dir={receipt?'ltr':'rtl'}>
      <thead><tr>{receipt
        ? <><th>الإجمالي</th><th>سعر الوحدة</th><th>الكمية</th><th>الصنف</th></>
        : <><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></>}
      </tr></thead>
      <tbody>{items.map((item,index)=>{
        const lineTotal=money(roundMoney(item.unitPrice*item.quantity));
        const productDetails=<><b>{latinizeDigits(item.name)}</b>{item.sku&&<small>{latinizeDigits(item.sku)}</small>}{item.returnedQuantity>0&&<small className="sale-line-returned">مرتجع: {fmt(item.returnedQuantity)}</small>}</>;
        return <tr key={`${item.productId}-${index}`}>{receipt
          ? <><td><b>{lineTotal}</b></td><td>{money(item.unitPrice)}</td><td>{fmt(item.quantity)}</td><td>{productDetails}</td></>
          : <><td>{productDetails}</td><td>{fmt(item.quantity)}</td><td>{money(item.unitPrice)}</td><td><b>{lineTotal}</b></td></>}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
function SalesTable({sales,compact=false,onReturn,onPrint,onToggleItems,expandedSaleId,showAmounts=true,showOrderType=false}:{sales:Sale[];compact?:boolean;onReturn?:(s:Sale)=>void;onPrint?:(s:Sale)=>void;onToggleItems?:(s:Sale)=>void;expandedSaleId?:string|null;showAmounts?:boolean;showOrderType?:boolean}) {
  const money=useMoney();
  if(!sales.length)return <div className="empty-inline">لا توجد عمليات بيع لعرضها.</div>;
  const hasActions=Boolean(onReturn||onPrint||onToggleItems);
  const columnCount=3+Number(showOrderType)*2+Number(!compact)+Number(showAmounts)+1+Number(hasActions);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>رقم الفاتورة</th>{showOrderType&&<><th>الترابيزة</th><th>الطلب</th></>}<th>التاريخ والوقت</th><th>الأصناف</th>{!compact&&<th>الدفع</th>}{showAmounts&&<th>الإجمالي</th>}<th>الحالة</th>{hasActions&&<th>إجراء</th>}</tr></thead>
        <tbody>
          {sales.map(sale=>(
            <Fragment key={sale.id}>
              <tr>
                <td className="ltr-id">{latinizeDigits(sale.invoiceNo)}{sale.exchangeEvents.length>0&&<span className="sale-exchange-badge"><ArrowLeftRight size={12}/> استبدال</span>}</td>
                {showOrderType&&<><td>{sale.tableNumber||'—'}</td><td>{sale.orderType==='internal'?'داخلي':sale.orderType==='external'?'خارجي':'—'}</td></>}
                <td>{dateTimeLabel(sale.createdAt)}</td>
                <td>{fmt(sale.itemCount)}</td>
                {!compact&&<td>{paymentName(sale.paymentMethod)}</td>}
                {showAmounts&&<td><b>{money(sale.total)}</b></td>}
                <td><span className={`status-pill status-${sale.status}`}>{statusNames[sale.status]}</span></td>
                {hasActions&&<td className="table-actions-cell">{onToggleItems&&<button className="table-action" onClick={()=>onToggleItems(sale)} aria-expanded={expandedSaleId===sale.id} data-testid={`button-sale-items-${sale.id}`}><ReceiptText size={14}/> {expandedSaleId===sale.id?'إخفاء الأصناف':'الأصناف'}</button>}{onPrint&&<button className="table-action" onClick={()=>onPrint(sale)} data-testid={`button-print-${sale.id}`}><Printer size={14}/> إيصال</button>}{onReturn&&<button className="table-action" onClick={()=>onReturn(sale)} data-testid={`button-return-${sale.id}`}><RotateCcw size={14}/> مرتجع</button>}</td>}
              </tr>
              {expandedSaleId===sale.id&&<tr className="sale-line-detail-row"><td colSpan={columnCount}><section className="sale-line-detail-panel"><b>الأصناف المباعة وأسعارها</b><SaleItemsTable items={sale.items??[]} money={money}/></section></td></tr>}
              {sale.exchangeEvents.map((event,index)=>(
                <tr className="sale-exchange-row" key={`${sale.id}-${event.exchangeInvoiceNo}-${index}`}>
                  <td colSpan={columnCount}>
                    <article className="sale-exchange-detail">
                      <header>
                        <b><ArrowLeftRight size={15}/> عملية استبدال مرتبطة بالفاتورة</b>
                        <span>الأصلية: <strong className="ltr-id">{latinizeDigits(event.originalInvoiceNo)}</strong></span>
                        <span>فاتورة البديل: <strong className="ltr-id">{latinizeDigits(event.exchangeInvoiceNo)}</strong></span>
                        <span>{dateTimeLabel(event.createdAt)}</span>
                        <span>نفّذ العملية: <strong>{event.performedBy}</strong></span>
                      </header>
                      {event.detailsAvailable?<>
                        <div className="sale-exchange-items">
                          <div><b>الأصناف المرتجعة</b><ul>{event.returnedItems.map(item=><li key={item.productId}>{latinizeDigits(item.name)} <span>× {fmt(item.quantity)}</span></li>)}</ul></div>
                          <div><b>الأصناف البديلة</b><ul>{event.replacementItems.map(item=><li key={item.productId}>{latinizeDigits(item.name)} <span>× {fmt(item.quantity)}</span></li>)}</ul></div>
                        </div>
                        <div className="sale-exchange-amounts">
                          <span>قيمة المرتجع: <b>{event.refundAmount===null?'—':money(event.refundAmount)}</b></span>
                          <span>قيمة البديل: <b>{event.replacementTotal===null?'—':money(event.replacementTotal)}</b></span>
                          <strong className={event.balanceDue===null?'':event.balanceDue>0?'exchange-due':'exchange-refund'}>
                            {event.balanceDue===null?'فرق السعر غير متوفر':event.balanceDue>0?`على العميل ${money(event.balanceDue)}`:event.balanceDue<0?`مستحق للعميل ${money(Math.abs(event.balanceDue))}؛ يُرد من المتجر`:'لا يوجد فرق سعر'}
                          </strong>
                        </div>
                      </>:<p className="sale-exchange-legacy">الاستبدال مسجّل، لكن تفاصيل الأصناف غير متوفرة في السجلات القديمة.</p>}
                    </article>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function paymentName(p:string) { return p==='cash'?'نقداً':p==='card'?'بطاقة':p==='instapay'?'إنستا باي':'محفظة'; }
function createHeldInvoiceReference() { return `XS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,7).toUpperCase()}`; }
function heldWhatsAppMessage(held:HeldSale, products:Product[], money:(value:number)=>string) {
  const productNames=new Map(products.map(product=>[product.id,product.name]));
  return [
    `فاتورة معلّقة رقم ${held.reference}`,
    'الحالة: معلّقة - غير مدفوعة',
    `العميل: ${held.customerName||'عميل نقدي'}`,
    `التاريخ: ${dateLabel(held.createdAt)}`,
    'الأصناف:',
    ...held.items.map(item=>`- ${latinizeDigits(productNames.get(item.productId)||'منتج')} × ${fmt(item.quantity)} · ${money(item.unitPrice*item.quantity)}`),
    `الخصم: ${money(held.discountAmount)}`,
    `الإجمالي شامل الضريبة: ${money(held.estimatedTotal)}`,
    `طريقة الدفع المختارة: ${paymentName(held.paymentMethod)}`,
    ...(held.transferSender?[`التحويل من: ${held.transferSender}`]:[]),
    'لم يتم استلام أي مبلغ بعد.',
    'شكراً لزيارتكم',
  ].join('\n');
}
function ReceiptModal({sale,close}:{sale:Sale;close:()=>void}) {
  const money=useMoney();
  const session=useGetXStoreSession();
  const invoiceFormat=session.data?.invoiceFormat??'wide';
  const thermal=invoiceFormat!=='wide';
  const printFormatClass=invoiceFormat==='thermal_80mm'?'receipt-modal--thermal-80':invoiceFormat==='thermal_58mm'?'receipt-modal--thermal-58':'receipt-modal--wide';
  const items=sale.items??[];
  const storeName=sale.tenantName?.trim()||'المتجر';
  const whatsappMessage=[
    `فاتورة ${storeName} رقم ${latinizeDigits(sale.invoiceNo)}`,
    'X-Store',
    `الحالة: ${sale.status==='completed'?'مدفوعة':statusNames[sale.status]}`,
    ...(sale.customerName?[`العميل: ${sale.customerName}`]:[]),
    ...(sale.orderType?[`نوع الطلب: ${sale.orderType==='internal'?'داخلي':'خارجي'}`]:[]),
    ...(sale.orderType==='internal'?[`رقم الترابيزة: ${sale.tableNumber||'—'}`]:[]),
    `التاريخ والوقت: ${dateTimeLabel(sale.createdAt)}`,
    `الحساب: ${sale.cashierName}`,
    `عدد الأصناف: ${fmt(sale.itemCount)}`,
    'تفاصيل الأصناف:',
    ...items.map(item=>`- ${latinizeDigits(item.name)} × ${fmt(item.quantity)} · سعر الوحدة ${money(item.unitPrice)} · إجمالي الصنف ${money(roundMoney(item.unitPrice*item.quantity))}`),
    `طريقة الدفع: ${paymentName(sale.paymentMethod)}`,
    ...(sale.transferSender?[`التحويل من: ${sale.transferSender}`]:[]),
    `المجموع الفرعي: ${money(sale.subtotal)}`,
    `الخصم: ${money(sale.discountAmount)}`,
    `الضريبة: ${money(sale.taxAmount)}`,
    `الإجمالي: ${money(sale.total)}`,
    `المبلغ المستلم: ${money(sale.amountReceived)}`,
    `الباقي: ${money(sale.changeAmount)}`,
    'شكراً لزيارتكم',
  ].join('\n');
  const whatsappUrl=items.length?createWhatsAppInvoiceUrl(sale.customerPhone,whatsappMessage):null;
  return createPortal(<div className={`modal-backdrop receipt-backdrop${!thermal?' receipt-backdrop--wide':''}`}><section className={`modal receipt-modal ${printFormatClass}`} role="dialog" aria-modal="true" dir="rtl">
    {!thermal?<div className="receipt-refined-top">
      <span className="receipt-success-mark" aria-hidden="true"><CircleCheck size={24}/></span>
      <div className="receipt-refined-title">
        <small>{sale.status==='completed'?'تمت عملية البيع بنجاح':'ملخص عملية البيع'}</small>
        <h2>{storeName}</h2>
        <span>إيصال بيع</span>
      </div>
      <div className="receipt-refined-amount">
        <small>إجمالي الفاتورة</small>
        <strong>{money(sale.total)}</strong>
      </div>
    </div>:<header className="receipt-thermal-head">
      <small>إيصال بيع</small>
      <h2>{storeName}</h2>
      <span>نسخة العميل</span>
    </header>}
    <div className={`receipt-refined-body${thermal?' receipt-thermal-body':''}`}>
      <div className="receipt-watermark" aria-hidden="true">
        <img src={`${basePath}/x-store-receipt-watermark.jpeg`} alt=""/>
      </div>
      <div className={`receipt-success-row${thermal?' receipt-thermal-status':''}`}>
        <span className="receipt-paid-status"><CircleCheck size={14}/>{sale.status==='completed'?'مدفوعة':statusNames[sale.status]} · {paymentName(sale.paymentMethod)}</span>
      <span className="receipt-refined-invoice">رقم الفاتورة <b>{latinizeDigits(sale.invoiceNo)}</b></span>
      </div>
      <div className={`receipt-refined-meta${thermal?' receipt-thermal-meta':''}${invoiceFormat==='thermal_58mm'?' receipt-thermal-meta--58':''}`}>
        {sale.customerName&&<div className="receipt-meta-item"><span>اسم العميل</span><b>{sale.customerName}</b></div>}
        {sale.orderType&&<div className="receipt-meta-item"><span>نوع الطلب</span><b>{sale.orderType==='internal'?'داخلي':'خارجي'}</b></div>}
        {sale.orderType==='internal'&&<div className="receipt-meta-item"><span>رقم الترابيزة</span><b>{sale.tableNumber||'—'}</b></div>}
        <div className="receipt-meta-item"><span>رقم هاتف العميل</span><b className="receipt-meta-ltr">{sale.customerPhone?latinizeDigits(sale.customerPhone):'—'}</b></div>
        <div className="receipt-meta-item"><span>التاريخ والوقت</span><b>{dateTimeLabel(sale.createdAt)}</b></div>
        <div className="receipt-meta-item receipt-meta-item--cashier"><span>الحساب المنفذ</span><b>{sale.cashierName}</b></div>
        <div className="receipt-meta-item"><span>عدد الوحدات</span><b>{fmt(sale.itemCount)}</b></div>
        <div className="receipt-meta-item receipt-meta-item--payment"><span>طريقة الدفع</span><b><Banknote size={14}/> {paymentName(sale.paymentMethod)}</b></div>
        {sale.transferSender&&<div className="receipt-meta-item"><span>التحويل من</span><b className="receipt-meta-ltr">{sale.transferSender}</b></div>}
      </div>
      <section className={`receipt-refined-items${thermal?' receipt-thermal-items':''}`}>
        <div className="receipt-refined-items-title"><span>تفاصيل الأصناف</span><small>{fmt(items.length)} أصناف · {fmt(sale.itemCount)} وحدات</small></div>
        <SaleItemsTable items={items} money={money} variant={thermal?'thermal':'receipt'}/>
      </section>
      <div className={`receipt-refined-summary${thermal?' receipt-thermal-summary':''}`}>
        <div className="receipt-payment-details">
          <div className="receipt-summary-line"><span>المبلغ المستلم</span><b>{money(sale.amountReceived)}</b></div>
          <div className="receipt-summary-line"><span>الباقي للعميل</span><b>{money(sale.changeAmount)}</b></div>
          <div className="receipt-summary-line"><span>حالة العملية</span><b>{sale.status==='completed'?'مكتملة':statusNames[sale.status]}</b></div>
        </div>
        <div className="receipt-total-panel">
          <div className="receipt-summary-line"><span>المجموع الفرعي</span><b>{money(sale.subtotal)}</b></div>
          <div className="receipt-summary-line discount"><span>الخصم</span><b>− {money(sale.discountAmount)}</b></div>
          <div className="receipt-summary-line"><span>الضريبة</span><b>{money(sale.taxAmount)}</b></div>
          <div className="receipt-summary-line receipt-total-amount"><span>الإجمالي</span><b>{money(sale.total)}</b></div>
        </div>
      </div>
      <p className={`receipt-thanks-refined${thermal?' receipt-thermal-thanks':''}`}>شكراً لزيارتكم، نتمنى لكم يوماً سعيداً</p>
      <div className={`modal-actions receipt-actions receipt-refined-actions${thermal?' receipt-thermal-actions':''}`}>
        <button className="button button-primary" disabled={!items.length} title={!items.length?'لا يمكن طباعة فاتورة بدون تفاصيل الأصناف':''} onClick={()=>window.print()}><Printer size={16}/> طباعة الإيصال</button>
        {whatsappUrl&&<a className="button button-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/> إرسال عبر واتساب</a>}
        <button className="button button-quiet" onClick={close}>إغلاق</button>
      </div>
    </div>
  </section></div>,document.body);
}
function TenantsPage() {
  const qc=useQueryClient();
  const tenants=useListXStoreTenants();
  const create=useCreateXStoreTenant();
  const update=useUpdateXStoreTenant();
  const credentials=useUpdateXStoreTenantCredentials();
  const [search,setSearch]=useState('');
  const [dialog,setDialog]=useState(false);
  const [selectedStoreType,setSelectedStoreType]=useState('');
  const [wholesaleEnabled,setWholesaleEnabled]=useState(false);
  const [accessTenant,setAccessTenant]=useState<Tenant|null>(null);
  const [editTenant,setEditTenant]=useState<Tenant|null>(null);
  const [editStoreType,setEditStoreType]=useState('');
  const [editWholesaleEnabled,setEditWholesaleEnabled]=useState(false);
  const [tenantToEditId,setTenantToEditId]=useState('');
  const [notice,setNotice]=useState('');
  const [deletingTenant,setDeletingTenant]=useState<Tenant|null>(null);
  const [deleteError,setDeleteError]=useState('');
  const filtered=useMemo(()=> (tenants.data||[]).filter(t=>`${t.name} ${t.ownerName} ${t.phone} ${t.email||''} ${t.businessType} ${storeTypeName(t.storeType)} ${getPhoneCountry(t.countryCode).name}`.toLowerCase().includes(search.toLowerCase())),[tenants.data,search]);
  const tenantToEdit=tenants.data?.find((tenant)=>tenant.id===tenantToEditId);
  function refreshTenants(){qc.invalidateQueries({queryKey:getListXStoreTenantsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});}
  function openTenantEdit(tenant:Tenant) {
    update.reset();
    setEditTenant(tenant);
    setEditStoreType(tenant.storeType||'');
    setEditWholesaleEnabled(
      storeTypeSupportsWholesale(tenant.storeType)&&tenant.wholesaleEnabled,
    );
  }
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
      storeType:String(f.get('storeType')) as (typeof storeTypeOptions)[number]['value'],
      wholesaleEnabled:storeTypeSupportsWholesale(selectedStoreType)&&wholesaleEnabled,
      countryCode:String(f.get('countryCode')),
       currency:String(f.get('currency')) as StoreCurrency,
      plan:String(f.get('plan')) as 'monthly'|'annual'|'half_yearly'|'lifetime',
    }},{onSuccess:()=>{refreshTenants();setDialog(false);setSelectedStoreType('');setWholesaleEnabled(false);setNotice('تم إنشاء المتجر وحساب المالك');}});
  }
  function submitCredentials(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!accessTenant)return;
    const f=new FormData(e.currentTarget);
    credentials.mutate({tenantId:accessTenant.id,data:{phone:String(f.get('phone')),password:String(f.get('password'))}},{onSuccess:()=>{refreshTenants();setAccessTenant(null);setNotice('تم تحديث بيانات دخول مالك المتجر');}});
  }
  async function confirmDeleteTenant() {
    if (!deletingTenant) return;
    setDeleteError('');
    try {
      const response = await fetch(`/api/xstore/tenants/${deletingTenant.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        let message = 'تعذر حذف المتجر نهائيًا.';
        try {
          const body = await response.json() as { error?: string };
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }
      refreshTenants();
      setDeletingTenant(null);
      setNotice(`تم حذف متجر ${deletingTenant.name} نهائيًا.`);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'تعذر حذف المتجر نهائيًا.');
    }
  }

  function submitTenantEdit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!editTenant)return;
    const f=new FormData(e.currentTarget);
    const rawStoreType=String(f.get('storeType')||'');
    const storeType=rawStoreType as (typeof storeTypeOptions)[number]['value'];
    const name=String(f.get('name')||'').trim();
    const businessType=String(f.get('businessType')||'').trim();
    update.mutate({
      tenantId:editTenant.id,
      data:{
        name,
        businessType,
        ...(rawStoreType?{storeType}:{}),
        wholesaleEnabled:storeTypeSupportsWholesale(rawStoreType||editTenant.storeType)&&editWholesaleEnabled,
      },
    },{
      onSuccess:()=>{
        refreshTenants();
        setEditTenant(null);
        setNotice(`تم تحديث بيانات متجر ${name}`);
      },
      onError:error=>setNotice(apiErrorMessage(error,'تعذر تحديث بيانات المتجر.')),
    });
  }
  return <><PageTitle eyebrow="إدارة المنصة" title="المتاجر" desc="إدارة المتاجر والاشتراكات وإنشاء بيانات دخول كل مالك." action={<button onClick={()=>{setSelectedStoreType('');setWholesaleEnabled(false);setDialog(true)}} className="button button-primary" data-testid="button-add-tenant"><Plus size={17}/> إضافة متجر</button>}/>
    <div className="tenant-summary"><span><Store size={17}/> {fmt(filtered.length)} متجر</span><span><CircleCheck size={17}/> {fmt(filtered.filter(t=>t.status==='active').length)} نشط</span><span><Clock3 size={17}/> {fmt(filtered.filter(t=>t.status==='trial').length)} تجريبي</span></div>
    <div className="tenant-edit-toolbar">
      <label className="field"><span>اختر متجرًا لتعديل بياناته</span><select value={tenantToEditId} onChange={e=>setTenantToEditId(e.target.value)}><option value="">اختر متجرًا</option>{tenants.data?.map(tenant=><option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
      <button className="button button-quiet" type="button" disabled={!tenantToEdit||update.isPending} onClick={()=>tenantToEdit&&openTenantEdit(tenantToEdit)}><Pencil size={15}/> تعديل المتجر</button>
    </div>
    <Card><SectionHead title="قائمة المتاجر" detail="تحديث الحالة وتغيير بيانات دخول المالك مسجلان في سجل التدقيق."/>
      <div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المتجر أو المالك أو الهاتف" data-testid="input-search-tenants"/></label><span className="result-count">{fmt(filtered.length)} نتيجة</span></div>
      {tenants.isLoading?<StateBlock loading error={false} onRetry={()=>tenants.refetch()} empty={false}/>:tenants.isError?<StateBlock loading={false} error onRetry={()=>tenants.refetch()} empty={false}/>:filtered.length?<><div className="table-wrap tenants-table-desktop"><table><thead><tr><th>المتجر</th><th>المالك</th><th>نوع المتجر والنشاط</th><th>العملة الأساسية</th><th>الحالة</th><th>الخطة</th><th>انتهاء الاشتراك</th><th>الفروع</th><th>إجراء</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><b>{t.name}</b><small>{t.email||t.phone}</small></td><td>{t.ownerName}<small dir="ltr">{t.phone}</small></td><td><b>{storeTypeName(t.storeType)}</b><small>{t.businessType} · {getPhoneCountry(t.countryCode).name} (+{getPhoneCountry(t.countryCode).callingCode}) · {t.wholesaleEnabled?'الجملة مفعلة':'الجملة غير مفعلة'}</small></td><td><select aria-label={`تغيير العملة الأساسية لمتجر ${t.name}`} defaultValue={t.currency} disabled={update.isPending} onChange={e=>changeCurrency(t,e.currentTarget.value as StoreCurrency,e.currentTarget)}>{currencyOptions.map(currency=><option key={currency.value} value={currency.value}>{currency.label}</option>)}</select></td><td><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></td><td>{statusNames[t.plan]}</td><td>{dateLabel(t.subscriptionEndsAt)}</td><td>{fmt(t.branchCount)}</td><td><div className="table-actions-cell"><select aria-label={`تغيير حالة ${t.name}`} value={t.status} disabled={update.isPending} onChange={e=>update.mutate({tenantId:t.id,data:{status:e.target.value as 'active'|'trial'|'suspended'}},{onSuccess:()=>{refreshTenants();setNotice(`تم تحديث حالة ${t.name}`)}})}><option value="active">نشط</option><option value="trial">تجريبي</option><option value="suspended">إيقاف</option></select><button className="table-action" onClick={()=>setAccessTenant(t)}><KeyRound size={14}/> بيانات الدخول</button><button className="table-action team-action-danger" onClick={()=>{setDeleteError('');setDeletingTenant(t)}}><Trash2 size={14}/> حذف نهائي</button></div></td></tr>)}</tbody></table></div><div className="tenants-mobile-list">{filtered.map(t=><article className="tenant-mobile-card" key={t.id}><div className="tenant-mobile-head"><div className="tenant-mobile-avatar">{t.name.slice(0,1)}</div><div className="tenant-mobile-title"><b>{t.name}</b><small>{t.ownerName}</small></div><span className={`status-pill status-${t.status}`}>{statusNames[t.status]}</span></div><div className="tenant-mobile-meta"><div><span>نوع المتجر</span><b>{storeTypeName(t.storeType)}</b></div><div><span>الخطة</span><b>{statusNames[t.plan]}</b></div><div><span>العملة</span><select aria-label={`تغيير العملة الأساسية لمتجر ${t.name}`} defaultValue={t.currency} disabled={update.isPending} onChange={e=>changeCurrency(t,e.currentTarget.value as StoreCurrency,e.currentTarget)}>{currencyOptions.map(currency=><option key={currency.value} value={currency.value}>{currency.label}</option>)}</select></div></div><div className="tenant-mobile-details"><span>{t.businessType||'نشاط تجاري'} · {getPhoneCountry(t.countryCode).name} (+{getPhoneCountry(t.countryCode).callingCode})</span><span>ينتهي: {dateLabel(t.subscriptionEndsAt)}</span><span>{fmt(t.branchCount)} فرع</span></div><div className="tenant-mobile-actions"><select aria-label={`تغيير حالة ${t.name}`} value={t.status} disabled={update.isPending} onChange={e=>update.mutate({tenantId:t.id,data:{status:e.target.value as 'active'|'trial'|'suspended'}},{onSuccess:()=>{refreshTenants();setNotice(`تم تحديث حالة ${t.name}`)}})}><option value="active">نشط</option><option value="trial">تجريبي</option><option value="suspended">إيقاف</option></select><button className="table-action" onClick={()=>setAccessTenant(t)}><KeyRound size={14}/> بيانات الدخول</button><button className="table-action team-action-danger" onClick={()=>{setDeleteError('');setDeletingTenant(t)}}><Trash2 size={14}/> حذف نهائي</button></div></article>)}</div></>:<div className="empty-inline">لا توجد متاجر تطابق البحث.</div>}
    </Card>
    {notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
     {deletingTenant&&<Modal title={`حذف المتجر نهائيًا · ${deletingTenant.name}`} close={()=>{if(!deletingTenant?.name)return;setDeletingTenant(null);setDeleteError('')}}>
      <div className="role-hint field-wide" style={{borderColor:'rgba(180,40,40,.35)'}}>
        <Trash2 size={18}/>
        <span><b>تحذير: هذا الإجراء نهائي ولا يمكن التراجع عنه.</b><br/>سيتم حذف المتجر وبياناته وحساب مالكه وبيانات الفريق والمبيعات والمخزون وحسابات العملاء الخاصة به.</span>
      </div>
      {deleteError&&<div className="form-error" role="alert">{deleteError}</div>}
      <div className="modal-actions">
        <button className="button button-quiet" type="button" onClick={()=>{setDeletingTenant(null);setDeleteError('')}}>إلغاء</button>
        <button className="button team-action-danger" type="button" disabled={Boolean(deleteError) && false} onClick={confirmDeleteTenant}>حذف المتجر نهائيًا</button>
      </div>
    </Modal>}
    {editTenant&&<Modal title={`تعديل بيانات المتجر · ${editTenant.name}`} close={()=>setEditTenant(null)}><form className="form-grid" onSubmit={submitTenantEdit}>
       <Field label="اسم المتجر" name="name" required defaultValue={editTenant.name}/>
       <label className="field"><span>نوع المتجر / النشاط</span><select name="storeType" value={editStoreType} required={Boolean(editTenant.storeType)} onChange={e=>{setEditStoreType(e.target.value);if(!storeTypeSupportsWholesale(e.target.value))setEditWholesaleEnabled(false)}}><option value="">غير محدد</option>{storeTypeOptions.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
       <Field label="وصف النشاط" name="businessType" required defaultValue={editTenant.businessType}/>
       <label className="role-hint field-wide"><input type="checkbox" checked={editWholesaleEnabled} disabled={!storeTypeSupportsWholesale(editStoreType||editTenant.storeType)} onChange={e=>setEditWholesaleEnabled(e.target.checked)}/><span>تفعيل قسم بيع الجملة لهذا المتجر. اختيار نشاط غير مؤهل سيوقف الجملة تلقائيًا، وإيقافها لا يحذف أسعار الجملة المحفوظة.</span></label>
       {update.isError&&<div className="form-error">{apiErrorMessage(update.error,'تعذر تحديث بيانات المتجر.')}</div>}
       <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setEditTenant(null)}>إلغاء</button><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ الحفظ…':'حفظ التغييرات'}</button></div>
     </form></Modal>}
    {dialog&&<Modal title="إضافة متجر وحساب مالكه" close={()=>{setDialog(false);setSelectedStoreType('');setWholesaleEnabled(false)}}><form className="form-grid" onSubmit={submit}>
      <Field label="اسم المتجر" name="name" required/><label className="field"><span>نوع المتجر</span><select name="storeType" value={selectedStoreType} onChange={e=>{setSelectedStoreType(e.target.value);if(!storeTypeSupportsWholesale(e.target.value))setWholesaleEnabled(false)}} required><option value="" disabled>اختر نوع المتجر</option>{storeTypeOptions.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <Field label="اسم المالك" name="ownerName" required/>
      <Field label="رقم هاتف الدخول" name="phone" type="tel" required placeholder="+20 10 1234 5678"/>
      <Field label="كلمة مرور المالك" name="ownerPassword" type="password" required maxLength={128} placeholder="اكتب كلمة المرور"/>
      <Field label="البريد الإلكتروني (اختياري)" name="email" type="email"/>
      <Field label="وصف النشاط" name="businessType" required placeholder="مثال: ملابس رجالي أو أزياء نسائية"/>
      {storeTypeSupportsWholesale(selectedStoreType)&&<label className="role-hint field-wide"><input type="checkbox" checked={wholesaleEnabled} onChange={e=>setWholesaleEnabled(e.target.checked)}/><span>تفعيل قسم بيع الجملة لهذا المتجر. يمكنك اختيار أسعار الجملة والقطاعي لكل منتج.</span></label>}
      {!selectedStoreType&&<div className="role-hint field-wide"><Store size={16}/><span>يمكن تفعيل الجملة للملابس والأحذية، والبقالة، والإلكترونيات، والعطور والتجميل فقط.</span></div>}
       <label className="field"><span>دولة المتجر</span><select name="countryCode" defaultValue="EG" required>{phoneCountries.map(country=><option key={country.countryCode} value={country.countryCode}>{country.name} (+{country.callingCode})</option>)}</select></label>
       <div className="role-hint field-wide"><Phone size={16}/><span>سيُستخدم مفتاح الدولة تلقائيًا في أرقام العملاء على فواتير هذا المتجر.</span></div>
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
  const qc = useQueryClient();
  const team = useListXStoreTeam();
  const add = useAddXStoreTeamMember();
  const update = useUpdateXStoreTeamMember();
  const remove = useDeleteXStoreTeamMember();
  const [dialog, setDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<TeamPermission[]>([]);
  const roleTitle: Record<string, string> = {
    tenant_admin: 'مالك المتجر',
    cashier: 'أمين الصندوق',
    warehouse_manager: 'مدير المخزون',
    accountant: 'محاسب',
    custom: 'دور مخصص',
  };
  const members = (team.data || []).filter((member) =>
    `${member.name} ${member.phone || ''} ${member.email || ''} ${member.roleName || ''} ${(member.permissions || []).join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function openDialog() {
    add.reset();
    setSelectedPermissions([]);
    setDialog(true);
  }
  function closeDialog() {
    setDialog(false);
    setSelectedPermissions([]);
  }
  function openEdit(member: TeamMember) {
    update.reset();
    setEditingMember(member);
    const permissions = member.role === 'custom'
      ? member.permissions
      : member.role === 'cashier'
        ? ['cashier' as TeamPermission]
        : teamPermissionOptions
            .filter((option) => option.value === member.role)
            .map((option) => option.value);
    setSelectedPermissions(normalizeTeamPermissions(permissions));
  }
  function closeEdit() {
    setEditingMember(null);
    setSelectedPermissions([]);
  }
  function togglePermission(permission: TeamPermission) {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }
  function memberPermissionSummary(role: string, permissions: TeamPermission[]) {
    const assigned =
      role === 'custom'
        ? normalizeTeamPermissions(permissions)
        : role === 'cashier'
          ? ['retail_sales', 'wholesale_sales'] as TeamPermission[]
        : teamPermissionOptions
            .filter((option) => option.value === role)
            .map((option) => option.value);
    return assigned.map((permission) => teamPermissionNames[permission]).join(' · ') || 'بدون صلاحيات محددة';
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const roleName = String(form.get('roleName') || '').trim();
    if (!roleName || !selectedPermissions.length) return;
    add.mutate(
      {
        data: {
          name: String(form.get('name')).trim(),
          phone: String(form.get('phone')),
          password: String(form.get('password')),
          email: String(form.get('email') || '').trim() || null,
          roleName,
          permissions: selectedPermissions,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListXStoreTeamQueryKey() });
          closeDialog();
          setNotice('تم حفظ حساب عضو الفريق والصلاحيات المحددة');
        },
      },
    );
  }
  function submitEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingMember) return;
    const form = new FormData(e.currentTarget);
    const roleName = String(form.get('roleName') || '').trim();
    if (!roleName || !selectedPermissions.length) return;
    const password = String(form.get('password') || '');
    update.mutate(
      {
        memberId: editingMember.id,
        data: {
          name: String(form.get('name')).trim(),
          phone: String(form.get('phone')),
          email: String(form.get('email') || '').trim() || null,
          roleName,
          permissions: selectedPermissions,
          ...(password ? { password } : {}),
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListXStoreTeamQueryKey() });
          closeEdit();
          setNotice('تم تحديث الحساب. سيحتاج العضو لتسجيل الدخول مرة أخرى.');
        },
      },
    );
  }
  function confirmDelete() {
    if (!deletingMember) return;
    remove.mutate(
      { memberId: deletingMember.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListXStoreTeamQueryKey() });
          setNotice(`تم حذف حساب ${deletingMember.name} وإيقاف دخوله`);
          setDeletingMember(null);
        },
      },
    );
  }

  return (
    <>
      <PageTitle
        eyebrow="إدارة الصلاحيات"
        title="فريق العمل"
        desc="أضف أعضاء الفريق، وعدّل بيانات دخولهم وصلاحياتهم."
        action={
          <button
            className="button button-primary"
            onClick={openDialog}
            data-testid="button-add-team-member"
          >
            <Plus size={17} /> إضافة عضو
          </button>
        }
      />
      <div className="team-summary">
        <div>
          <span className="team-summary-icon"><Users size={18} /></span>
          <b>{fmt(members.length)} عضو</b>
          <small>ضمن فريق متجرك</small>
        </div>
        <div>
          <span className="team-summary-icon team-sage"><ShieldCheck size={18} /></span>
          <b>صلاحيات تختارها يدويًا</b>
          <small>كل عضو حسب مهامه</small>
        </div>
        <div className="team-summary-note">إدارة الفريق وإعدادات المتجر خاصة بمالك المتجر.</div>
      </div>
      <Card>
        <SectionHead title="أعضاء الفريق" detail="يمكنك تعديل بيانات الدخول والصلاحيات أو سحب الوصول." />
        <div className="table-toolbar">
          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم العضو أو الدور"
              data-testid="input-search-team"
            />
          </label>
          <span className="result-count">{fmt(members.length)} عضو</span>
        </div>
        {team.isLoading ? (
          <StateBlock loading error={false} onRetry={() => team.refetch()} empty={false} />
        ) : team.isError ? (
          <StateBlock loading={false} error onRetry={() => team.refetch()} empty={false} />
        ) : members.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>عضو الفريق</th>
                  <th>رقم الهاتف</th>
                  <th>البريد الإلكتروني</th>
                  <th>الدور</th>
                  <th>الصلاحيات</th>
                  <th>الحالة</th>
                  <th>تاريخ الإضافة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-name">
                        <span>{member.name.slice(0, 1)}</span>
                        <b>{member.name}</b>
                      </div>
                    </td>
                    <td dir="ltr">{member.phone || '—'}</td>
                    <td>{member.email || '—'}</td>
                    <td>{member.roleName || roleTitle[member.role] || member.role}</td>
                    <td>{memberPermissionSummary(member.role, member.permissions)}</td>
                    <td>
                      <span className={`status-pill ${member.status === 'active' ? 'status-active' : 'status-trial'}`}>
                        {member.status === 'active' ? 'نشط' : 'دعوة مرسلة'}
                      </span>
                    </td>
                    <td>{dateLabel(member.createdAt)}</td>
                    <td>
                      {member.role === 'tenant_admin' ? (
                        <span className="team-owner-note">حساب المالك</span>
                      ) : (
                        <div className="team-member-actions">
                          <button
                            className="table-action"
                            onClick={() => openEdit(member)}
                            aria-label={`تعديل حساب ${member.name}`}
                            title="تعديل الحساب"
                          >
                            <Pencil size={15} /> تعديل
                          </button>
                          <button
                            className="table-action team-action-danger"
                            onClick={() => {
                              remove.reset();
                              setDeletingMember(member);
                            }}
                            aria-label={`حذف حساب ${member.name}`}
                            title="حذف الحساب"
                          >
                            <Trash2 size={15} /> حذف
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state-box">
            <div className="empty-symbol"><Users /></div>
            <b>ابدأ ببناء فريقك</b>
            <span>أضف عضوًا وحدد له الدور والصلاحيات المناسبة.</span>
            <button className="button button-primary" onClick={openDialog}>
              <Plus size={16} /> إضافة عضو
            </button>
          </div>
        )}
      </Card>

      {dialog && (
        <Modal title="إضافة حساب لفريق العمل" close={closeDialog}>
          <form className="form-grid" onSubmit={submit}>
            <Field label="اسم العضو" name="name" required maxLength={100} />
            <Field label="رقم هاتف الدخول" name="phone" type="tel" required placeholder="+20 10 1234 5678" />
            <Field label="كلمة المرور" name="password" type="password" required maxLength={128} placeholder="اكتب كلمة المرور" />
            <Field label="البريد الإلكتروني (اختياري)" name="email" type="email" />
            <Field className="field-wide" label="اسم الدور" name="roleName" required maxLength={50} placeholder="مثال: مشرف الوردية" />
            <fieldset className="team-permission-list field-wide">
              <legend>الصلاحيات — اختر واحدة أو أكثر</legend>
              {teamPermissionOptions.map(({ value, label, description }) => (
                <label key={value} className={`team-permission-option ${selectedPermissions.includes(value) ? 'is-selected' : ''}`}>
                  <input type="checkbox" checked={selectedPermissions.includes(value)} onChange={() => togglePermission(value)} />
                  <span className="team-permission-copy"><b>{label}</b><small>{description}</small></span>
                </label>
              ))}
            </fieldset>
            {!selectedPermissions.length && (
              <small className="team-permission-note field-wide">اختر صلاحية واحدة على الأقل قبل حفظ الحساب.</small>
            )}
            <div className="role-hint field-wide">
              <ShieldCheck size={17} />
              <span>يمكن جمع أكثر من صلاحية. لا تمنح هذه الخيارات إدارة الفريق أو إعدادات المتجر أو بيانات متاجر أخرى.</span>
            </div>
            {add.isError && <div className="form-error">{apiErrorMessage(add.error, 'تعذر حفظ الحساب. تحقق من رقم الهاتف والصلاحيات.')}</div>}
            <div className="modal-actions">
              <button className="button button-quiet" type="button" onClick={closeDialog}>إلغاء</button>
              <button className="button button-primary" disabled={add.isPending || !selectedPermissions.length}>
                {add.isPending ? 'جارٍ الحفظ…' : 'حفظ الحساب'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingMember && (
        <Modal title={`تعديل حساب ${editingMember.name}`} close={closeEdit}>
          <form className="form-grid" onSubmit={submitEdit}>
            <Field label="اسم العضو" name="name" required maxLength={100} defaultValue={editingMember.name} />
            <Field label="رقم الهاتف" name="phone" type="tel" required defaultValue={editingMember.phone || ''} placeholder="+20 10 1234 5678" />
            <Field label="البريد الإلكتروني (اختياري)" name="email" type="email" defaultValue={editingMember.email || ''} />
            <Field label="كلمة مرور جديدة (اختياري)" name="password" type="password" maxLength={128} placeholder="اتركها فارغة بدون تغيير" />
            <Field className="field-wide" label="اسم الدور" name="roleName" required maxLength={50} defaultValue={editingMember.roleName || roleTitle[editingMember.role] || ''} />
            <fieldset className="team-permission-list field-wide">
              <legend>الصلاحيات — اختر واحدة أو أكثر</legend>
              {teamPermissionOptions.map(({ value, label, description }) => (
                <label key={value} className={`team-permission-option ${selectedPermissions.includes(value) ? 'is-selected' : ''}`}>
                  <input type="checkbox" checked={selectedPermissions.includes(value)} onChange={() => togglePermission(value)} />
                  <span className="team-permission-copy"><b>{label}</b><small>{description}</small></span>
                </label>
              ))}
            </fieldset>
            {!selectedPermissions.length && (
              <small className="team-permission-note field-wide">اختر صلاحية واحدة على الأقل قبل حفظ الحساب.</small>
            )}
            <div className="role-hint field-wide">
              <KeyRound size={17} />
              <span>لو غيّرت رقم الهاتف أو كلمة المرور، هيتطلب من العضو تسجيل الدخول من جديد. ترك كلمة المرور فارغة يحافظ على الحالية.</span>
            </div>
            {update.isError && <div className="form-error">{apiErrorMessage(update.error, 'تعذر تحديث الحساب. راجع رقم الهاتف والصلاحيات.')}</div>}
            <div className="modal-actions">
              <button className="button button-quiet" type="button" onClick={closeEdit}>إلغاء</button>
              <button className="button button-primary" disabled={update.isPending || !selectedPermissions.length}>
                {update.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingMember && (
        <Modal title="تأكيد حذف الحساب" close={() => setDeletingMember(null)}>
          <div className="team-delete-confirm">
            <div className="team-delete-icon"><Trash2 size={21} /></div>
            <b>حذف حساب {deletingMember.name}؟</b>
            <p>سيتم إزالة العضو من الفريق، وإيقاف تسجيل دخوله، وإلغاء رقم الهاتف والبريد من الحساب.</p>
            <p className="team-delete-retention">الفواتير وسجل العمليات القديمة هيفضلوا محفوظين باسم العضو للحفاظ على السجل المالي.</p>
            {remove.isError && <div className="form-error">{apiErrorMessage(remove.error, 'تعذر حذف الحساب.')}</div>}
            <div className="modal-actions">
              <button className="button button-quiet" type="button" onClick={() => setDeletingMember(null)}>إلغاء</button>
              <button className="button button-danger" onClick={confirmDelete} disabled={remove.isPending}>
                {remove.isPending ? 'جارٍ حذف الحساب…' : 'حذف الحساب وإيقاف الدخول'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {notice && <div className="toast-note" role="status">{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
    </>
  );
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
  const [invoiceFormat,setInvoiceFormat]=useState<InvoiceFormat>('wide');
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(session.data?.vatRate!=null)setVatPercent(String(session.data.vatRate*100));
    if(session.data?.invoiceFormat)setInvoiceFormat(session.data.invoiceFormat);
  },[session.data?.vatRate,session.data?.invoiceFormat]);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const percent=Number(vatPercent);
    if(!Number.isFinite(percent)||percent<0||percent>100)return;
    update.mutate({data:{vatRate:percent/100,invoiceFormat}},{onSuccess:settings=>{
      setVatPercent(String(settings.vatRate*100));
      setInvoiceFormat(settings.invoiceFormat);
      qc.setQueryData(getGetXStoreSessionQueryKey(),current=>current?{...current,vatRate:settings.vatRate,invoiceFormat:settings.invoiceFormat}:current);
      void qc.invalidateQueries({queryKey:getGetXStoreSessionQueryKey()});
      setNotice('تم حفظ نسبة الضريبة وتصميم الفاتورة لهذا المتجر.');
    }});
  }
  return <><PageTitle eyebrow="إعدادات المتجر" title="إعدادات الفاتورة" desc="اختر تصميم الورق المناسب لطابعتك وحدد نسبة الضريبة."/>
    <Card className="settings-card"><SectionHead title="نسبة الضريبة" detail="تُحفظ النسبة للمتجر كله، وتظهر لأمناء الصندوق عند البيع."/>
      {session.isLoading?<StateBlock loading error={false} onRetry={()=>session.refetch()} empty={false}/>:session.isError?<StateBlock loading={false} error onRetry={()=>session.refetch()} empty={false}/>:<form className="form-grid settings-form" onSubmit={submit}>
        <label className="field field-wide"><span>نسبة ضريبة القيمة المضافة</span><div className="vat-rate-input"><input aria-label="نسبة ضريبة القيمة المضافة" type="number" min="0" max="100" step="0.01" required value={vatPercent} onChange={e=>{setVatPercent(e.target.value);setNotice('')}}/><span>%</span></div></label>
        <div className="role-hint field-wide"><ShieldCheck size={16}/><span>اكتب النسبة من 0 إلى 100٪. تغييرها لا يعدّل الفواتير السابقة.</span></div>
        <div className="invoice-format-section field-wide">
          <SectionHead title="تصميم ومقاس الطباعة" detail="سيُستخدم الاختيار على فواتير المتجر عند الطباعة."/>
          <div className="invoice-format-options" role="radiogroup" aria-label="تصميم ومقاس الفاتورة">
            {invoiceFormatOptions.map(option=><label className={`invoice-format-option${invoiceFormat===option.value?' is-selected':''}`} key={option.value} data-testid={`invoice-format-${option.value}`}>
              <input type="radio" name="invoiceFormat" value={option.value} checked={invoiceFormat===option.value} onChange={()=>{setInvoiceFormat(option.value);setNotice('')}}/>
              <span className={`invoice-format-sample invoice-format-sample--${option.sampleClass}`} aria-hidden="true"><i/><i/><i/></span>
              <span className="invoice-format-copy"><b>{option.label}</b><small>{option.detail}</small></span>
            </label>)}
          </div>
          <div className="role-hint"><Printer size={16}/><span>اختر نفس عرض الرول الموجود في إعدادات الطابعة: 80 مم أو 58 مم.</span></div>
        </div>
        {update.isError&&<div className="form-error">{apiErrorMessage(update.error,'تعذر حفظ إعدادات الفاتورة.')}</div>}
        {notice&&<div className="settings-success"><CircleCheck size={16}/>{notice}</div>}
        <div className="modal-actions"><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ الحفظ…':'حفظ إعدادات الفاتورة'}</button></div>
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
  const [restaurantFeatureEnabledForIngredients, setRestaurantFeatureEnabledForIngredients] = useState<boolean | null>(null);
  useEffect(() => {
    if (!session.data) return;
    let cancelled = false;
    // Resolve the feature from the tenant endpoint even when the session already
    // contains a storeType; older/stale session payloads may not reflect the
    // actual restaurant/cafe configuration.
    void fetch('/api/xstore/restaurant-feature', { credentials: 'include', cache: 'no-store' })
      .then(async response => response.ok ? response.json() as Promise<{ enabled?: boolean }> : { enabled: false })
      .then(result => { if (!cancelled) setRestaurantFeatureEnabledForIngredients(result.enabled === true); })
      .catch(() => { if (!cancelled) setRestaurantFeatureEnabledForIngredients(false); });
    return () => { cancelled = true; };
  }, [session.data?.tenantId, session.data?.role, session.data?.storeType]);
  const money=useMoney();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('__all__');
  const [stockFilter, setStockFilter] = useState<'all'|'low'|'out'>('all');
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const isWarehouseManager = hasAppRole(session.data, ['warehouse_manager']);
  const canManage = session.data?.role === 'tenant_admin' || isWarehouseManager;
  const wholesaleEnabled = session.data?.wholesaleEnabled ?? false;
  const restaurantIngredientsEnabled = session.data?.storeType === 'cafe' || session.data?.storeType === 'restaurant' || (session.data?.storeType == null && restaurantFeatureEnabledForIngredients === true);
  const canViewCost = hasAppRole(session.data, ['tenant_admin', 'warehouse_manager', 'accountant', 'platform_admin']);
  const pricingOnlyEdit = isWarehouseManager && Boolean(edit);
  const [priceFormError, setPriceFormError] = useState('');
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
    const retailPriceText = String(f.get('price') || '').trim();
    const wholesalePriceText = wholesaleEnabled
      ? String(f.get('wholesalePrice') || '').trim()
      : '';
    const retailPrice = retailPriceText ? Number(retailPriceText) : null;
    const wholesalePrice = wholesalePriceText
      ? Number(wholesalePriceText)
      : null;
    if (
      (retailPrice === null && wholesalePrice === null) ||
      (retailPrice !== null &&
        (!Number.isFinite(retailPrice) || retailPrice < 0)) ||
      (wholesalePrice !== null &&
        (!Number.isFinite(wholesalePrice) || wholesalePrice < 0))
    ) {
      setPriceFormError('أدخل سعرًا صحيحًا واحدًا على الأقل: قطاعي أو جملة.');
      return;
    }
    setPriceFormError('');
    const costPriceText = String(f.get('costPrice') || '').trim();
    const priceData = {
      price: retailPrice,
      wholesalePrice,
      ...(costPriceText ? { costPrice: Number(costPriceText) } : {}),
    };
    const quantity = Number(f.get('quantity'));
    const done = () => {
      qc.invalidateQueries({ queryKey: getListXStoreProductsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetXStoreDashboardQueryKey() });
      setDialog(false);
      setEdit(null);
      setPriceFormError('');
      setNotice('تم حفظ بيانات المنتج');
    };
    if (edit) {
      const data = isWarehouseManager
        ? { ...priceData, quantity }
        : {
            ...priceData,
            name: String(f.get('name')),
            sku: edit.sku,
            barcode: String(f.get('barcode') || '') || null,
            category: edit.category,
            quantity,
            color: String(f.get('color') || '') || null,
            size: String(f.get('size') || '') || null,
            partNumber: String(f.get('partNumber') || '') || null,
            ingredients: restaurantIngredientsEnabled ? (String(f.get('ingredients') || '').trim() || null) : null,
            expiresAt: edit.expiresAt?.slice(0, 10) || null,
          };
      update.mutate({ productId: edit.id, data }, { onSuccess: done });
    } else {
      create.mutate({
        data: {
          ...priceData,
          name: String(f.get('name')),
          sku: `XST-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
          barcode: String(f.get('barcode') || '') || null,
          category: 'عام',
          quantity,
          color: String(f.get('color') || '') || null,
          size: String(f.get('size') || '') || null,
          partNumber: String(f.get('partNumber') || '') || null,
          ingredients: restaurantIngredientsEnabled ? (String(f.get('ingredients') || '').trim() || null) : null,
          expiresAt: null,
        },
      }, { onSuccess: done });
    }
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
    (total, product) => total + (product.price ?? 0) * product.quantity,
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