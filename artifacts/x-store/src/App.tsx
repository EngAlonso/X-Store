import { Fragment, createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
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
  Settings2, KeyRound, Phone, Mail, MessageCircle, ArrowLeft, ArrowUp, Eye, EyeOff, LockKeyhole, Smartphone, Database, Coffee, Utensils, Pencil as PencilIcon, Bird,
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
import PoultryBackupPage from '@/features/poultry/PoultryBackupPage';
import PoultryReportsPage from '@/features/poultry/PoultryReportsPage';
import PoultryFarmPage from '@/features/poultry/PoultryFarmPage';
import RestaurantMenuPage from '@/pages/restaurant-menu';
import PublicRestaurantMenu from '@/pages/public-restaurant-menu';
import type { OfflineActivationRequest } from './offline/licensing';
import { isOfflineHardwareFingerprint, type OfflineLicensePlan } from './offline/model';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const PoultryFeatureCustomersPage = lazy(() => import('@/features/poultry/PoultryPages').then(module => ({ default: module.PoultryCustomersPage })));
const PoultryFeatureCustomerAccountPage = lazy(() => import('@/features/poultry/PoultryPages').then(module => ({ default: module.PoultryCustomerAccountPage })));
import { PoultryInvoicesPage as PoultryFeatureInvoicesPage } from '@/features/poultry/PoultryPages';
import { PoultrySalePage as PoultryFeatureSalePage } from '@/features/poultry/PoultryPages';
const PoultryFeatureDashboardPage = lazy(() => import('@/features/poultry/PoultryPages').then(module => ({ default: module.PoultryDashboardPage })));

function getPoultryNavigation(user: SessionUser) {
  const permissions = user.permissions || [];
  const isAdmin = user.role === 'tenant_admin' || user.role === 'cashier';
  const isCustom = user.role === 'custom';
  const canSell = isAdmin || (isCustom && permissions.includes('retail_sales'));
  const canCollect = isAdmin || (isCustom && permissions.includes('collector'));
  const canViewCustomers = isAdmin || (isCustom && permissions.some(permission =>
    ['customer_management', 'accountant'].includes(permission),
  ));
  const canViewInvoices = isAdmin || (isCustom && permissions.includes('accountant'));
  return [
    ...(canSell ? [{ href: '/poultry-sales', label: 'البيع', icon: ReceiptText }] : []),
    ...(canCollect ? [{ href: '/poultry-collections', label: 'التحصيل', icon: Wallet }] : []),
    ...(canViewCustomers ? [{ href: '/poultry-customers', label: 'العملاء', icon: Users }] : []),
    ...(canViewInvoices ? [{ href: '/poultry-invoices', label: 'الفواتير', icon: ReceiptText }] : []),
  ];
}

function getPoultryDefaultPath(user: SessionUser): string {
  if (user.role === 'tenant_admin' || user.role === 'cashier') return '/poultry-customers';
  const permissions = user.permissions || [];
  if (permissions.includes('retail_sales')) return '/poultry-sales';
  if (permissions.includes('collector')) return '/poultry-collections';
  if (permissions.includes('customer_management')) return '/poultry-customers';
  if (permissions.includes('accountant')) return '/reports';
  return '/poultry-customers';
}

function usePoultryNotifications(enabled: boolean, userId: string) {
  const [data, setData] = useState<Array<{ id: string; type: 'invoice' | 'payment'; title: string; detail: string; createdAt: string; href: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!enabled || !userId) { setData([]); return; }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/xstore/poultry/notifications', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && Array.isArray(payload)) setData(payload);
      } catch {
        // Notifications are supplemental; a failed poll must never break the shell or login.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [enabled, userId]);
  return { data, isLoading };
}

const poultryTeamPermissionKeys = ['retail_sales', 'accountant', 'collector', 'customer_management'] as const;
const poultryPermissionLabel: Record<string, string> = {
  retail_sales: 'بيع الدواجن بالكيلو', customer_management: 'إدارة العملاء', accountant: 'التقارير وكشوف الحساب', collector: 'تحصيل حسابات العملاء',
};
const poultryPermissionDescription: Record<string, string> = {
  retail_sales: 'الوصول إلى قسم البيع وتسجيل فواتير الدواجن بالكيلو وحفظ سعر الكيلو.',
  customer_management: 'إضافة العملاء والبحث في بياناتهم دون البيع أو التحصيل.',
  accountant: 'عرض العملاء وكشوف الحساب والتقارير بدون إنشاء فواتير أو تحصيل.',
  collector: 'عرض حسابات العملاء وتسجيل التحصيل فقط، بدون إنشاء فاتورة.',
};

type SocialLinkKey = keyof AuthStatus['socialLinks'];
type SocialLinkInputValues = Record<SocialLinkKey, string>;
type InvoiceFormat = NonNullable<SessionUser['invoiceFormat']>;
const defaultInvoiceSettings: NonNullable<SessionUser['invoiceSettings']> = {
  showCustomer:true,showShop:true,showPhone:true,showCashier:true,showProduct:true,showQuantity:true,
  showUnitPrice:true,showDeadWeight:true,showTotal:true,showPaid:true,showExtraCollection:true,showBalance:true,
  showDateTime:true,showHeader:true,headerStoreName:'',headerOwnerName:'',headerMessage:'',headerPhones:'',
};
const invoiceSettingOptions: Array<{key: keyof NonNullable<SessionUser['invoiceSettings']>; label:string}> = [
  {key:'showCustomer',label:'الاسم'},{key:'showShop',label:'المحل'},{key:'showPhone',label:'هاتف العميل'},
  {key:'showCashier',label:'الموظف'},{key:'showProduct',label:'الصنف'},{key:'showQuantity',label:'الوزن'},
  {key:'showUnitPrice',label:'سعر الكيلو'},{key:'showDeadWeight',label:'النافِق'},{key:'showTotal',label:'إجمالي البيع'},
  {key:'showPaid',label:'المدفوع'},{key:'showExtraCollection',label:'تحصيل من الرصيد السابق'},
  {key:'showBalance',label:'المتبقي'},{key:'showDateTime',label:'التاريخ والوقت'},
];
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
const dateLabel = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(APP_SAUDI_DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};
const dateTimeLabel = (d?: string | null) => d ? new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(d)) : '—';
const roleNames: Record<string, string> = { platform_admin: 'مالك المنصة', tenant_admin: 'مالك المتجر', cashier: 'أمين الصندوق', warehouse_manager: 'مدير المخزون', accountant: 'محاسب', custom: 'دور مخصص' };
const teamPermissionOptions: { value: TeamPermission; label: string; description: string }[] = [
  { value: 'retail_sales', label: 'بيع قطاعي', description: 'إتمام الفواتير بسعر القطاعي ومعالجة فواتير القطاعي.' },
  { value: 'wholesale_sales', label: 'بيع جملة', description: 'إتمام الفواتير بسعر الجملة عند تفعيل قسم الجملة للمتجر.' },
  { value: 'warehouse_manager', label: 'إدارة المخزون', description: 'عرض المنتجات وتعديل الكميات دون تغيير أسعار المنتجات.' },
  { value: 'accountant', label: 'التقارير المالية', description: 'عرض التقارير المالية والمبيعات المسجلة.' },
  { value: 'collector', label: 'التحصيل', description: 'عرض حسابات العملاء وتسجيل التحصيل فقط.' },
  { value: 'customer_management', label: 'إدارة العملاء', description: 'إضافة العملاء والبحث في بياناتهم دون البيع أو التحصيل.' },
];
const teamPermissionNames: Record<TeamPermission, string> = {
  retail_sales: 'بيع قطاعي',
  wholesale_sales: 'بيع جملة',
  cashier: 'نقطة البيع والمبيعات',
  warehouse_manager: 'إدارة المخزون',
  accountant: 'التقارير المالية',
  collector: 'التحصيل',
  customer_management: 'إدارة العملاء',
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
  { href: '/display-settings', label: 'إعداد العرض', icon: Settings2, roles: ['all'] },
  { href: '/restaurant-menu', label: 'المنيو', icon: Utensils, roles: ['tenant_admin'] },
  { href: '/settings', label: 'إعدادات المنصة', icon: Settings2, roles: ['platform_admin'] },
  { href: '/store-settings', label: 'إعدادات المتجر', icon: Settings2, roles: ['tenant_admin'] },
  { href: '/team', label: 'فريق العمل', icon: Users, roles: ['tenant_admin'] },
  { href: '/poultry-farm', label: 'المزرعة', icon: Bird, roles: ['tenant_admin', 'warehouse_manager'] },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" data-testid="link-brand"><img src={`${basePath}/x-store-mark.png`} alt="" /><span>X-Store</span>{!compact && <small>نظام إدارة متجرك</small>}</Link>;
}
function SiteFooter() {
  const { data: status } = useGetXStoreAuthStatus({ query: { enabled: false } });
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
              ? <PhoneLoginForm/>
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
  const displayScaleKey = `xstore-display-scale:${user.id}`;
  const [displayScale, setDisplayScale] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(displayScaleKey));
      return Number.isFinite(saved) && saved >= 0.5 && saved <= 2 ? saved : 1;
    } catch { return 1; }
  });
  useEffect(() => {
    const onDisplayScaleChange = (event: Event) => {
      const value = Number((event as CustomEvent<number>).detail);
      if (Number.isFinite(value) && value >= 0.5 && value <= 2) setDisplayScale(value);
    };
    window.addEventListener('xstore-display-scale-change', onDisplayScaleChange);
    return () => window.removeEventListener('xstore-display-scale-change', onDisplayScaleChange);
  }, []);
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
  useEffect(() => {
    if (!notificationsOpen) return;
    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && target instanceof Element && target.closest('.notification-wrap')) return;
      setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('touchstart', handleOutsidePointer, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('touchstart', handleOutsidePointer);
    };
  }, [notificationsOpen]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const notificationProducts = useListXStoreProducts(undefined, { query: { refetchInterval: 30000, enabled: !isPoultryStore } });
  const notificationSales = useListXStoreSales({ limit: 100 }, { query: { refetchInterval: 30000, enabled: !isPoultryStore } });
  const canSeePoultryNotifications = isPoultryStore && user.role === 'tenant_admin';
  const poultryNotifications = usePoultryNotifications(canSeePoultryNotifications, user.id);
  const qc=useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
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

  // ProtectedLayout already guarantees an authenticated user before rendering AppShell.
  // Do not reference session query state here: poultry and standard stores both receive
  // the resolved user through props, so AppShell must remain a pure shell.
  const restaurantMenuEnabled = user.role === 'tenant_admin' && (
    user.storeType === 'cafe' || user.storeType === 'restaurant' ||
    (user.storeType == null && restaurantFeatureEnabled === true)
  );
  const items = isPoultryStore
    ? [
        ...nav.filter(n => n.href === '/dashboard' && (n.roles.includes('all') || hasAppRole(user, n.roles))),
        ...getPoultryNavigation(user),
        ...nav.filter(n => n.href === '/team' && (n.roles.includes('all') || hasAppRole(user, n.roles))),
        ...nav.filter(n => n.href === '/poultry-farm' && (n.roles.includes('all') || hasAppRole(user, n.roles))),
        ...nav.filter(n => n.href === '/reports' && (n.roles.includes('all') || hasAppRole(user, n.roles))),
        ...nav.filter(n => n.href === '/store-settings' && (n.roles.includes('all') || hasAppRole(user, n.roles))),
        ...nav.filter(n => n.href === '/display-settings' && (n.roles.includes('all') || hasAppRole(user, n.roles))),
        ...nav.filter(n => n.href === '/store-backup' && (n.roles.includes('all') || hasAppRole(user, n.roles))).map(n => ({ ...n, label: 'النسخه الاحتياطية' })),
      ]
    : nav.filter(n =>
        (n.href !== '/restaurant-menu' || restaurantMenuEnabled) &&
        (n.href !== '/poultry-farm' || isPoultryStore) &&
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
    ...(canSeePoultryNotifications ? (poultryNotifications.data || []).map(n=>({id:n.id,title:n.title,detail:n.detail,date:new Date(n.createdAt),icon:n.type==='payment'?Wallet:ReceiptText,href:n.href})) : []),
  ].sort((a,b)=>b.date.getTime()-a.date.getTime()).slice(0,100);
  const unseenNotifications=notificationRows.filter(n=>!readNotificationIds.includes(n.id)).length;
  function markNotificationsRead(){const next=Array.from(new Set([...readNotificationIds,...notificationRows.map(n=>n.id)]));setReadNotificationIds(next);try{localStorage.setItem(`xstore-notifications:${user.id}`,JSON.stringify(next))}catch{}}
  const notificationPanel = notificationsOpen ? (
    <section className="notification-panel" dir="rtl">
      <header>
        <div className="notification-header-title"><b>الإشعارات</b><span>{unseenNotifications} غير مقروء</span></div>
        <button onClick={markNotificationsRead} disabled={!unseenNotifications}>تحديد الكل كمقروء</button>
      </header>
      <div className="notification-list">
        {notificationRows.length ? notificationRows.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className={`notification-row ${readNotificationIds.includes(item.id) ? 'is-read' : ''}`}
            onClick={() => {
              const next = [...new Set([...readNotificationIds, item.id])];
              setReadNotificationIds(next);
              try { localStorage.setItem(`xstore-notifications:${user.id}`, JSON.stringify(next)); } catch {}
              setNotificationsOpen(false);
            }}
          >
            <span><item.icon size={16}/></span>
            <div><b>{item.title}</b><small>{item.detail} · {dateLabel(item.date.toISOString())}</small></div>
            {!readNotificationIds.includes(item.id) && <em>جديد</em>}
          </Link>
        )) : <p className="notification-empty">لا توجد إشعارات حالياً</p>}
      </div>
    </section>
  ) : null;
  return (
    <XStoreSessionContext.Provider value={user}>
      <CurrencyContext.Provider value={(user.currency as StoreCurrency | null) || 'SAR'}>
        <div
          dir="rtl"
          className="app-frame"
          style={{
            ['--xstore-font-scale' as string]: displayScale,
          }}
        >
          <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
            <div className="sidebar-top"><Logo/><button className="icon-button sidebar-close" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={19}/></button></div>
            <div className="store-chip"><span className="store-avatar">{(user.tenantName || user.name).slice(0,1)}</span><span><b>{user.tenantName || 'إدارة المنصة'}</b><small>{user.roleName || roleNames[user.role] || user.role}</small></span><ChevronDown size={15}/></div>
            <div className="nav-caption">القائمة الرئيسية</div>
            <nav className="side-nav">{items.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`nav-link ${location === item.href ? 'nav-active' : ''}`} data-testid={`link-nav-${item.href.slice(1)}`}><item.icon size={18}/><span>{item.label}</span>{location === item.href && <i/>}</Link>)}</nav>
            <div className="sidebar-bottom">
              <div className="support-box"><span className="support-icon"><ShieldCheck size={17}/></span><b>كل شيء تحت السيطرة</b><p>بيانات المتجر محفوظة ومحدّثة.</p></div>
              <div className="profile-row"><span className="profile-avatar">{user.name.slice(0,1)}</span><span className="profile-info"><b>{user.name}</b><small>{user.phone}</small></span><button type="button" className="icon-button" onClick={() => void handleLogout()} disabled={loggingOut} title={loggingOut ? 'جارٍ تسجيل الخروج…' : 'تسجيل الخروج'} aria-label={loggingOut ? 'جارٍ تسجيل الخروج' : 'تسجيل الخروج'} data-testid="button-sign-out"><LogOut size={17}/></button></div>
            </div>
          </aside>
          {open && <button aria-label="إغلاق القائمة" className="mobile-scrim" onClick={() => setOpen(false)}/>} 
          <div className="workspace">
            <header className="topbar">
              <button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={() => setOpen(true)}><Menu size={20}/></button>
              <div className="crumbs"><span>مساحة العمل</span><ChevronLeft size={14}/><b>{items.find(i => i.href === location)?.label || 'لوحة التحكم'}</b></div>
              <div className="topbar-tools">
                <span className="today"><CalendarDays size={15}/> {new Intl.DateTimeFormat(APP_SAUDI_DATE_LOCALE, {weekday:'long', day:'numeric', month:'long'}).format(new Date())}</span>
                {(!isPoultryStore || canSeePoultryNotifications) && <div className="notification-wrap">
                  <button className="icon-button notification" aria-label={unseenNotifications ? `الإشعارات · ${unseenNotifications} غير مقروء` : 'الإشعارات'} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(v => !v)}><Bell size={18}/>{unseenNotifications > 0 && <><i/><span className="notification-count">{unseenNotifications > 99 ? '99+' : unseenNotifications}</span></>}</button>
                  {notificationPanel}
                </div>}
                {(!isPoultryStore || canSeePoultryNotifications) && <span className="top-avatar">{user.name.slice(0,1)}</span>}
              </div>
            </header>
            <main className="main-content">{children}</main>
          </div>
        </div>
      </CurrencyContext.Provider>
    </XStoreSessionContext.Provider>
  );
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
  const allowed:Record<string,string[]>={'/poultry-farm':['tenant_admin','warehouse_manager'],'/poultry-customers':['tenant_admin','cashier','accountant','customer_management'],'/poultry-customer/:customerId':['tenant_admin','cashier','accountant','customer_management'],'/poultry-invoices':['tenant_admin','cashier','accountant'],'/poultry-sales':['tenant_admin','cashier','retail_sales'],'/poultry-sale/:customerId':['tenant_admin','cashier','retail_sales'],'/poultry-collections':['tenant_admin','cashier','collector'],'/tenants':['platform_admin'],'/subscriptions':['platform_admin'],'/offline-license-issuer':['platform_admin'],'/settings':['platform_admin'],'/platform-backup':['platform_admin'],'/platform-database':['platform_admin'],'/store-backup':['tenant_admin'],'/restaurant-menu':['tenant_admin'],'/store-settings':['tenant_admin'],'/display-settings':['all'],'/team':['tenant_admin'],'/pos':['tenant_admin','cashier'],'/inventory':['tenant_admin','warehouse_manager'],'/reports':['platform_admin','tenant_admin','accountant'],'/sales':['tenant_admin','cashier','accountant'],'/audit-log':['platform_admin']};
  if (session.data?.storeType !== 'poultry' && location === '/poultry-farm') return <Redirect to="/dashboard"/>;
  if (session.data?.storeType === 'poultry' && ['/pos', '/inventory', '/sales', '/dashboard'].includes(location)) return <Redirect to={getPoultryDefaultPath(session.data)} />;
  if (session.data?.storeType !== 'poultry' && ['/poultry-customers','/poultry-customer/:customerId','/poultry-sales','/poultry-sale/:customerId','/poultry-collections','/poultry-invoices'].includes(location)) return <Redirect to="/dashboard"/>;
  if(session.data&&allowed[location]&&location !== '/display-settings'&&!hasAppRole(session.data, allowed[location]))return <Redirect to={session.data.storeType === 'poultry' ? getPoultryDefaultPath(session.data) : '/dashboard'}/>;
  if(location === '/restaurant-menu' && !restaurantMenuAccessLoading && !restaurantMenuEnabled)return <Redirect to="/dashboard"/>;
  if(session.isLoading)return <div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>;
  if(session.isError||!session.data)return <Redirect to="/sign-in"/>;
  return <AppShell user={session.data} refetch={session.refetch}><Switch>
    <Route path="/dashboard" component={DashboardPage}/><Route path="/poultry-farm" component={PoultryFarmPage}/><Route path="/poultry-customers" component={PoultryCustomersPage}/><Route path="/poultry-customer/:customerId" component={PoultryFeatureCustomerAccountPage}/><Route path="/poultry-invoices" component={PoultryInvoicesPage}/><Route path="/poultry-invoices/" component={PoultryInvoicesPage}/><Route path="/poultry-sales" component={PoultrySalesPage}/><Route path="/poultry-sale/:customerId" component={PoultrySalePage}/><Route path="/poultry-collections" component={PoultryCollectionsPage}/><Route path="/tenants" component={TenantsPage}/>
    <Route path="/subscriptions" component={SubscriptionsPage}/>
    <Route path="/offline-license-issuer" component={OfflineLicenseIssuerPage}/>
    <Route path="/team" component={TeamPage}/>
    <Route path="/pos" component={PosPage}/><Route path="/inventory" component={InventoryPage}/>
    <Route path="/reports" component={ReportsPage}/><Route path="/sales" component={SalesPage}/><Route path="/audit-log" component={AuditPage}/>
    <Route path="/settings" component={PlatformSettingsPage}/>
      <Route path="/platform-database" component={PlatformDatabasePage}/>
     <Route path="/platform-backup" component={PlatformBackupPage}/><Route path="/store-backup" component={StoreBackupRoutePage}/><Route path="/restaurant-menu" component={RestaurantMenuPage}/>
    <Route path="/store-settings" component={StoreSettingsPage}/>
    <Route path="/display-settings" component={DisplaySettingsPage}/>
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

function PoultryCustomersPage({ mode = 'customers' }: { mode?: 'customers' | 'sales' | 'collections' }) {
  const session = useContext(XStoreSessionContext);
  return <Suspense fallback={<div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>}><PoultryFeatureCustomersPage mode={mode} session={session}/></Suspense>;
}
function PoultrySalesPage() {
  return <PoultryCustomersPage mode="sales"/>;
}
function PoultrySalePage() {
  const session=useContext(XStoreSessionContext);
  return <PoultryFeatureSalePage session={session}/>;
}
function PoultryCollectionsPage() {
  return <PoultryCustomersPage mode="collections"/>;
}
function PoultryInvoicesPage() {
  const session=useContext(XStoreSessionContext);
  return <PoultryFeatureInvoicesPage session={session}/>;
}
function StoreBackupRoutePage() {
  const session = useContext(XStoreSessionContext);
  return session?.storeType === 'poultry' ? <PoultryBackupPage /> : <StoreBackupPage />;
}

function PoultryDashboardPage() {
  return <Suspense fallback={<div className="loading-page" dir="rtl"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>}><PoultryFeatureDashboardPage/></Suspense>;
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
      <button className="button button-quiet" type="button" disabled={!tenantToEdit||update.isPending} onClick={()=>tenantToEdit&&openTenantEdit(tenantToEdit)}><PencilIcon size={15}/> تعديل المتجر</button>
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
  const session = useContext(XStoreSessionContext);
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
  const isPoultryStore = session?.storeType === 'poultry';
  const visibleTeamPermissionOptions = isPoultryStore
    ? teamPermissionOptions.filter((option) => (poultryTeamPermissionKeys as readonly string[]).includes(option.value))
    : teamPermissionOptions;
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
        desc={isPoultryStore ? "أضف موظفي الدواجن وحدد لكل واحد صلاحية البيع بالكيلو أو التحصيل أو التقارير." : "أضف أعضاء الفريق، وعدّل بيانات دخولهم وصلاحياتهم."}
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
      {isPoultryStore && <div className="role-hint field-wide" style={{marginBottom: 16}}><Bird size={17} /><span><b>نظام الدواجن:</b> صلاحيات الموظف هنا منفصلة عن المخزون ونقطة البيع العامة. بيع الدواجن بالكيلو = «بيع الدواجن بالكيلو»، والتحصيل = «تحصيل حسابات العملاء».</span></div>}
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
          <>
          <div className="table-wrap team-desktop-table">
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
                            <PencilIcon size={15} /> تعديل
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
          <div className="team-mobile-list">
            {members.map((member) => (
              <article className="team-mobile-card" key={'mobile-'+member.id}>
                <div className="team-mobile-head">
                  <div className="member-name">
                    <span>{member.name.slice(0, 1)}</span>
                    <div><b>{member.name}</b><small>{member.roleName || roleTitle[member.role] || member.role}</small></div>
                  </div>
                  <span className={`status-pill ${member.status === 'active' ? 'status-active' : 'status-trial'}`}>
                    {member.status === 'active' ? 'نشط' : 'دعوة مرسلة'}
                  </span>
                </div>
                <div className="team-mobile-grid">
                  <div><small>رقم الهاتف</small><b dir="ltr">{member.phone || '—'}</b></div>
                  <div><small>البريد الإلكتروني</small><b>{member.email || '—'}</b></div>
                  <div><small>الصلاحيات</small><b>{memberPermissionSummary(member.role, member.permissions)}</b></div>
                  <div><small>تاريخ الإضافة</small><b>{dateLabel(member.createdAt)}</b></div>
                </div>
                <div className="team-mobile-actions">
                  {member.role === 'tenant_admin' ? (
                    <span className="team-owner-note">حساب المالك</span>
                  ) : (
                    <>
                      <button type="button" className="button button-quiet" onClick={() => openEdit(member)}><PencilIcon size={15}/> تعديل</button>
                      <button type="button" className="button button-quiet team-action-danger" onClick={() => { remove.reset(); setDeletingMember(member); }}><Trash2 size={15}/> حذف</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          </>
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
              {visibleTeamPermissionOptions.map(({ value, label, description }) => {
                const displayLabel = isPoultryStore ? (poultryPermissionLabel[value] || label) : label;
                const displayDescription = isPoultryStore ? (poultryPermissionDescription[value] || description) : description;
                return <label key={value} className={'team-permission-option ' + (selectedPermissions.includes(value) ? 'is-selected' : '')}>
                  <input type="checkbox" checked={selectedPermissions.includes(value)} onChange={() => togglePermission(value)} />
                  <span className="team-permission-copy"><b>{displayLabel}</b><small>{displayDescription}</small></span>
                </label>;
              })}
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
  const qc=useQueryClient(),session=useGetXStoreSession(),update=useUpdateXStoreStoreSettings();
  const [vatPercent,setVatPercent]=useState('15'),[invoiceFormat,setInvoiceFormat]=useState<InvoiceFormat>('wide');
  const [invoiceSettings,setInvoiceSettings]=useState(defaultInvoiceSettings),[invoiceEditorOpen,setInvoiceEditorOpen]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{if(session.data?.vatRate!=null)setVatPercent(String(session.data.vatRate*100));if(session.data?.invoiceFormat)setInvoiceFormat(session.data.invoiceFormat);if(session.data?.invoiceSettings)setInvoiceSettings({...defaultInvoiceSettings,...session.data.invoiceSettings});},[session.data?.vatRate,session.data?.invoiceFormat,session.data?.invoiceSettings]);
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const percent=Number(vatPercent);if(!Number.isFinite(percent)||percent<0||percent>100)return;update.mutate({data:{vatRate:percent/100,invoiceFormat,invoiceSettings}},{onSuccess:settings=>{setVatPercent(String(settings.vatRate*100));setInvoiceFormat(settings.invoiceFormat);setInvoiceSettings({...defaultInvoiceSettings,...settings.invoiceSettings});qc.setQueryData(getGetXStoreSessionQueryKey(),current=>current?{...current,vatRate:settings.vatRate,invoiceFormat:settings.invoiceFormat,invoiceSettings:settings.invoiceSettings}:current);void qc.invalidateQueries({queryKey:getGetXStoreSessionQueryKey()});setNotice('تم حفظ إعدادات الفاتورة لهذا المتجر.');setInvoiceEditorOpen(false);}});}
  const p=invoiceSettings;
  return <><PageTitle eyebrow="إعدادات المتجر" title="إعدادات الفاتورة" desc="تحكم في شكل الفاتورة والبيانات التي تظهر فيها، وتطبق الإعدادات على فواتير المتجر كلها." action={<button className="button button-primary" type="button" onClick={()=>setInvoiceEditorOpen(true)}><PencilIcon size={16}/> تعديل الفاتورة</button>}/>
    <Card className="settings-card"><SectionHead title="نسبة الضريبة" detail="تُحفظ النسبة للمتجر كله، وتظهر لأمناء الصندوق عند البيع."/>
      {session.isLoading?<StateBlock loading error={false} onRetry={()=>session.refetch()} empty={false}/>:session.isError?<StateBlock loading={false} error onRetry={()=>session.refetch()} empty={false}/>:<form className="form-grid settings-form" onSubmit={submit}>
        <label className="field field-wide"><span>نسبة ضريبة القيمة المضافة</span><div className="vat-rate-input"><input aria-label="نسبة ضريبة القيمة المضافة" type="number" min="0" max="100" step="0.01" required value={vatPercent} onChange={e=>{setVatPercent(e.target.value);setNotice('')}}/><span>%</span></div></label>
        <div className="role-hint field-wide"><ShieldCheck size={16}/><span>اكتب النسبة من 0 إلى 100٪. تغييرها لا يعدّل الفواتير السابقة.</span></div>
        <div className="invoice-format-section field-wide"><SectionHead title="تصميم ومقاس الطباعة" detail="سيُستخدم الاختيار على فواتير المتجر عند الطباعة."/><div className="invoice-format-options" role="radiogroup" aria-label="تصميم ومقاس الفاتورة">{invoiceFormatOptions.map(option=><label className={`invoice-format-option${invoiceFormat===option.value?' is-selected':''}`} key={option.value}><input type="radio" name="invoiceFormat" value={option.value} checked={invoiceFormat===option.value} onChange={()=>setInvoiceFormat(option.value)}/><span className={`invoice-format-sample invoice-format-sample--${option.sampleClass}`} aria-hidden="true"><i/><i/><i/></span><span className="invoice-format-copy"><b>{option.label}</b><small>{option.detail}</small></span></label>)}</div></div>
        {notice&&<div className="settings-success"><CircleCheck size={16}/>{notice}</div>}
        {update.isError&&<div className="form-error">{apiErrorMessage(update.error,'تعذر حفظ إعدادات الفاتورة.')}</div>}
        <div className="modal-actions"><button className="button button-primary" disabled={update.isPending}>{update.isPending?'جارٍ الحفظ…':'حفظ إعدادات المتجر'}</button></div>
      </form>}
    </Card>
    {invoiceEditorOpen&&<Modal title="تعديل الفاتورة" close={()=>setInvoiceEditorOpen(false)}><div className="invoice-editor" dir="rtl">
      <div className="invoice-editor-preview"><div className="invoice-preview-header"><span className="invoice-preview-bird">🐔</span><div className="invoice-preview-copy">{p.showHeader&&<><b>{p.headerStoreName||session.data?.tenantName||'اسم المحل'}</b><b>{p.headerOwnerName||session.data?.name||'اسم صاحب المحل'}</b><span>{p.headerMessage||'الجملة التي تكتبها هنا'}</span><span>{p.headerPhones||'أرقام التليفونات'}</span></>}</div><span className="invoice-preview-bird">🐔</span></div><div className="invoice-preview-title">فاتورة دواجن</div><div className="invoice-preview-grid">{invoiceSettingOptions.map(o=>p[o.key]&&<span key={String(o.key)}>{o.label}</span>)}</div></div>
      <div className="invoice-editor-fields"><div className="invoice-editor-header-fields">
        <label className="field"><span>اسم المحل — السطر الأول</span><input maxLength={120} value={p.headerStoreName} onChange={e=>setInvoiceSettings(v=>({...v,headerStoreName:e.target.value}))}/></label>
        <label className="field"><span>اسم صاحب المحل — السطر الثاني</span><input maxLength={120} value={p.headerOwnerName} onChange={e=>setInvoiceSettings(v=>({...v,headerOwnerName:e.target.value}))}/></label>
        <label className="field field-wide"><span>الجملة — السطر الثالث</span><input maxLength={240} value={p.headerMessage} placeholder="اكتب الجملة التي تريدها" onChange={e=>setInvoiceSettings(v=>({...v,headerMessage:e.target.value}))}/></label>
        <label className="field field-wide"><span>أرقام التليفونات — السطر الرابع</span><input maxLength={160} value={p.headerPhones} placeholder="01000000000 - 01111111111" onChange={e=>setInvoiceSettings(v=>({...v,headerPhones:e.target.value}))}/></label>
      </div><label className="invoice-header-toggle"><input type="checkbox" checked={p.showHeader} onChange={e=>setInvoiceSettings(v=>({...v,showHeader:e.target.checked}))}/><span>إظهار رأس الفاتورة</span></label>
      <div className="invoice-fields-toggle"><b>اختار البيانات اللي تظهر في الفاتورة</b>{invoiceSettingOptions.map(o=><label key={String(o.key)}><input type="checkbox" checked={Boolean(p[o.key])} onChange={e=>setInvoiceSettings(v=>({...v,[o.key]:e.target.checked}))}/><span>{o.label}</span></label>)}</div></div>
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={()=>setInvoiceEditorOpen(false)}>إلغاء</button><button type="button" className="button button-primary" disabled={update.isPending} onClick={()=>document.querySelector<HTMLFormElement>('.settings-form')?.requestSubmit()}>{update.isPending?'جارٍ الحفظ…':'حفظ التعديلات'}</button></div>
    </div></Modal>}
  </>;
}
function DisplaySettingsPage() {
  const user = useContext(XStoreSessionContext);
  const userId = user?.id || 'unknown';
  const storageKey = `xstore-display-scale:${userId}`;
  const [scale, setScale] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return Number.isFinite(saved) && saved >= 0.5 && saved <= 2 ? saved : 1;
    } catch { return 1; }
  });
  function changeScale(value: number) {
    const safeValue = Math.max(0.5, Math.min(2, value));
    setScale(safeValue);
    try { localStorage.setItem(storageKey, String(safeValue)); } catch {}
    window.dispatchEvent(new CustomEvent('xstore-display-scale-change', { detail: safeValue }));
  }
  return <>
    <PageTitle eyebrow="تخصيص الواجهة" title="إعداد العرض" desc="تحكم في حجم عرض الواجهة على حسابك فقط."/>
    <Card className="display-settings-card">
      <SectionHead title="حجم العرض" detail="اسحب الشريط يمينًا أو يسارًا لتكبير أو تصغير الواجهة."/>
      <div className="display-scale-slider-wrap">
        <div className="display-scale-slider-top">
          <span>50%</span><strong>{Math.round(scale * 100)}%</strong><span>200%</span>
        </div>
        <input className="display-scale-slider" type="range" min="0.5" max="2" step="0.05" value={scale} onChange={event => changeScale(Number(event.target.value))} aria-label="حجم العرض"/>
        <div className="display-scale-slider-labels"><span>أصغر</span><span>عادي 100%</span><span>أكبر</span></div>
      </div>
      <div className="display-settings-note"><Settings2 size={17}/><span>الإعداد خاص بحساب <b>{user?.name || 'الحساب الحالي'}</b> ومحفوظ على هذا الجهاز.</span></div>
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
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const isWarehouseManager = hasAppRole(session.data, ['warehouse_manager']);
  const canManage = session.data?.role === 'tenant_admin' || isWarehouseManager;
  const wholesaleEnabled = session.data?.wholesaleEnabled ?? false;
  const restaurantIngredientsEnabled = session.data?.storeType === 'cafe' || session.data?.storeType === 'restaurant' || (session.data?.storeType == null && restaurantFeatureEnabledForIngredients === true);
  const canViewCost = hasAppRole(session.data, ['tenant_admin', 'warehouse_manager', 'accountant', 'platform_admin']);
  const pricingOnlyEdit = isWarehouseManager && Boolean(edit);
  const [priceFormError, setPriceFormError] = useState('');
  const [productMode, setProductMode] = useState<'single' | 'multi'>('single');
  const [multiColorInput, setMultiColorInput] = useState('');
  const [multiSizeInput, setMultiSizeInput] = useState('');
  const [multiColors, setMultiColors] = useState<string[]>([]);
  const [multiSizes, setMultiSizes] = useState<string[]>([]);
  const [multiUniformPriceEnabled, setMultiUniformPriceEnabled] = useState(false);
  const [multiUniformPrice, setMultiUniformPrice] = useState('');
  const [multiUniformQuantityEnabled, setMultiUniformQuantityEnabled] = useState(false);
  const [multiUniformQuantity, setMultiUniformQuantity] = useState('0');
  const [multiUniformWholesaleEnabled, setMultiUniformWholesaleEnabled] = useState(false);
  const [multiUniformWholesalePrice, setMultiUniformWholesalePrice] = useState('');
  const [multiUniformCostEnabled, setMultiUniformCostEnabled] = useState(false);
  const [multiUniformCostPrice, setMultiUniformCostPrice] = useState('');
  const [multiVariants, setMultiVariants] = useState<Array<{color:string;size:string;barcode:string;price:string;wholesalePrice:string;costPrice:string;quantity:string}>>([]);

  function resetMultiProductForm() {
    setProductMode('single');
    setMultiColorInput('');
    setMultiSizeInput('');
    setMultiColors([]);
    setMultiSizes([]);
    setMultiUniformPriceEnabled(false);
    setMultiUniformPrice('');
    setMultiUniformQuantityEnabled(false);
    setMultiUniformQuantity('0');
    setMultiUniformWholesaleEnabled(false);
    setMultiUniformWholesalePrice('');
    setMultiUniformCostEnabled(false);
    setMultiUniformCostPrice('');
    setMultiVariants([]);
  }
  function addMultiValue(type:'color'|'size') {
    const value = (type === 'color' ? multiColorInput : multiSizeInput).trim();
    if (!value) return;
    if (type === 'color') {
      setMultiColors(current => current.includes(value) ? current : [...current, value]);
      setMultiColorInput('');
    } else {
      setMultiSizes(current => current.includes(value) ? current : [...current, value]);
      setMultiSizeInput('');
    }
  }
  function removeMultiValue(type:'color'|'size', value:string) {
    if (type === 'color') setMultiColors(current => current.filter(item => item !== value));
    else setMultiSizes(current => current.filter(item => item !== value));
  }
  function applyMultiUniformField(field:'price'|'wholesalePrice'|'costPrice'|'quantity', value:string) {
    setMultiVariants(current => current.map(item => ({...item, [field]:value})));
  }
  function generateMultiVariants() {
    const colors = multiColors;
    const sizes = multiSizes;
    if (!colors.length && !sizes.length) {
      setPriceFormError('أدخل لونًا أو مقاسًا واحدًا على الأقل لإنشاء القطعة المتعددة.');
      return;
    }
    const next = (colors.length ? colors : ['']).flatMap(color =>
      (sizes.length ? sizes : ['']).map(size => {
        const existing = multiVariants.find(item => item.color === color && item.size === size);
        return existing || {
          color,
          size,
          barcode:'',
          price:multiUniformPriceEnabled ? multiUniformPrice : '',
          wholesalePrice:multiUniformWholesaleEnabled ? multiUniformWholesalePrice : '',
          costPrice:multiUniformCostEnabled ? multiUniformCostPrice : '',
          quantity:multiUniformQuantityEnabled ? multiUniformQuantity : '0',
        };
      }),
    );
    setMultiVariants(next.map(item => ({
      ...item,
      ...(multiUniformPriceEnabled ? {price:multiUniformPrice} : {}),
      ...(multiUniformWholesaleEnabled ? {wholesalePrice:multiUniformWholesalePrice} : {}),
      ...(multiUniformCostEnabled ? {costPrice:multiUniformCostPrice} : {}),
      ...(multiUniformQuantityEnabled ? {quantity:multiUniformQuantity} : {}),
    })));
    setPriceFormError('');
  }
  function updateMultiVariant(index:number, field:keyof typeof multiVariants[number], value:string) {
    setMultiVariants(current => current.map((item,itemIndex) => itemIndex===index ? {...item,[field]:value} : item));
  }
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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    if (!edit && productMode === 'multi') {
      const name = String(f.get('name') || '').trim();
      if (!name) { setPriceFormError('اسم المنتج مطلوب.'); return; }
      if (!multiVariants.length) { setPriceFormError('أنشئ تركيبة واحدة على الأقل قبل الحفظ.'); return; }
      const invalidPrice = multiVariants.some(item => {
        const retail = item.price.trim() ? Number(item.price) : null;
        const wholesale = wholesaleEnabled && item.wholesalePrice.trim() ? Number(item.wholesalePrice) : null;
        return (retail === null && wholesale === null)
          || (retail !== null && (!Number.isFinite(retail) || retail < 0))
          || (wholesale !== null && (!Number.isFinite(wholesale) || wholesale < 0));
      });
      if (invalidPrice) { setPriceFormError('كل تركيبة يجب أن تحتوي على سعر قطاعي أو سعر جملة صحيح.'); return; }
      setPriceFormError('');
      try {
        await Promise.all(multiVariants.map(item => create.mutateAsync({data:{
          name,
          sku:'XST-' + crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),
          barcode:item.barcode.trim() || null,
          category:'عام',
          quantity:Math.max(0,Number(item.quantity)||0),
          color:item.color || null,
          size:item.size || null,
          partNumber:String(f.get('partNumber') || '').trim() || null,
          price:item.price.trim() ? Number(item.price) : null,
          wholesalePrice:wholesaleEnabled && item.wholesalePrice.trim() ? Number(item.wholesalePrice) : null,
          ...(item.costPrice.trim() ? {costPrice:Number(item.costPrice)} : {}),
          ingredients:null,
          expiresAt:null,
        }})));
        qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});
        qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});
        setDialog(false); setEdit(null); resetMultiProductForm(); setPriceFormError('');
        setNotice('تم حفظ ' + multiVariants.length + ' تركيبة للمنتج');
      } catch {
        setPriceFormError('تعذر حفظ القطعة المتعددة. راجع البيانات وحاول مرة أخرى.');
      }
      return;
    }

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
  const deleteProduct = async (p: Product) => {
    if (session.data?.role !== 'tenant_admin' || deletingProductId) return;
    const confirmed = window.confirm(`هل أنت متأكد من حذف المنتج «${p.name}» من المخزون؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;
    setDeletingProductId(p.id);
    try {
      const response = await fetch(`/api/xstore/products/${p.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) throw new Error(body?.error || 'تعذر حذف المنتج.');
      await qc.invalidateQueries({ queryKey: getListXStoreProductsQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetXStoreDashboardQueryKey() });
      setNotice('تم حذف المنتج من المخزون');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذر حذف المنتج.');
    } finally {
      setDeletingProductId(null);
    }
  };
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
        ? <button className="button button-primary" onClick={() => { setEdit(null); resetMultiProductForm(); setDialog(true); }} data-testid="button-add-product"><Plus size={17}/> إضافة منتج</button>
        : null}
    />
    <div className="stat-grid inventory-stats">
      <StatCard label="إجمالي المنتجات" value={q.isLoading?'—':fmt(allProducts.length)} detail="منتجات مسجلة في المتجر" icon={Package}/>
      <StatCard label="قريب من النفاد" value={q.isLoading?'—':fmt(lowStockCount)} detail="رصيد من 1 إلى 5 وحدات" icon={AlertTriangle} tint="gold"/>
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
                    <td><div className="inventory-variants inventory-variants--clear">
  <span className="inventory-variant-badge"><small>اللون</small><b>{p.color || '—'}</b></span>
  <span className="inventory-variant-badge"><small>المقاس</small><b>{p.size || '—'}</b></span>
</div></td>
                    <td className="inventory-price"><div>قطاعي: {p.price===null?'—':money(p.price)}</div>{wholesaleEnabled&&<div>جملة: {p.wholesalePrice===null?'—':money(p.wholesalePrice)}</div>}{canViewCost&&<small>التكلفة: {p.costPrice===null?'—':money(p.costPrice)}</small>}</td>
                    <td><div className="inventory-quantity"><b className={`quantity ${p.quantity<=5?'quantity-low':''}`}>{fmt(p.quantity)}</b><span className={`inventory-stock-status ${p.quantity<=0?'is-out':p.quantity<=5?'is-low':'is-available'}`}>{p.quantity<=0?'نفد':p.quantity<=5?'منخفض':'متاح'}</span></div></td>
                    {canManage&&<td><div className="inventory-row-actions">
                      <button className="qty-control" aria-label={`تقليل كمية ${p.name}`} title="تقليل الكمية" disabled={p.quantity<=0} onClick={()=>changeQuantity(p,-1)} data-testid={`button-inventory-decrease-${p.id}`}><Minus size={16}/></button>
                      <button className="qty-control" aria-label={`زيادة كمية ${p.name}`} title="زيادة الكمية" onClick={()=>changeQuantity(p,1)} data-testid={`button-inventory-increase-${p.id}`}><Plus size={16}/></button>
                      <button className="inventory-edit-button" onClick={()=>{setPriceFormError('');setEdit(p);setDialog(true)}} data-testid={`button-edit-product-${p.id}`}>تعديل البيانات</button>
                      {session.data?.role === 'tenant_admin' && <button className="inventory-delete-button" onClick={()=>void deleteProduct(p)} disabled={deletingProductId === p.id} data-testid={`button-delete-product-${p.id}`} title="حذف المنتج"><Trash2 size={15}/>{deletingProductId === p.id ? 'جارٍ الحذف…' : 'حذف'}</button>}
                    </div></td>}
                  </tr>})}</tbody>
                </table></div>
              </div>
              <div className="inventory-mobile-list">
                {rows.map(p=>{const {symbol,tone,kind}=getProductIcon(p);return <article className="inventory-mobile-card" key={p.id} data-testid={`card-inventory-product-${p.id}`}>
                  <div className="inventory-mobile-head"><div className="inventory-product"><span className={`inventory-product-icon art-${tone}`} data-product-icon={kind}><ProductIconSymbol symbol={symbol} kind={kind}/></span><span className="inventory-product-copy"><b>{p.name}</b><small className="ltr-id">{p.sku}</small></span></div><span className={`inventory-stock-status ${p.quantity<=0?'is-out':p.quantity<=5?'is-low':'is-available'}`}>{p.quantity<=0?'نفد المخزون':p.quantity<=5?'رصيد منخفض':'متاح'}</span></div>
                  <div className="inventory-mobile-details">
                    <div><small>التصنيف</small><b>{p.category}</b></div>
                    <div className="inventory-mobile-prices"><small>الأسعار</small><b>قطاعي: {p.price===null?'—':money(p.price)}</b>{wholesaleEnabled&&<b>جملة: {p.wholesalePrice===null?'—':money(p.wholesalePrice)}</b>}{canViewCost&&<b>التكلفة: {p.costPrice===null?'—':money(p.costPrice)}</b>}</div>
                    <div><small>الكمية المتاحة</small><b className={p.quantity<=5?'quantity-low':''}>{fmt(p.quantity)} وحدة</b></div>
                    <div className="inventory-mobile-variants inventory-mobile-variants--clear">
  <div><small>اللون</small><b>{p.color || '—'}</b></div>
  <div><small>المقاس</small><b>{p.size || '—'}</b></div>
</div>
                    {(p.partNumber||p.barcode)&&<div className="inventory-mobile-variants"><small>بيانات إضافية</small><b>{p.partNumber?`رقم القطعة: ${p.partNumber}`:`باركود: ${p.barcode}`}</b></div>}
                  </div>
                  {canManage&&<div className="inventory-mobile-actions"><div><span>تحديث الكمية</span><button className="qty-control" aria-label={`تقليل كمية ${p.name}`} disabled={p.quantity<=0} onClick={()=>changeQuantity(p,-1)} data-testid={`button-inventory-mobile-decrease-${p.id}`}><Minus size={16}/></button><button className="qty-control" aria-label={`زيادة كمية ${p.name}`} onClick={()=>changeQuantity(p,1)} data-testid={`button-inventory-mobile-increase-${p.id}`}><Plus size={16}/></button></div><button className="inventory-edit-button" onClick={()=>{setPriceFormError('');setEdit(p);setDialog(true)}} data-testid={`button-edit-product-mobile-${p.id}`}>تعديل المنتج</button>{session.data?.role === 'tenant_admin' && <button className="inventory-delete-button" onClick={()=>void deleteProduct(p)} disabled={deletingProductId === p.id} data-testid={`button-delete-product-mobile-${p.id}`} title="حذف المنتج"><Trash2 size={15}/>{deletingProductId === p.id ? 'جارٍ الحذف…' : 'حذف المنتج'}</button>}</div>}
                </article>})}
              </div>
            </>
            : <div className="inventory-empty" role="status" data-testid="status-inventory-empty"><span className="inventory-empty-icon"><Package size={24}/></span><b>{allProducts.length?'لا توجد منتجات مطابقة':'المخزون فارغ حتى الآن'}</b><span>{allProducts.length?'غيّر البحث أو الفلاتر لعرض منتجات أخرى.':'أضف منتجاتك لتبدأ متابعة الكميات والأسعار من هنا.'}</span>{(search||categoryFilter!=='__all__'||stockFilter!=='all')&&<button className="button button-quiet" onClick={()=>{setSearch('');setCategoryFilter('__all__');setStockFilter('all')}} data-testid="button-clear-inventory-filters">مسح البحث والفلاتر</button>}</div>
      }
    </Card>
    {dialog && <Modal className="product-modal" title={edit ? 'تعديل المنتج' : 'إضافة منتج'} close={() => { setDialog(false); setEdit(null); setPriceFormError(''); }}>
      <form className={`form-grid product-form ${isWarehouseManager ? 'product-form--warehouse' : ''}`} onSubmit={submit}>
        <div className="product-form-intro field-wide">
          <span className="product-form-icon"><Package size={21}/></span>
          <div className="product-form-intro-copy">
            <strong>{edit ? 'حدّث بيانات المنتج' : 'أضف منتجًا إلى مخزونك'}</strong>
            <span>اختر نوع القطعة ثم أدخل بياناتها في خطوات واضحة وسريعة.</span>
          </div>
          <span className="product-form-required-note"><i/> الحقول المطلوبة عليها علامة *</span>
        </div>
        <div className="product-form-basic-fields" style={{ display: pricingOnlyEdit ? 'none' : 'contents' }}>
          {!edit && <div className="product-mode-switch field-wide">
            <button type="button" className={productMode === 'single' ? 'is-active' : ''} onClick={() => { setProductMode('single'); setPriceFormError(''); }}>
              <Package size={18}/><span><b>قطعة عادية</b><small>منتج واحد بلون ومقاس واحد أو بدون متغيرات</small></span>
            </button>
            <button type="button" className={productMode === 'multi' ? 'is-active' : ''} onClick={() => { setProductMode('multi'); setPriceFormError(''); }}>
              <Boxes size={18}/><span><b>قطعة متعددة</b><small>عدة ألوان ومقاسات مع مخزون مستقل لكل تركيبة</small></span>
            </button>
          </div>}
          <div className="product-form-section field-wide">
            <span className="product-form-section-number">01</span>
            <div><b>بيانات المنتج</b><small>الاسم والباركود للتعرّف عليه بسهولة.</small></div>
          </div>
          <Field className="product-form-field" label="اسم المنتج" name="name" required placeholder="مثال: تيشيرت قطني أسود" defaultValue={edit?.name}/>
          <Field className="product-form-field" label="الباركود (اختياري)" name="barcode" placeholder="اكتب الرقم أو امسح الكود" defaultValue={edit?.barcode || ''}/>
        </div>
        {pricingOnlyEdit && <div className="role-hint field-wide"><ShieldCheck size={16}/><span>تعديل الأسعار والكمية للمنتج: {edit?.name}. لا يمكنك تغيير بياناته الأساسية.</span></div>}
        {productMode === 'multi' && !edit ? (
          <>
            <div className="product-form-section field-wide">
              <span className="product-form-section-number">02</span>
              <div><b>بناء القطعة المتعددة</b><small>اكتب الألوان والمقاسات ثم أنشئ التركيبات تلقائيًا.</small></div>
            </div>
            <div className="multi-option-builder field-wide">
              <div className="multi-option-group">
                <label className="field">
                  <span>الألوان</span>
                  <div className="multi-option-input">
                    <input value={multiColorInput} onChange={e => setMultiColorInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMultiValue('color'); } }} placeholder="اكتب اللون واضغط Enter" />
                    <button type="button" className="button button-quiet" onClick={() => addMultiValue('color')}>إضافة</button>
                  </div>
                </label>
                <div className="multi-option-chips">
                  {multiColors.map(color => <span className="multi-option-chip" key={color}><b>{color}</b><button type="button" onClick={() => removeMultiValue('color', color)} aria-label="حذف اللون"><X size={13}/></button></span>)}
                  {!multiColors.length && <small>لم تتم إضافة ألوان بعد.</small>}
                </div>
              </div>
              <div className="multi-option-group">
                <label className="field">
                  <span>المقاسات</span>
                  <div className="multi-option-input">
                    <input value={multiSizeInput} onChange={e => setMultiSizeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMultiValue('size'); } }} placeholder="اكتب المقاس واضغط Enter" />
                    <button type="button" className="button button-quiet" onClick={() => addMultiValue('size')}>إضافة</button>
                  </div>
                </label>
                <div className="multi-option-chips">
                  {multiSizes.map(size => <span className="multi-option-chip" key={size}><b>{size}</b><button type="button" onClick={() => removeMultiValue('size', size)} aria-label="حذف المقاس"><X size={13}/></button></span>)}
                  {!multiSizes.length && <small>لم تتم إضافة مقاسات بعد.</small>}
                </div>
              </div>
            </div>
            <div className="multi-uniform-settings field-wide">
              <label className="multi-uniform-toggle">
                <input type="checkbox" checked={multiUniformPriceEnabled} onChange={e => {
                  const enabled = e.target.checked;
                  setMultiUniformPriceEnabled(enabled);
                  if (enabled && multiUniformPrice.trim()) applyMultiUniformField('price', multiUniformPrice);
                }} />
                <span>توحيد السعر القطاعي</span>
              </label>
              {multiUniformPriceEnabled && <input className="multi-uniform-input" type="number" min={0} step={0.01} value={multiUniformPrice} onChange={e => {
                const value = e.target.value;
                setMultiUniformPrice(value);
                applyMultiUniformField('price', value);
              }} placeholder="السعر لكل التركيبات" />}
              <label className="multi-uniform-toggle">
                <input type="checkbox" checked={multiUniformQuantityEnabled} onChange={e => {
                  const enabled = e.target.checked;
                  setMultiUniformQuantityEnabled(enabled);
                  if (enabled) applyMultiUniformField('quantity', multiUniformQuantity);
                }} />
                <span>توحيد الكمية</span>
              </label>
              {multiUniformQuantityEnabled && <input className="multi-uniform-input" type="number" min={0} step={1} value={multiUniformQuantity} onChange={e => {
                const value = e.target.value;
                setMultiUniformQuantity(value);
                applyMultiUniformField('quantity', value);
              }} placeholder="الكمية لكل تركيبة" />}
              <label className="multi-uniform-toggle">
                <input type="checkbox" checked={multiUniformWholesaleEnabled} onChange={e => {
                  const enabled = e.target.checked;
                  setMultiUniformWholesaleEnabled(enabled);
                  if (enabled && multiUniformWholesalePrice.trim()) applyMultiUniformField('wholesalePrice', multiUniformWholesalePrice);
                }} />
                <span>توحيد سعر الجملة</span>
              </label>
              {multiUniformWholesaleEnabled && <input className="multi-uniform-input" type="number" min={0} step={0.01} value={multiUniformWholesalePrice} onChange={e => {
                const value = e.target.value;
                setMultiUniformWholesalePrice(value);
                applyMultiUniformField('wholesalePrice', value);
              }} placeholder="سعر الجملة لكل التركيبات" />}
              <label className="multi-uniform-toggle">
                <input type="checkbox" checked={multiUniformCostEnabled} onChange={e => {
                  const enabled = e.target.checked;
                  setMultiUniformCostEnabled(enabled);
                  if (enabled && multiUniformCostPrice.trim()) applyMultiUniformField('costPrice', multiUniformCostPrice);
                }} />
                <span>توحيد التكلفة</span>
              </label>
              {multiUniformCostEnabled && <input className="multi-uniform-input" type="number" min={0} step={0.01} value={multiUniformCostPrice} onChange={e => {
                const value = e.target.value;
                setMultiUniformCostPrice(value);
                applyMultiUniformField('costPrice', value);
              }} placeholder="التكلفة لكل التركيبات" />}
            </div>
            <div className="field-wide product-variant-builder-actions">
              <button type="button" className="button button-primary" onClick={generateMultiVariants}><Boxes size={16}/> إنشاء التركيبات</button>
              {multiVariants.length > 0 && <span>{multiVariants.length} تركيبة جاهزة</span>}
            </div>
            {multiVariants.length > 0 && <div className="product-variants-table-wrap field-wide">
              <div className="product-variants-table">
                <div className="product-variants-head">
                  <span>اللون</span><span>المقاس</span><span>الباركود</span><span>القطاعي</span>{wholesaleEnabled && <span>الجملة</span>}<span>التكلفة</span><span>الكمية</span><span>حذف</span>
                </div>
                {multiVariants.map((variant,index) => <div className="product-variant-row" key={variant.color + '-' + variant.size + '-' + index}>
                  <b>{variant.color || '—'}</b>
                  <b>{variant.size || '—'}</b>
                  <input value={variant.barcode} onChange={e => updateMultiVariant(index,'barcode',e.target.value)} placeholder="اختياري" />
                  <input type="number" min={0} step={0.01} value={variant.price} onChange={e => updateMultiVariant(index,'price',e.target.value)} placeholder="0" />
                  {wholesaleEnabled && <input type="number" min={0} step={0.01} value={variant.wholesalePrice} onChange={e => updateMultiVariant(index,'wholesalePrice',e.target.value)} placeholder="0" />}
                  <input type="number" min={0} step={0.01} value={variant.costPrice} onChange={e => updateMultiVariant(index,'costPrice',e.target.value)} placeholder="اختياري" />
                  <input type="number" min={0} step={1} value={variant.quantity} onChange={e => updateMultiVariant(index,'quantity',e.target.value)} />
                  <button type="button" className="multi-variant-remove" onClick={() => setMultiVariants(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="حذف التركيبة" title="حذف التركيبة"><X size={16}/></button>
                </div>)}
              </div>
            </div>}
            <div className="role-hint field-wide"><Boxes size={17}/><span>كل تركيبة تُحفظ بمخزون وباركود مستقلين. يمكنك بيع الأسود M بدون التأثير على الأبيض L.</span></div>
          </>
        ) : <>
          <div className="product-form-section field-wide">
            <span className="product-form-section-number">02</span>
            <div>
              <b>أسعار البيع والمخزون</b>
              <small>أدخل سعرًا واحدًا على الأقل؛ تكلفة المنتج اختيارية.</small>
            </div>
          </div>
          <Field className="product-form-field" label="سعر القطاعي" name="price" type="number" min={0} step={0.01} placeholder="اختياري إذا أدخلت سعر الجملة" defaultValue={edit?.price===null?'':edit?String(edit.price):''}/>
          {wholesaleEnabled&&<Field className="product-form-field" label="سعر الجملة" name="wholesalePrice" type="number" min={0} step={0.01} placeholder="اختياري إذا أدخلت سعر القطاعي" defaultValue={edit?.wholesalePrice===null?'':edit?String(edit.wholesalePrice):''}/>}
          <Field className="product-form-field" label="سعر التكلفة (اختياري)" name="costPrice" type="number" min={0} step={0.01} placeholder="اتركه فارغًا لو غير متاح" defaultValue={edit ? String(edit.costPrice ?? 0) : ''}/>
          <Field className={`product-form-field ${isWarehouseManager ? 'field-wide' : ''}`} label="الكمية" name="quantity" type="number" min={0} step={1} required placeholder="0" defaultValue={edit ? String(edit.quantity) : '0'}/>
          {!pricingOnlyEdit&&<>
            <div className="product-form-section field-wide">
              <span className="product-form-section-number">03</span>
              <div><b>تفاصيل إضافية</b><small>كل هذه المعلومات اختيارية.</small></div>
            </div>
            {restaurantIngredientsEnabled ? (
              <label className="field product-form-field field-wide"><span>مكونات المنتج (اختياري)</span><textarea name="ingredients" rows={3} maxLength={1000} defaultValue={edit?.ingredients || ''} placeholder="اكتب مكونات المنتج التي ستظهر للعميل في منيو QR" /></label>
            ) : <>
              <Field className="product-form-field" label="اللون (اختياري)" name="color" placeholder="مثال: أسود" defaultValue={edit?.color || ''}/>
              <Field className="product-form-field" label="المقاس (اختياري)" name="size" placeholder="مثال: M أو 42" defaultValue={edit?.size || ''}/>
              <Field className="product-form-field field-wide" label="رقم القطعة / الموديل (اختياري)" name="partNumber" placeholder="اختياري، مثال: POLO-2026" defaultValue={edit?.partNumber || ''}/>
            </>}
          </>}
        </>}
        {priceFormError&&<div className="form-error field-wide" role="alert">{priceFormError}</div>}
        {(create.isError || update.isError) && <div className="form-error">تعذر حفظ المنتج. يرجى مراجعة البيانات.</div>}
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={() => { setDialog(false); setEdit(null); resetMultiProductForm(); }}>إلغاء</button>
          <button className="button button-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جارٍ الحفظ…' : 'حفظ المنتج'}</button>
        </div>
      </form>
    </Modal>}
    {notice && <div className="toast-note" role="status">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
  </div>;
}
function InvoiceReturnPicker({invoiceNo,setInvoiceNo,loadedInvoiceNo,setLoadedInvoiceNo,selectedItems,setSelectedItems,testIdPrefix}:{invoiceNo:string;setInvoiceNo:(value:string)=>void;loadedInvoiceNo:string;setLoadedInvoiceNo:(value:string)=>void;selectedItems:Record<string,number>;setSelectedItems:Dispatch<SetStateAction<Record<string,number>>>;testIdPrefix:string}) {
  const invoiceItems=useGetXStoreSaleInvoiceItems(loadedInvoiceNo,{query:{queryKey:getGetXStoreSaleInvoiceItemsQueryKey(loadedInvoiceNo),enabled:Boolean(loadedInvoiceNo)}});
  function searchInvoice(){
    const normalized=invoiceNo.trim();
    setSelectedItems({});
    if(!normalized){setLoadedInvoiceNo('');return}
    if(normalized===loadedInvoiceNo){void invoiceItems.refetch();return}
    setLoadedInvoiceNo(normalized);
  }
  function updateInvoice(value:string){
    setInvoiceNo(value);
    if(value.trim()!==loadedInvoiceNo){setLoadedInvoiceNo('');setSelectedItems({})}
  }
  function toggleItem(item:SaleInvoiceItem,checked:boolean){
    setSelectedItems(current=>{
      const next={...current};
      if(checked&&item.returnableQuantity>0)next[item.productId]=Math.min(1,item.returnableQuantity);
      else delete next[item.productId];
      return next;
    });
  }
  return <div className="invoice-items-picker field-wide">
    <label className="field"><span>رقم الفاتورة الأصلية</span><div className="invoice-search-control"><input value={invoiceNo} onChange={e=>updateInvoice(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();searchInvoice()}}} required placeholder="اكتب رقم الفاتورة" data-testid={`input-${testIdPrefix}-invoice`}/><button type="button" className="button button-quiet" onClick={searchInvoice} disabled={!invoiceNo.trim()||invoiceItems.isFetching} data-testid={`button-${testIdPrefix}-invoice-search`}>{invoiceItems.isFetching?'جارٍ البحث…':'عرض الفاتورة'}</button></div></label>
    {loadedInvoiceNo&&invoiceItems.isLoading&&<div className="empty-inline">جارٍ تحميل أصناف الفاتورة…</div>}
    {loadedInvoiceNo&&invoiceItems.isError&&<div className="form-error" role="alert">لم يتم العثور على الفاتورة أو تعذر تحميل أصنافها.</div>}
    {loadedInvoiceNo&&invoiceItems.data&&<div className="invoice-items-list" data-testid={`${testIdPrefix}-invoice-items`}>
      <div className="invoice-items-heading"><b>أصناف الفاتورة</b><span>حدد صنفاً أو أكثر وحدد الكمية</span></div>
      {invoiceItems.data.length?invoiceItems.data.map(item=>{
        const selected=Object.prototype.hasOwnProperty.call(selectedItems,item.productId);
        return <div className={`invoice-item-option${selected?' is-selected':''}`} key={item.productId}>
          <label className="invoice-item-label"><input type="checkbox" checked={selected} disabled={!item.returnableQuantity} onChange={e=>toggleItem(item,e.target.checked)} aria-label={`اختيار ${latinizeDigits(item.name)}`} data-testid={`checkbox-${testIdPrefix}-item-${item.productId}`}/><span><b>{latinizeDigits(item.name)}</b><small>{latinizeDigits(item.sku)} · في الفاتورة {fmt(item.quantity)} · تم إرجاع {fmt(item.returnedQuantity)} · متاح للإرجاع {fmt(item.returnableQuantity)}</small></span></label>
          {selected&&<label className="invoice-item-quantity"><span>الكمية</span><input type="number" min={1} max={item.returnableQuantity} step={1} value={selectedItems[item.productId]} onChange={e=>{const quantity=Math.max(1,Math.min(item.returnableQuantity,Number(e.target.value)||1));setSelectedItems(current=>({...current,[item.productId]:quantity}))}} aria-label={`كمية الإرجاع من ${item.name}`} data-testid={`input-${testIdPrefix}-quantity-${item.productId}`}/></label>}
        </div>
      }):<div className="empty-inline">لا توجد أصناف على هذه الفاتورة.</div>}
    </div>}
  </div>;
}

function PosPage() {
  const qc=useQueryClient(), products=useListXStoreProducts(), held=useListXStoreHeldSales(), session=useGetXStoreSession(), checkout=useCheckoutXStoreSale(), hold=useHoldXStoreSale(), release=useReleaseXStoreHeldSale(), exchange=useCreateXStoreExchange();
  const money=useMoney(), currency=useContext(CurrencyContext);
  const vatRate=session.data?.vatRate??.15;
  const wholesaleEnabled=session.data?.wholesaleEnabled??false;
  const canSellRetail=canSellSaleType(session.data,'retail');
  const canSellWholesale=wholesaleEnabled&&canSellSaleType(session.data,'wholesale');
  const initialSaleType:SaleType=canSellRetail?'retail':canSellWholesale?'wholesale':'retail';
  const [cart,setCart]=useState<Record<string,number>>({}),[term,setTerm]=useState(''),[discount,setDiscount]=useState('0'),[received,setReceived]=useState(''),[payment,setPayment]=useState<'cash'|'card'|'wallet'|'instapay'>('cash'),[transferSender,setTransferSender]=useState(''),[heldOpen,setHeldOpen]=useState(false),[exchangeOpen,setExchangeOpen]=useState(false),[notice,setNotice]=useState('');
  const [saleType,setSaleType]=useState<SaleType>(initialSaleType);
  const scannerBufferRef=useRef('');
  const scannerStartedAtRef=useRef(0);
  const scannerLastKeyAtRef=useRef(0);
  const [exchangeInvoiceNo,setExchangeInvoiceNo]=useState(''),[exchangeLoadedInvoiceNo,setExchangeLoadedInvoiceNo]=useState(''),[exchangeReturnItems,setExchangeReturnItems]=useState<Record<string,number>>({});
  const [exchangeReplacementProductId,setExchangeReplacementProductId]=useState(''),[exchangeReplacementQuantity,setExchangeReplacementQuantity]=useState(1);
  const [exchangeAmountReceived,setExchangeAmountReceived]=useState('');
  const [exchangePayment,setExchangePayment]=useState<'cash'|'card'|'wallet'>('cash');
  const [exchangePaymentError,setExchangePaymentError]=useState('');
  const exchangeInvoiceItems=useGetXStoreSaleInvoiceItems(exchangeLoadedInvoiceNo,{query:{queryKey:getGetXStoreSaleInvoiceItemsQueryKey(exchangeLoadedInvoiceNo),enabled:Boolean(exchangeLoadedInvoiceNo)}});
  const [customerName,setCustomerName]=useState(''),[customerPhone,setCustomerPhone]=useState(''),[tableNumber,setTableNumber]=useState(''),[orderType,setOrderType]=useState<RestaurantOrderType>('external'),[phoneCountryOverride,setPhoneCountryOverride]=useState<string|null>(null),[invoiceReference,setInvoiceReference]=useState(createHeldInvoiceReference),[receiptSale,setReceiptSale]=useState<Sale|null>(null);
  const phoneCountry=getPhoneCountry(phoneCountryOverride??session.data?.countryCode);
  const invoicePhone=phoneNumberForCountry(phoneCountry.countryCode,customerPhone);
  const customerWhatsappNumber=getWhatsAppDigits(invoicePhone);
  const [restaurantFeature,setRestaurantFeature]=useState<boolean|null>(null);
  const isRestaurantStore=session.data?.storeType==='cafe'||session.data?.storeType==='restaurant'||(session.data?.storeType==null&&restaurantFeature===true);
  useEffect(()=>{
    if(session.isLoading||!session.data||session.data.role!=='tenant_admin'||session.data.storeType!=null)return;
    let cancelled=false;
    void fetch('/api/xstore/restaurant-feature',{credentials:'include'})
      .then(async response=>response.ok?response.json() as Promise<{enabled?:boolean}>:{enabled:false})
      .then(result=>{if(!cancelled)setRestaurantFeature(result.enabled===true);})
      .catch(()=>{if(!cancelled)setRestaurantFeature(false);});
    return()=>{cancelled=true;};
  },[session.isLoading,session.data?.id,session.data?.role,session.data?.storeType]);
  useEffect(()=>{
    if(canSellRetail&&saleType==='wholesale'&&!canSellWholesale)setSaleType('retail');
    else if(!canSellRetail&&canSellWholesale&&saleType!=='wholesale')setSaleType('wholesale');
  },[canSellRetail,canSellWholesale,saleType]);
  const customerPhoneInvalid=Boolean(customerPhone.trim()&&!customerWhatsappNumber);
  function changeCustomerPhone(value:string) {
    if (/^\s*(?:\+|00)/.test(value)) {
      const international=splitInternationalPhone(value);
      if (international.countryCode) {
        setPhoneCountryOverride(international.countryCode);
        setCustomerPhone(international.nationalNumber);
        return;
      }
    }
    if (!value.trim()) setPhoneCountryOverride(null);
    setCustomerPhone(value);
  }
  const visible=(products.data||[]).filter(p=>matchesProductSearch(p,term)&&salePriceForProduct(p,saleType)!==null);
  const cartLines=(products.data||[]).filter(p=>cart[p.id]).map(p=>({...p,count:cart[p.id],salePrice:salePriceForProduct(p,saleType)??0}));
   useEffect(()=>{if(!cartLines.length){if(customerPhone)setCustomerPhone('');if(phoneCountryOverride)setPhoneCountryOverride(null);if(customerName)setCustomerName('');if(!isRestaurantStore&&tableNumber)setTableNumber('')}},[cartLines.length,customerPhone,phoneCountryOverride,customerName,isRestaurantStore,tableNumber]);
  const subtotal=roundMoney(cartLines.reduce((s,p)=>s+p.salePrice*p.count,0)), disc=Math.min(subtotal,roundMoney(Math.max(0,Number(discount)||0))), tax=roundMoney((subtotal-disc)*vatRate), total=roundMoney(subtotal-disc+tax);
  const exchangeReturnedAmount=roundMoney(Object.entries(exchangeReturnItems).reduce((sum,[productId,quantity])=>{
    const item=exchangeInvoiceItems.data?.find(line=>line.productId===productId);
    return sum+(item?item.refundUnitAmount*quantity:0);
  },0));
  const exchangeSaleType=exchangeInvoiceItems.data?.[0]?.saleType??'retail';
  const exchangeReplacementProduct=(products.data||[]).find(product=>product.id===exchangeReplacementProductId);
  const exchangeReplacementPrice=exchangeReplacementProduct?salePriceForProduct(exchangeReplacementProduct,exchangeSaleType):null;
  const exchangeReplacementSubtotal=roundMoney((exchangeReplacementPrice??0)*exchangeReplacementQuantity);
  const exchangeReplacementTotal=roundMoney(exchangeReplacementSubtotal+roundMoney(exchangeReplacementSubtotal*vatRate));
  const exchangeBalanceDue=roundMoney(exchangeReplacementTotal-exchangeReturnedAmount);
  const exchangeCashAmount=Number(exchangeAmountReceived);
  const exchangeCashUnderpaid=exchangePayment==='cash'&&exchangeBalanceDue>0&&(!exchangeAmountReceived.trim()||!Number.isFinite(exchangeCashAmount)||roundMoney(exchangeCashAmount)<exchangeBalanceDue);
  const exchangeChangeAmount=exchangePayment==='cash'?roundMoney(Math.max(0,(Number(exchangeAmountReceived)||0)-Math.max(0,exchangeBalanceDue))):0;
  useEffect(()=>{setExchangeAmountReceived(exchangeBalanceDue>0?String(exchangeBalanceDue):'0')},[exchangeBalanceDue]);
  useEffect(()=>{setExchangeReplacementProductId('');setExchangeReplacementQuantity(1)},[exchangeLoadedInvoiceNo,exchangeSaleType]);
  function switchSaleType(next:SaleType) {
     if((next==='retail'&&!canSellRetail)||(next==='wholesale'&&!canSellWholesale))return;
    if(next===saleType)return;
    if(cartLines.length&&!window.confirm('سيتم تفريغ الطلب الحالي قبل تغيير قسم البيع. هل تريد المتابعة؟'))return;
    setCart({});
    setDiscount('0');
    setReceived('');
    setSaleType(next);
    setInvoiceReference(createHeldInvoiceReference());
  }
  const add=(p:Product)=>setCart(c=>({...c,[p.id]:Math.min(p.quantity,(c[p.id]||0)+1)}));
  function addScannedProduct(code:string) {
    const normalized=code.trim();
    if (!normalized) return;
    const product=(products.data||[]).find(p=>String(p.barcode||'').trim()===normalized)
      || (products.data||[]).find(p=>String(p.sku||'').trim()===normalized);
    if (!product) {
      setNotice('الباركود غير مسجل في المنتجات.');
      return;
    }
    if (!product.quantity) {
      setNotice('هذا المنتج نفد من المخزون.');
      return;
    }
    const nextQuantity=Math.min(product.quantity,(cart[product.id]||0)+1);
    add(product);
    setTerm('');
    setNotice('تمت إضافة '+product.name+' · الكمية '+nextQuantity);
  }
  useEffect(()=>{
    const onScannerKeyDown=(event:KeyboardEvent)=>{
      const target=event.target instanceof HTMLElement ? event.target : null;
      const isSearchInput=target?.getAttribute('data-testid')==='input-pos-search';
      const isEditable=Boolean(target && (target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.isContentEditable));
      const now=performance.now();
      if(event.key==='Enter'){
        const buffer=scannerBufferRef.current;
        const duration=now-scannerStartedAtRef.current;
        const gap=now-scannerLastKeyAtRef.current;
        if(buffer.length>=4 && duration<=1200 && gap<=250){
          event.preventDefault();
          event.stopPropagation();
          scannerBufferRef.current='';
          scannerStartedAtRef.current=0;
          scannerLastKeyAtRef.current=0;
          addScannedProduct(buffer);
        } else {
          scannerBufferRef.current='';
          scannerStartedAtRef.current=0;
          scannerLastKeyAtRef.current=0;
        }
        return;
      }
      if(event.key.length!==1 || (isEditable && !isSearchInput)){
        if(isEditable && !isSearchInput){
          scannerBufferRef.current='';
          scannerStartedAtRef.current=0;
          scannerLastKeyAtRef.current=0;
        }
        return;
      }
      if(scannerLastKeyAtRef.current && now-scannerLastKeyAtRef.current>120){
        scannerBufferRef.current='';
        scannerStartedAtRef.current=now;
      }
      if(!scannerBufferRef.current) scannerStartedAtRef.current=now;
      scannerBufferRef.current+=event.key;
      scannerLastKeyAtRef.current=now;
    };
    window.addEventListener('keydown',onScannerKeyDown,true);
    return()=>window.removeEventListener('keydown',onScannerKeyDown,true);
  },[products.data,cart]);
  const mutateCart=(id:string,n:number)=>setCart(c=>{const value=(c[id]||0)+n;if(value<=0){const next={...c};delete next[id];return next}return {...c,[id]:value}});
   const cashAmount=Number(received);
   const cashAmountInvalid=payment==='cash'&&(!received.trim()||!Number.isFinite(cashAmount)||cashAmount<=0||roundMoney(cashAmount)<total);
   const transferSenderInvalid=(payment==='wallet'||payment==='instapay')&&!transferSender.trim();
   function finish(){if(!cartLines.length||customerPhoneInvalid||cashAmountInvalid||transferSenderInvalid)return;checkout.mutate({data:{invoiceNo:invoiceReference,saleType,items:cartLines.map(p=>({productId:p.id,quantity:p.count})),discountAmount:disc,paymentMethod:payment,amountReceived:payment==='cash'?roundMoney(cashAmount):total,transferSender:payment==='wallet'||payment==='instapay'?transferSender.trim():null,customerName:customerName.trim()||null,customerPhone:invoicePhone.trim()||null,tableNumber:isRestaurantStore?tableNumber.trim()||null:null,orderType:isRestaurantStore?orderType:null}},{onSuccess:s=>{setCart({});setDiscount('0');setReceived('');setTransferSender('');setCustomerName('');setCustomerPhone('');setTableNumber('');setOrderType('external');setPhoneCountryOverride(null);setInvoiceReference(createHeldInvoiceReference());setPayment('cash');setReceiptSale(s);qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreProfitLossReportQueryKey()});setNotice(`تمت عملية البيع · ${s.invoiceNo}`)}})}
   function park(){if(!cartLines.length||customerPhoneInvalid)return;hold.mutate({data:{reference:invoiceReference,saleType,items:cartLines.map(p=>({productId:p.id,quantity:p.count})),customerName:customerName.trim()||null,customerPhone:invoicePhone.trim()||null,discountAmount:disc,paymentMethod:payment,transferSender:transferSender.trim()||null,amountReceived:roundMoney(Number(received)||0)}},{onSuccess:heldSale=>{setCart({});setDiscount('0');setReceived('');setTransferSender('');setCustomerName('');setCustomerPhone('');setTableNumber('');setOrderType('external');setPhoneCountryOverride(null);setInvoiceReference(createHeldInvoiceReference());setPayment('cash');qc.invalidateQueries({queryKey:getListXStoreHeldSalesQueryKey()});setNotice(`تم تعليق الفاتورة ${heldSale.reference}`)}})}
   function clearCurrentCart(){setCart({});setDiscount('0');setReceived('');setTransferSender('');setCustomerName('');setCustomerPhone('');setTableNumber('');setOrderType('external');setPhoneCountryOverride(null);setInvoiceReference(createHeldInvoiceReference())}
  function closeExchange(){setExchangeOpen(false);setExchangeInvoiceNo('');setExchangeLoadedInvoiceNo('');setExchangeReturnItems({});setExchangeReplacementProductId('');setExchangeReplacementQuantity(1);setExchangeAmountReceived('');setExchangePayment('cash');setExchangePaymentError('')}
   function submitExchange(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const paymentMethod=String(f.get('paymentMethod')) as 'cash'|'card'|'wallet';const amountReceived=paymentMethod==='cash'?Number(exchangeAmountReceived)||0:Math.max(0,exchangeBalanceDue);const returnItems=Object.entries(exchangeReturnItems).map(([productId,quantity])=>({productId,quantity}));if(!exchangeLoadedInvoiceNo||exchangeLoadedInvoiceNo!==exchangeInvoiceNo.trim()||!returnItems.length||!exchangeReplacementProductId)return;if(paymentMethod==='cash'&&amountReceived<Math.max(0,exchangeBalanceDue)){setExchangePaymentError('المبلغ المستلم أقل من فرق السعر المستحق.');return}setExchangePaymentError('');exchange.mutate({data:{invoiceNo:exchangeLoadedInvoiceNo,returnItems,replacementItems:[{productId:exchangeReplacementProductId,quantity:exchangeReplacementQuantity}],discountAmount:0,paymentMethod,amountReceived}},{onSuccess:r=>{closeExchange();const settlement=r.changeAmount>0?(r.balanceDue>0?`الباقي للعميل ${money(r.changeAmount)}`:`المبلغ المسترد للعميل ${money(r.changeAmount)}`):'';setNotice([`تم الاستبدال · ${r.exchangeInvoiceNo}`,settlement].filter(Boolean).join(' · '));qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreProfitLossReportQueryKey()});qc.invalidateQueries({queryKey:getGetXStoreSaleInvoiceItemsQueryKey(exchangeLoadedInvoiceNo)})}})}
   if(!canSellRetail&&!canSellWholesale)return <div className="pos-page"><PageTitle eyebrow="نقطة البيع" title="صندوق البيع" desc="لا توجد صلاحية بيع مفعّلة لهذا الحساب."/><div className="state-box error-state"><ShieldCheck size={22}/><b>لا يوجد نوع بيع متاح</b><span>اطلب من مالك المتجر منحك صلاحية قطاعي أو جملة، والتأكد من تفعيل الجملة للمتجر عند الحاجة.</span></div></div>;
  return <>
    <div className="pos-page">
      <PageTitle eyebrow="نقطة البيع" title="صندوق البيع" desc="أضف المنتجات وأكمل الدفع بخطوات قليلة."
        action={<div className="pos-head-actions">
          <button className="button button-quiet" onClick={()=>{closeExchange();setExchangeOpen(true)}}><ArrowLeftRight size={16}/> استبدال منتج</button>
          <button className="button button-quiet held-toggle" onClick={()=>{const nextOpen=!heldOpen;setHeldOpen(nextOpen);if(nextOpen)void held.refetch()}}><Pause size={16}/> الفواتير المعلّقة <span className="count-bubble">{held.data?.length||0}</span></button>
        </div>}
      />
      <div className="pos-layout">
        <section className="pos-products">
          <label className="search-box pos-search"><Search size={18}/><input autoFocus value={term} onChange={e=>setTerm(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&term.trim())addScannedProduct(term)}} aria-label="البحث عن منتج بالعربي أو English أو مسح الباركود" placeholder="ابحث باسم المنتج بأي لهجة أو English..." data-testid="input-pos-search"/><kbd>⌘ K</kbd></label>
          {wholesaleEnabled&&(canSellRetail||canSellWholesale)&&<div className={`sale-type-tabs ${canSellRetail&&canSellWholesale?'':'sale-type-tabs-single'}`} role="group" aria-label="قسم البيع">
            {canSellRetail&&<button type="button" className={saleType==='retail'?'is-active':''} aria-pressed={saleType==='retail'} onClick={()=>switchSaleType('retail')}><b>القطاعي</b><small>سعر القطاعي</small></button>}
            {canSellWholesale&&<button type="button" className={saleType==='wholesale'?'is-active':''} aria-pressed={saleType==='wholesale'} onClick={()=>switchSaleType('wholesale')}><b>الجملة</b><small>سعر الجملة</small></button>}
          </div>}
          {products.isLoading
            ? <div className="product-grid">{[1,2,3,4].map(i=><div className="product-skeleton" key={i}/>)}</div>
            : products.isError
              ? <StateBlock loading={false} error onRetry={()=>products.refetch()} empty={false}/>
              : visible.length
                ? <div className="product-grid">{visible.map(p=>{const {symbol,tone,kind}=getProductIcon(p);return <button key={p.id} onClick={()=>add(p)} disabled={!p.quantity} aria-label={`إضافة ${p.name} إلى الفاتورة`} className={`product-tile ${!p.quantity?'tile-disabled':''}`} data-testid={`button-pos-product-${p.id}`}>
                    <span className={`product-art art-${tone}`} data-product-icon={kind}><ProductIconSymbol symbol={symbol} kind={kind}/>{cart[p.id]?<i>{cart[p.id]}</i>:null}</span>
                    <span className="tile-category">{p.category}</span><b>{p.name}</b><small className="ltr-id">{p.sku}</small>
                    <span className="tile-bottom"><strong>{money(salePriceForProduct(p,saleType)??0)}</strong><span>متاح {fmt(p.quantity)}</span></span>
                  </button>})}</div>
                : <div className="state-box"><div className="empty-symbol"><Package/></div><b>{term?'لا توجد نتائج':'لا توجد منتجات'}</b><span>{term?'جرّب البحث بكلمة مختلفة.':'أضف المنتجات إلى المخزون لتبدأ البيع.'}</span></div>
          }
        </section>
        <aside className="cart-panel">
          <div className="cart-head"><div><h2>الطلب الحالي</h2><span>{fmt(cartLines.reduce((a,p)=>a+p.count,0))} أصناف</span></div><button className="table-action" onClick={clearCurrentCart} disabled={!cartLines.length}><Trash2 size={14}/> تفريغ</button></div>
          <div className="cart-invoice-number"><span>رقم الفاتورة</span><b className="ltr-id">{invoiceReference}</b></div>
          <div className="cart-lines">
            {cartLines.map(p=>{const {symbol,tone,kind}=getProductIcon(p);return <div className="cart-line" key={p.id}>
              <span className={`cart-line-art art-${tone}`} data-product-icon={kind}><ProductIconSymbol symbol={symbol} kind={kind}/></span><div className="cart-line-title"><b>{p.name}</b><small>{money(p.salePrice)}</small></div>
              <div className="stepper"><button onClick={()=>mutateCart(p.id,-1)} aria-label="إنقاص"><Minus size={13}/></button><b>{p.count}</b><button onClick={()=>mutateCart(p.id,1)} aria-label="زيادة" disabled={p.count>=p.quantity}><Plus size={13}/></button></div>
              <strong>{money(p.salePrice*p.count)}</strong>
            </div>})}
            {!cartLines.length&&<div className="cart-empty"><div className="cart-empty-icon"><ShoppingCart size={20}/></div><b>السلة فارغة</b><span>اختر منتجاً لإضافته إلى الفاتورة.</span></div>}
          </div>
          <div className="cart-calculation">
            <div><span>المجموع الفرعي</span><b>{money(subtotal)}</b></div>
            <label><span>الخصم</span><div className="discount-input"><input aria-label="قيمة الخصم" type="number" min="0" value={discount} onChange={e=>setDiscount(e.target.value)} disabled={!cartLines.length}/><span>{currencyShortLabels[currency]}</span></div></label>
            <div><span>ضريبة القيمة المضافة · {fmt(vatRate*100)}٪</span><b>{money(tax)}</b></div><div className="cart-total"><span>الإجمالي</span><b>{money(total)}</b></div>
          </div>
          <div className="payment-tabs">{(['cash','card','wallet','instapay'] as const).map((m,i)=>{const I=[Banknote,CreditCard,Wallet,Smartphone][i];return <button key={m} onClick={()=>setPayment(m)} className={payment===m?'payment-active':''}><I size={16}/>{paymentName(m)}</button>})}</div>
          {payment==='cash'&&<label className="received-field"><span>المبلغ النقدي المستلم <em>إلزامي</em></span><div><input type="number" min={Math.max(total,.01)} step="0.01" value={received} onChange={e=>setReceived(e.target.value)} placeholder={fmt(total)} aria-label="المبلغ النقدي المستلم" required/><small>{received.trim()&&cashAmount>0?cashAmount>=total?`الباقي ${money(roundMoney(cashAmount-total))}`:`المتبقي ${money(roundMoney(total-cashAmount))}`:'أدخل المبلغ المستلم'}</small></div></label>}
          {(payment==='wallet'||payment==='instapay')&&<label className="transfer-sender-field"><span>رقم أو حساب المرسل <em>إلزامي</em></span><input type="text" dir="ltr" maxLength={80} autoComplete="off" value={transferSender} onChange={e=>setTransferSender(e.target.value)} placeholder={payment==='instapay'?'رقم الهاتف أو عنوان InstaPay':'رقم المحفظة المحوِّل منها'} aria-label="رقم أو حساب المرسل" required/><small>سجّل الرقم الذي استقبلت منه التحويل.</small></label>}
          {isRestaurantStore&&<div className="restaurant-order-type" role="group" aria-label="نوع الطلب"><span><Utensils size={14}/> نوع الطلب</span><div><button type="button" className={orderType==='internal'?'is-active':''} onClick={()=>setOrderType('internal')}>داخلي</button><button type="button" className={orderType==='external'?'is-active':''} onClick={()=>{setOrderType('external');setTableNumber('')}}>خارجي</button></div></div>}
          {isRestaurantStore&&orderType==='internal'&&<label className="customer-phone-field customer-name-field"><span><Utensils size={14}/> رقم الترابيزة <em>اختياري</em></span><input type="text" inputMode="numeric" maxLength={30} value={tableNumber} onChange={e=>setTableNumber(e.target.value.replace(/[^0-9٠-٩A-Za-z-]/g,''))} placeholder="مثال: 12" aria-label="رقم الترابيزة"/></label>}
          <label className="customer-phone-field customer-name-field"><span><Users size={14}/> اسم العميل <em>اختياري</em></span><input type="text" maxLength={150} autoComplete="name" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="اكتب اسم العميل" aria-label="اسم العميل على الفاتورة" data-testid="input-customer-name" disabled={!cartLines.length}/></label>
          <label className="customer-phone-field"><span><Phone size={14}/> رقم هاتف العميل على الفاتورة <em>اختياري</em></span><div className="customer-phone-input" dir="ltr"><span className="customer-phone-prefix" aria-label={`مفتاح الدولة +${phoneCountry.callingCode}`}>+{phoneCountry.callingCode}</span><input type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" value={customerPhone} onChange={e=>changeCustomerPhone(e.target.value)} placeholder="10 1234 5678" aria-label="رقم هاتف العميل بدون مفتاح الدولة" data-testid="input-customer-phone" disabled={!cartLines.length}/></div><small>مفتاح الدولة ثابت حسب دولة المتجر: {phoneCountry.name} (+{phoneCountry.callingCode}).</small>{customerPhoneInvalid&&<small className="customer-phone-error" role="alert">تأكد من كتابة رقم هاتف صحيح لهذا المفتاح.</small>}</label>
          <div className="cart-actions">
            <button className="button button-quiet" onClick={park} disabled={!cartLines.length||hold.isPending||customerPhoneInvalid}><Pause size={15}/>{hold.isPending?'جارٍ الحفظ':'تعليق'}</button>
            <button className="button button-confirm" onClick={finish} disabled={!cartLines.length||checkout.isPending||customerPhoneInvalid||cashAmountInvalid||transferSenderInvalid}>{checkout.isPending?'جارٍ إتمام البيع':<><CircleCheck size={17}/> إتمام البيع</>}</button>
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
               <small className="held-status">{h.saleType==='wholesale'?'بيع جملة':'بيع قطاعي'} · معلّقة</small>
            </div>
            <strong>{money(h.estimatedTotal)}</strong>
            <div className="held-actions">
              {whatsappUrl&&<a className="button button-whatsapp button-small" href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={`إرسال الفاتورة ${h.reference} عبر واتساب`}><MessageCircle size={14}/> واتساب</a>}
              <button className="button button-primary button-small" disabled={release.isPending||cartLines.length>0} onClick={()=>release.mutate({heldSaleId:h.id},{onSuccess:()=>{
                setCart(Object.fromEntries(h.items.map(item=>[item.productId,item.quantity])));
                 setSaleType(h.saleType);
                setDiscount(String(h.discountAmount));
                setReceived(h.amountReceived?String(h.amountReceived):'');
                setTransferSender(h.transferSender||'');
                setPayment(h.paymentMethod);
                setCustomerName(h.customerName||'');
                const restoredPhone=splitInternationalPhone(h.customerPhone);
                setCustomerPhone(restoredPhone.nationalNumber);
                setPhoneCountryOverride(restoredPhone.countryCode);
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
      {exchangeOpen&&<Modal title="استبدال منتج" close={closeExchange}><form className="form-grid" onSubmit={submitExchange}>
        <InvoiceReturnPicker invoiceNo={exchangeInvoiceNo} setInvoiceNo={setExchangeInvoiceNo} loadedInvoiceNo={exchangeLoadedInvoiceNo} setLoadedInvoiceNo={setExchangeLoadedInvoiceNo} selectedItems={exchangeReturnItems} setSelectedItems={setExchangeReturnItems} testIdPrefix="exchange"/>
        <label className="field"><span>المنتج البديل · {exchangeSaleType==='wholesale'?'سعر الجملة':'سعر القطاعي'}</span><select name="replacementProduct" value={exchangeReplacementProductId} onChange={event=>setExchangeReplacementProductId(event.target.value)} required><option value="" disabled>اختر المنتج البديل</option>{products.data?.filter(p=>p.quantity>0&&salePriceForProduct(p,exchangeSaleType)!==null).map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku} · {money(salePriceForProduct(p,exchangeSaleType)??0)}</option>)}</select></label>
        <label className="field"><span>كمية المنتج البديل</span><input name="replacementQuantity" type="number" min={1} max={exchangeReplacementProduct?.quantity||1} step={1} value={exchangeReplacementQuantity} onChange={event=>setExchangeReplacementQuantity(Math.max(1,Math.min(exchangeReplacementProduct?.quantity||1,Number(event.target.value)||1)))} required/></label>
        <label className="field"><span>طريقة الدفع / التسوية</span><select name="paymentMethod" value={exchangePayment} onChange={event=>{setExchangePayment(event.target.value as 'cash'|'card'|'wallet');setExchangePaymentError('')}}><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="wallet">محفظة</option></select></label>
        {exchangeLoadedInvoiceNo&&exchangeReplacementProduct&&Object.keys(exchangeReturnItems).length>0&&<div className="exchange-price-summary field-wide" aria-live="polite"><div><span>قيمة المنتجات المرتجعة</span><b>{money(exchangeReturnedAmount)}</b></div><div><span>قيمة المنتج البديل شامل الضريبة</span><b>{money(exchangeReplacementTotal)}</b></div><div className={`exchange-price-difference ${exchangeBalanceDue>0?'exchange-due':exchangeBalanceDue<0?'exchange-refund':''}`}><span>فرق السعر</span><strong>{exchangeBalanceDue>0?`على العميل ${money(exchangeBalanceDue)}`:exchangeBalanceDue<0?`على المتجر رد ${money(Math.abs(exchangeBalanceDue))} للعميل`:'لا يوجد فرق سعر'}</strong></div></div>}
        {exchangeBalanceDue>0&&exchangePayment==='cash'&&<label className="field field-wide"><span>المبلغ المستلم من العميل</span><input name="amountReceived" type="number" min={Math.max(0,exchangeBalanceDue)} step="0.01" value={exchangeAmountReceived} onChange={event=>{setExchangeAmountReceived(event.target.value);setExchangePaymentError('')}}/></label>}
        {exchangePaymentError&&<div className="form-error field-wide" role="alert">{exchangePaymentError}</div>}
        {exchangeCashUnderpaid&&<div className="form-error field-wide" role="alert">المبلغ المستلم يجب ألا يقل عن فرق السعر المستحق.</div>}
        {exchangeBalanceDue>0&&exchangeChangeAmount>0&&<div className="exchange-change-summary field-wide" role="status"><span>الباقي للعميل</span><strong>{money(exchangeChangeAmount)}</strong></div>}
        <div className="role-hint field-wide"><ArrowLeftRight size={17}/><span>يُسجل المرتجع والمنتج البديل كعملية واحدة ذرية؛ لا يتم حفظ نصف العملية.</span></div>
        {exchange.isError&&<div className="form-error">تعذر إتمام الاستبدال. تحقق من الفاتورة والكميات.</div>}
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={closeExchange}>إلغاء</button><button className="button button-confirm" disabled={exchange.isPending||!Object.keys(exchangeReturnItems).length||!exchangeReplacementProductId||exchangeLoadedInvoiceNo!==exchangeInvoiceNo.trim()||exchangeCashUnderpaid}>{exchange.isPending?'جارٍ تنفيذ الاستبدال…':'تأكيد الاستبدال'}</button></div>
      </form></Modal>}
    </div>
  </>;
}
function ReportsPage() {
  const poultrySession = useContext(XStoreSessionContext);
  if (poultrySession?.storeType === 'poultry') return <PoultryReportsPage />;
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
  const qc=useQueryClient(), sales=useListXStoreSales({limit:100}), ret=useCreateXStoreReturnBatch();
  const money=useMoney();
  const session=useGetXStoreSession();
  const canViewAmounts=hasAppRole(session.data,['platform_admin','tenant_admin','accountant']);
  const canReturn=hasAppRole(session.data,['platform_admin','tenant_admin','cashier']);
  const [selected,setSelected]=useState<Sale|null>(null),[printTarget,setPrintTarget]=useState<Sale|null>(null),[detailsSaleId,setDetailsSaleId]=useState<string|null>(null),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
  const [returnInvoiceNo,setReturnInvoiceNo]=useState(''),[returnLoadedInvoiceNo,setReturnLoadedInvoiceNo]=useState(''),[returnSelectedItems,setReturnSelectedItems]=useState<Record<string,number>>({});
  const rows=(sales.data||[]).filter(s=>s.invoiceNo.toLowerCase().includes(search.toLowerCase()));
  function toggleSaleItems(sale:Sale){setDetailsSaleId(current=>current===sale.id?null:sale.id)}
  function closeReturn(){setSelected(null);setReturnInvoiceNo('');setReturnLoadedInvoiceNo('');setReturnSelectedItems({})}
  function openReturn(sale:Sale){setSelected(sale);setReturnInvoiceNo(sale.invoiceNo);setReturnLoadedInvoiceNo(sale.invoiceNo);setReturnSelectedItems({})}
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const items=Object.entries(returnSelectedItems).map(([productId,quantity])=>({productId,quantity}));
    if(!returnLoadedInvoiceNo||returnLoadedInvoiceNo!==returnInvoiceNo.trim()||!items.length)return;
    ret.mutate({data:{invoiceNo:returnLoadedInvoiceNo,items,reason:String(form.get('reason'))}},{onSuccess:result=>{
      qc.invalidateQueries({queryKey:getListXStoreSalesQueryKey()});
      qc.invalidateQueries({queryKey:getListXStoreProductsQueryKey()});
      qc.invalidateQueries({queryKey:getGetXStoreDashboardQueryKey()});
      qc.invalidateQueries({queryKey:getGetXStoreProfitLossReportQueryKey()});
      qc.invalidateQueries({queryKey:getGetXStoreSaleInvoiceItemsQueryKey(returnLoadedInvoiceNo)});
      closeReturn();
      setNotice(`تم تسجيل المرتجع · ${money(result.refundAmount)}`);
    }});
  }
  return <div className="sales-page">
    <PageTitle eyebrow="حركة المتجر" title="المبيعات" desc="الفواتير الأخيرة وطرق الدفع والمرتجعات المسجلة." action={<button className="button button-quiet" onClick={()=>sales.refetch()}><RefreshCw size={15}/> تحديث القائمة</button>}/>
    {canViewAmounts&&<div className="stat-grid sales-stats"><StatCard label="عمليات ظاهرة" value={fmt(sales.data?.length||0)} detail="آخر 100 فاتورة" icon={ReceiptText}/><StatCard label="إجمالي المبيعات" value={money((sales.data||[]).reduce((a,s)=>a+s.total,0))} detail="حسب القائمة المحمّلة" icon={Banknote} tint="gold"/><StatCard label="نقداً" value={fmt((sales.data||[]).filter(s=>s.paymentMethod==='cash').length)} detail="عمليات نقدية" icon={Wallet} tint="sage"/><StatCard label="مرتجعة" value={fmt((sales.data||[]).filter(s=>s.status!=='completed').length)} detail="تتضمن استرداداً" icon={RotateCcw} tint="red"/></div>}
    <Card className="sales-invoice-panel"><SectionHead title="سجل الفواتير" detail="عرض الفواتير حسب الأحدث أولاً"/><div className="table-toolbar"><label className="search-box sales-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث برقم الفاتورة" data-testid="input-search-sales"/></label><span className="result-count sales-result-count">{fmt(rows.length)} فاتورة</span></div>{sales.isLoading?<StateBlock loading error={false} onRetry={()=>sales.refetch()} empty={false}/>:sales.isError?<StateBlock loading={false} error onRetry={()=>sales.refetch()} empty={false}/>:rows.length?<SalesTable sales={rows} onReturn={canReturn?openReturn:undefined} onPrint={s=>setPrintTarget(s)} onToggleItems={toggleSaleItems} expandedSaleId={detailsSaleId} showAmounts={canViewAmounts} showOrderType={session.data?.storeType==='cafe'||session.data?.storeType==='restaurant'}/>:<div className="empty-inline">لا توجد فواتير تطابق البحث.</div>}</Card>
    {selected&&<Modal title="تسجيل مرتجع" close={closeReturn}><form className="form-grid" onSubmit={submit}>
      <InvoiceReturnPicker invoiceNo={returnInvoiceNo} setInvoiceNo={setReturnInvoiceNo} loadedInvoiceNo={returnLoadedInvoiceNo} setLoadedInvoiceNo={setReturnLoadedInvoiceNo} selectedItems={returnSelectedItems} setSelectedItems={setReturnSelectedItems} testIdPrefix="return"/>
      <label className="field field-wide"><span>سبب الإرجاع</span><input name="reason" required placeholder="اكتب سبب الإرجاع"/></label>
      {ret.isError&&<div className="form-error" role="alert">تعذر تسجيل المرتجع. تحقق من الفاتورة والكميات المحددة.</div>}
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={closeReturn}>إلغاء</button><button className="button button-primary" disabled={ret.isPending||!returnSelectedItems||!Object.keys(returnSelectedItems).length||returnLoadedInvoiceNo!==returnInvoiceNo.trim()}>{ret.isPending?'جارٍ التسجيل…':'تأكيد المرتجع'}</button></div>
    </form></Modal>}
    {printTarget&&<ReceiptModal sale={printTarget} close={()=>setPrintTarget(null)}/>}
    {notice&&<div className="toast-note" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
  </div>;
}
function AuditPage() {
  const logs=useListXStoreAuditLogs();
  return <><PageTitle eyebrow="الشفافية والمساءلة" title="سجل التدقيق" desc="سجل موحد للإجراءات الحساسة — يعرض الفاعل والمتجر والكيان والتفاصيل." action={<button className="button button-quiet" onClick={()=>logs.refetch()}><RefreshCw size={15}/> تحديث السجل</button>}/><Card><SectionHead title="الإجراءات الأخيرة" detail="سجل للقراءة فقط · كل الأوقات بالتوقيت المحلي"/>{logs.isLoading?<StateBlock loading error={false} onRetry={()=>logs.refetch()} empty={false}/>:logs.isError?<StateBlock loading={false} error onRetry={()=>logs.refetch()} empty={false}/>:logs.data?.length?<AuditRows logs={logs.data}/>:<div className="state-box"><div className="empty-symbol"><ScrollText/></div><b>لا توجد إجراءات مسجلة</b><span>ستظهر هنا عمليات الإدارة الحساسة عند تنفيذها.</span></div>}</Card><div className="audit-privacy"><ShieldCheck size={18}/><span><b>سجل موثوق</b><small>هذا العرض للقراءة فقط. لا يمكن تعديل أو حذف السجلات من الواجهة.</small></span></div></>;
}
function AuditRows({logs}:{logs:any[]}) {
  return <div className="audit-list">{logs.map((log:any,i)=><div className="audit-row" key={log.id||i}><span className={`audit-icon audit-icon-${i%4}`}><Activity size={17}/></span><div className="audit-main"><b>{log.action}</b><small>{log.actorName} · {log.tenantName||'المنصة'} · {log.entityType}{log.entityId?` · ${log.entityId}`:''}</small><span>{auditDetailsLabel(log.action,log.details)}</span></div><time>{dateLabel(log.createdAt)}</time></div>)}</div>;
}
function auditDetailsLabel(action:string,details:string) {
  if(action!=='sale.exchange')return details;
  try{
    const payload=JSON.parse(details) as {originalInvoiceNo?:string;returnedItems?:{name:string;quantity:number}[];replacementItems?:{name:string;quantity:number}[];balanceDue?:number};
    const items=(rows:{name:string;quantity:number}[]|undefined)=>rows?.map(item=>`${latinizeDigits(item.name)} × ${fmt(item.quantity)}`).join('، ')||'—';
    const balance=typeof payload.balanceDue==='number'?payload.balanceDue>0?`فرق السعر على العميل ${moneyLabel(payload.balanceDue)}`:payload.balanceDue<0?`مستحق للعميل ${moneyLabel(Math.abs(payload.balanceDue))}`:'لا يوجد فرق سعر':'';
    return [`استبدال الفاتورة ${payload.originalInvoiceNo?latinizeDigits(payload.originalInvoiceNo):'—'}`,`المرتجع: ${items(payload.returnedItems)}`,`البديل: ${items(payload.replacementItems)}`,balance].filter(Boolean).join(' · ');
  }catch{
    return latinizeDigits(details.replace(/^Exchange for /,'استبدال الفاتورة '));
  }
}
function moneyLabel(amount:number) {
  return new Intl.NumberFormat(APP_NUMBER_LOCALE,{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);
}

function Routed() {
  return <ErrorBoundary><Switch><Route path="/" component={HomeRedirect}/><Route path="/contact" component={ContactPage}/><Route path="/menu/:slug" component={PublicRestaurantMenu}/><Route path="/sign-in/*?" component={SignInPage}/><Route path="/sign-up/*?" component={SignUpPage}/><Route path="/dashboard" component={ProtectedLayout}/><Route path="/tenants" component={ProtectedLayout}/><Route path="/subscriptions" component={ProtectedLayout}/><Route path="/offline-license-issuer" component={ProtectedLayout}/><Route path="/team" component={ProtectedLayout}/><Route path="/pos" component={ProtectedLayout}/><Route path="/inventory" component={ProtectedLayout}/><Route path="/reports" component={ProtectedLayout}/><Route path="/sales" component={ProtectedLayout}/><Route path="/audit-log" component={ProtectedLayout}/><Route path="/settings" component={ProtectedLayout}/><Route path="/platform-database" component={ProtectedLayout}/><Route path="/platform-backup" component={ProtectedLayout}/><Route path="/store-backup" component={ProtectedLayout}/><Route path="/restaurant-menu" component={ProtectedLayout}/><Route path="/store-settings" component={ProtectedLayout}/><Route path="/display-settings" component={ProtectedLayout}/><Route path="/poultry-customers" component={ProtectedLayout}/><Route path="/poultry-customer/:customerId" component={ProtectedLayout}/><Route path="/poultry-sales" component={ProtectedLayout}/><Route path="/poultry-sale/:customerId" component={ProtectedLayout}/><Route path="/poultry-collections" component={ProtectedLayout}/><Route path="/poultry-invoices" component={ProtectedLayout}/><Route path="/poultry-invoices/" component={ProtectedLayout}/><Route path="/poultry-farm" component={ProtectedLayout}/><Route component={NotFound}/></Switch></ErrorBoundary>;
}
function App() {
  return <TooltipProvider><QueryClientProvider client={queryClient}><WouterRouter base={basePath}><SiteLayout/></WouterRouter></QueryClientProvider><Toaster/></TooltipProvider>;
}

function SiteLayout() {
  const [location] = useLocation();
  const showSiteFooter = location === '/'
    || location === '/contact'
    || location === '/sign-in'
    || location.startsWith('/sign-in/')
    || location === '/sign-up'
    || location.startsWith('/sign-up/');

  return <div className="site-layout"><div className="site-route"><Routed/></div>{showSiteFooter&&<SiteFooter/>}</div>;
}
export default App;
