import { useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Boxes,
  LayoutDashboard,
  Package,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Wallet,
} from "lucide-react";
import "./_group.css";

type ExchangeEvent = {
  originalInvoiceNo: string;
  exchangeInvoiceNo: string;
  createdAt: string;
  performedBy: string;
  returnedItems: { productId: string; name: string; quantity: number }[];
  replacementItems: { productId: string; name: string; quantity: number }[];
  refundAmount: number | null;
  replacementTotal: number | null;
  balanceDue: number | null;
  detailsAvailable: boolean;
};

type PreviewSale = {
  id: string;
  invoiceNo: string;
  createdAt: string;
  itemCount: number;
  paymentMethod: string;
  status: "completed" | "partially_returned" | "returned";
  total: number;
  exchangeEvents: ExchangeEvent[];
};

const sales: PreviewSale[] = [
  { id: "sale-01", invoiceNo: "XS-20261021-8B2C51", createdAt: "اليوم، ١١:٤٢ ص", itemCount: 4, paymentMethod: "cash", status: "completed", total: 4380, exchangeEvents: [] },
  { id: "sale-02", invoiceNo: "XS-20261021-43A6D2", createdAt: "اليوم، ١٠:٥٨ ص", itemCount: 2, paymentMethod: "card", status: "partially_returned", total: 2125, exchangeEvents: [{
    originalInvoiceNo: "XS-20261021-43A6D2",
    exchangeInvoiceNo: "XS-20261021-58D2C2F",
    createdAt: "اليوم، ١١:١٦ ص",
    performedBy: "مريم أحمد",
    returnedItems: [{ productId: "p-1", name: "تشيرت قطن", quantity: 1 }],
    replacementItems: [{ productId: "p-2", name: "بنطلون كاجوال", quantity: 1 }],
    refundAmount: 320,
    replacementTotal: 350,
    balanceDue: 30,
    detailsAvailable: true,
  }] },
  { id: "sale-03", invoiceNo: "XS-20261021-9D7710", createdAt: "اليوم، ١٠:٣١ ص", itemCount: 3, paymentMethod: "wallet", status: "completed", total: 3490, exchangeEvents: [] },
  { id: "sale-04", invoiceNo: "XS-20261020-C2F091", createdAt: "أمس، ٨:١٢ م", itemCount: 1, paymentMethod: "cash", status: "returned", total: 890, exchangeEvents: [] },
];

const fmt = (value: number) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value);
const money = (value: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(value);
const statusNames = { completed: "مكتملة", partially_returned: "استبدال / إرجاع جزئي", returned: "مسترجعة" };
const paymentName = (method: string) => method === "cash" ? "نقداً" : method === "card" ? "بطاقة" : "محفظة";

function StatCard({ label, value, detail, icon: Icon, tint = "" }: { label: string; value: string; detail: string; icon: typeof ReceiptText; tint?: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon size={19} /></div><span className="stat-label">{label}</span><b className="stat-value">{value}</b><small>{detail}</small></div>;
}

function SalesTable({ rows }: { rows: PreviewSale[] }) {
  const columnCount = 7;
  return <div className="table-wrap"><table>
    <thead><tr><th>رقم الفاتورة</th><th>التاريخ والوقت</th><th>الأصناف</th><th>الدفع</th><th>الإجمالي</th><th>الحالة</th><th>إجراء</th></tr></thead>
    <tbody>{rows.map((sale) => <FragmentSale key={sale.id} sale={sale} columnCount={columnCount} />)}</tbody>
  </table></div>;
}

function FragmentSale({ sale, columnCount }: { sale: PreviewSale; columnCount: number }) {
  return <>
    <tr>
      <td className="ltr-id">{sale.invoiceNo}{sale.exchangeEvents.length > 0 && <span className="sale-exchange-badge"><ArrowLeftRight size={12} /> استبدال</span>}</td>
      <td>{sale.createdAt}</td>
      <td>{fmt(sale.itemCount)}</td>
      <td>{paymentName(sale.paymentMethod)}</td>
      <td><b>{money(sale.total)}</b></td>
      <td><span className={`status-pill status-${sale.status}`}>{statusNames[sale.status]}</span></td>
      <td className="table-actions-cell"><button className="table-action"><Printer size={14} /> إيصال</button><button className="table-action"><RotateCcw size={14} /> مرتجع</button></td>
    </tr>
    {sale.exchangeEvents.map((event, index) => <tr className="sale-exchange-row" key={`${sale.id}-${index}`}><td colSpan={columnCount}>
      <article className="sale-exchange-detail">
        <header>
          <b><ArrowLeftRight size={15} /> عملية استبدال مرتبطة بالفاتورة</b>
          <span>الأصلية: <strong className="ltr-id">{event.originalInvoiceNo}</strong></span>
          <span>فاتورة البديل: <strong className="ltr-id">{event.exchangeInvoiceNo}</strong></span>
          <span>{event.createdAt}</span>
          <span>نفّذ العملية: <strong>{event.performedBy}</strong></span>
        </header>
        {event.detailsAvailable ? <>
          <div className="sale-exchange-items">
            <div><b>الأصناف المرتجعة</b><ul>{event.returnedItems.map((item) => <li key={item.productId}>{item.name} <span>× {fmt(item.quantity)}</span></li>)}</ul></div>
            <div><b>الأصناف البديلة</b><ul>{event.replacementItems.map((item) => <li key={item.productId}>{item.name} <span>× {fmt(item.quantity)}</span></li>)}</ul></div>
          </div>
          <div className="sale-exchange-amounts">
            <span>قيمة المرتجع: <b>{event.refundAmount === null ? "—" : money(event.refundAmount)}</b></span>
            <span>قيمة البديل: <b>{event.replacementTotal === null ? "—" : money(event.replacementTotal)}</b></span>
            <strong className={event.balanceDue === null ? "" : event.balanceDue > 0 ? "exchange-due" : "exchange-refund"}>
              {event.balanceDue === null ? "فرق السعر غير متوفر" : event.balanceDue > 0 ? `على العميل ${money(event.balanceDue)}` : event.balanceDue < 0 ? `مستحق للعميل ${money(Math.abs(event.balanceDue))}؛ يُرد من المتجر` : "لا يوجد فرق سعر"}
            </strong>
          </div>
        </> : <p>الاستبدال مسجّل، لكن التفاصيل غير متوفرة.</p>}
      </article>
    </td></tr>)}
  </>;
}

function PreviewPage({ refreshed }: { refreshed: boolean }) {
  const [search, setSearch] = useState("");
  const rows = sales.filter((sale) => sale.invoiceNo.toLowerCase().includes(search.toLowerCase()));
  const rootClass = refreshed ? "sales-preview sales-refresh" : "sales-preview sales-current";

  return <div className={rootClass} dir="rtl">
    <aside className="sales-preview-sidebar">
      <div className="preview-brand"><span className="preview-brand-mark">X</span><span>X-Store</span></div>
      <div className="preview-store-label">متجر الملابس</div>
      <div className="preview-nav-label">القائمة الرئيسية</div>
      <div className="preview-nav-item"><LayoutDashboard size={17} /> الرئيسية</div>
      <div className="preview-nav-item active"><ReceiptText size={17} /> المبيعات</div>
      <div className="preview-nav-item"><Package size={17} /> المنتجات والمخزون</div>
      <div className="preview-nav-item"><Boxes size={17} /> التقارير</div>
      <div className="preview-nav-item"><Settings2 size={17} /> الإعدادات</div>
      <div className="preview-sidebar-footer"><span className="preview-avatar">م</span><span>مريم أحمد</span></div>
    </aside>
    <div className="sales-preview-workspace">
      <header className="preview-topbar"><div className="preview-breadcrumbs"><span>المتجر</span><span>‹</span><b>المبيعات</b></div><div className="preview-profile"><span className="preview-avatar">م</span><span>مريم أحمد</span></div></header>
      <main className="main-content"><section className="sales-page">
        <div className="page-title">
          <div><div className="eyebrow">حركة المتجر</div><h1>المبيعات</h1><p>الفواتير الأخيرة وطرق الدفع والمرتجعات المسجلة.</p></div>
          <div className="page-action"><button className="button"><RefreshCw size={15} /> تحديث القائمة</button></div>
        </div>
        <div className="stat-grid">
          <StatCard label="عمليات ظاهرة" value={fmt(sales.length)} detail="آخر ١٠٠ فاتورة" icon={ReceiptText} />
          <StatCard label="إجمالي المبيعات" value={money(sales.reduce((sum, sale) => sum + sale.total, 0))} detail="حسب القائمة المحمّلة" icon={Banknote} tint="tint-gold" />
          <StatCard label="نقداً" value={fmt(sales.filter((sale) => sale.paymentMethod === "cash").length)} detail="عمليات نقدية" icon={Wallet} tint="tint-sage" />
          <StatCard label="مرتجعة" value={fmt(sales.filter((sale) => sale.status !== "completed").length)} detail="تتضمن استرداداً" icon={RotateCcw} tint="tint-red" />
        </div>
        <section className="panel sales-invoice-panel">
          <div className="section-head"><div><h2>سجل الفواتير</h2><span>عرض الفواتير حسب الأحدث أولاً</span></div></div>
          <div className="table-toolbar">
            <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث برقم الفاتورة" /></label>
            <span className="result-count">{fmt(rows.length)} فاتورة</span>
          </div>
          <SalesTable rows={rows} />
        </section>
      </section></main>
    </div>
  </div>;
}

export function Current() { return <PreviewPage refreshed={false} />; }
export function Refreshed() { return <PreviewPage refreshed />; }
