import { useEffect, useState } from 'react';
import { Activity, Banknote, Boxes, ReceiptText, RefreshCw, Users, Wallet } from 'lucide-react';

type PoultryReport = {
  from: string;
  to: string;
  invoiceCount: number;
  customerCount: number;
  sales: number;
  collections: number;
  outstanding: number;
  totalKg: number;
  averageInvoice: number;
};

const fmt = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(Number(value) || 0);
const money = (value: number) => fmt(value) + ' ج.م';

export default function PoultryReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + '-01');
  const [to, setTo] = useState(today);
  const [data, setData] = useState<PoultryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/xstore/poultry/reports/financial?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'تعذر تحميل التقرير المالي.');
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل التقرير المالي.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [from, to]);

  return <div dir="rtl">
    <div className="page-title">
      <div>
        <div className="eyebrow">الأداء المالي · الدواجن</div>
        <h1>التقارير المالية</h1>
        <p>تقرير مستقل لنظام الدواجن يعتمد على فواتير الدواجن والتحصيلات الخاصة بمتجرك فقط.</p>
      </div>
      <button className="button button-quiet" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> تحديث التقرير</button>
    </div>

    <section className="panel report-panel">
      <div className="report-filters" dir="rtl">
        <label className="field"><span>من تاريخ</span><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}/></label>
        <label className="field"><span>إلى تاريخ</span><input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}/></label>
        <span className="report-period">{data ? data.from + ' — ' + data.to : 'اختر فترة التقرير'}</span>
      </div>

      {loading ? <div className="stat-grid">{[1,2,3,4,5].map(i => <div className="stat-card stat-skeleton" key={i}/>)}</div> :
       error ? <div className="state-box error-state"><b>تعذر تحميل البيانات</b><span>{error}</span><button className="button button-quiet" onClick={() => void load()}>إعادة المحاولة</button></div> :
       data ? <>
         <div className="stat-grid report-stats">
           <div className="stat-card"><div className="stat-icon tint-green"><ReceiptText size={19}/></div><span className="stat-label">عدد الفواتير</span><b className="stat-value">{fmt(data.invoiceCount)}</b><small>الفواتير خلال الفترة</small></div>
           <div className="stat-card"><div className="stat-icon tint-gold"><Banknote size={19}/></div><span className="stat-label">إجمالي المبيعات</span><b className="stat-value">{money(data.sales)}</b><small>قيمة فواتير الدواجن</small></div>
           <div className="stat-card"><div className="stat-icon tint-sage"><Wallet size={19}/></div><span className="stat-label">إجمالي التحصيلات</span><b className="stat-value">{money(data.collections)}</b><small>المدفوع على الفواتير + التحصيل</small></div>
           <div className="stat-card"><div className="stat-icon tint-red"><Activity size={19}/></div><span className="stat-label">المتبقي</span><b className="stat-value">{money(data.outstanding)}</b><small>الفرق بين المبيعات والتحصيلات</small></div>
           <div className="stat-card"><div className="stat-icon tint-sage"><Boxes size={19}/></div><span className="stat-label">إجمالي الكمية</span><b className="stat-value">{fmt(data.totalKg)} كجم</b><small>إجمالي أوزان الفواتير</small></div>
         </div>
         <div className="report-profit"><span><Users size={18}/> العملاء والفاتورة المتوسطة</span><strong>{fmt(data.customerCount)} عميل · {money(data.averageInvoice)}</strong></div>
         <p className="report-disclaimer">التقرير خاص بنظام الدواجن. لا يتم خلطه مع مبيعات أو مخزون أو تقارير أنظمة المتاجر الأخرى.</p>
       </> : null}
    </section>
  </div>;
}
