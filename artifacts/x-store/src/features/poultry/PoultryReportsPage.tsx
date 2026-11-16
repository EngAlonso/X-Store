import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshCw, ReceiptText, Banknote, Wallet, Scale, Users, CircleDollarSign } from 'lucide-react';
import { poultryApi, type PoultryFinancialReport } from './poultryApi';

const fmt = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(Number(value) || 0);
const money = (value: number) => `${fmt(value)} ج.م`;

export default function PoultryReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<PoultryFinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setData(await poultryApi.financialReport(from, to)); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل التقرير المالي.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [from, to]);
  const periodLabel = useMemo(() => data ? `${data.from} — ${data.to}` : '', [data]);

  return <div className="poultry-report-page" dir="rtl">
    <div className="poultry-report-head"><div><span className="poultry-report-eyebrow">نظام الدواجن</span><h1>التقارير المالية</h1><p>تقرير مستقل لمبيعات وتحصلات ومتوسطات متجر الدواجن فقط.</p></div><button className="poultry-report-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> تحديث التقرير</button></div>
    <div className="poultry-report-filters"><label><span>من تاريخ</span><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label><label><span>إلى تاريخ</span><input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} /></label><div className="poultry-report-period">{periodLabel || 'اختر الفترة'}</div></div>
    {loading ? <div className="poultry-report-loading">جارٍ تحميل التقرير…</div> : error ? <div className="poultry-report-error"><b>تعذر تحميل التقرير</b><span>{error}</span><button onClick={() => void load()}>إعادة المحاولة</button></div> : data ? <>
      <div className="poultry-report-stats">
        <ReportStat icon={<ReceiptText size={19}/>} label="عدد الفواتير" value={fmt(data.invoiceCount)} detail="فواتير خلال الفترة" />
        <ReportStat icon={<Banknote size={19}/>} label="إجمالي المبيعات" value={money(data.totalSales)} detail="قيمة الفواتير" />
        <ReportStat icon={<Wallet size={19}/>} label="إجمالي التحصيلات" value={money(data.totalCollected)} detail="المدفوعات المسجلة" />
        <ReportStat icon={<Scale size={19}/>} label="المتبقي" value={money(data.outstanding)} detail="مبيعات ناقص التحصيلات" />
        <ReportStat icon={<Users size={19}/>} label="العملاء" value={fmt(data.customerCount)} detail="عملاء لديهم فواتير بالفترة" />
        <ReportStat icon={<CircleDollarSign size={19}/>} label="متوسط الفاتورة" value={money(data.averageInvoice)} detail="متوسط قيمة الفاتورة" />
      </div>
      <div className="poultry-report-secondary"><div><span>إجمالي الوزن</span><strong>{fmt(data.totalKg)} كجم</strong></div><div><span>الفترة</span><strong>{data.from} إلى {data.to}</strong></div></div>
    </> : null}
  </div>;
}
function ReportStat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="poultry-report-stat"><span className="poultry-report-stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></div>;
}
