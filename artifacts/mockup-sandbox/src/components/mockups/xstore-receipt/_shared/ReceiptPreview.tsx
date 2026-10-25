import { Banknote, Check, CircleCheck, Printer } from "lucide-react";

type PreviewVariant = "current" | "refined";

const items = [
  { name: "ساعة ذكية Active 3", sku: "W-042", quantity: 1, unitPrice: 1450 },
  { name: "كابل USB-C سريع", sku: "C-108", quantity: 2, unitPrice: 185 },
  { name: "شاحن سريع 30W", sku: "CH-030", quantity: 1, unitPrice: 620 },
];

const money = (amount: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(amount);

const fmt = (amount: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(amount);

function ItemsTable({ refined = false }: { refined?: boolean }) {
  return (
    <table className="receipt-preview-table">
      <thead>
        <tr>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.sku}>
            <td>
              <b>{item.name}</b>
              <small>{item.sku}</small>
            </td>
            <td>{fmt(item.quantity)}</td>
            <td>{money(item.unitPrice)}</td>
            <td>
              <b>{money(item.unitPrice * item.quantity)}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Actions({ refined = false }: { refined?: boolean }) {
  return (
    <div className={refined ? "receipt-refined-actions" : "receipt-preview-actions"}>
      <button>إغلاق</button>
      <button>إرسال عبر واتساب</button>
      <button>طباعة الإيصال</button>
    </div>
  );
}

function CurrentReceipt() {
  return (
    <div className="receipt-preview-card">
      <img
        className="receipt-current-watermark"
        src="/__mockup/images/x-store-mark.png"
        alt=""
      />
      <div className="receipt-current-content">
        <div className="receipt-current-header">
          <b>متجر النخبة</b>
          <span>إيصال بيع</span>
        </div>
        <div className="receipt-current-number">
          <span>رقم الفاتورة</span>
          <b dir="ltr">XS-20261025-8A43F1</b>
        </div>
        <div className="receipt-current-detail">
          <span>الحالة</span>
          <b>مدفوعة</b>
        </div>
        <div className="receipt-current-detail">
          <span>اسم العميل</span>
          <b>محمد عبد الرحمن</b>
        </div>
        <div className="receipt-current-detail">
          <span>الحساب المنفذ</span>
          <b>أحمد حسن</b>
        </div>
        <div className="receipt-current-detail">
          <span>التاريخ والوقت</span>
          <b>٢٥ أكتوبر ٢٠٢٦، ٢:٣٥ م</b>
        </div>
        <div className="receipt-current-detail">
          <span>رقم هاتف العميل</span>
          <b dir="ltr">+20 100 555 0190</b>
        </div>
        <div className="receipt-current-detail">
          <span>عدد الأصناف</span>
          <b>٤</b>
        </div>
        <div className="receipt-current-detail">
          <span>طريقة الدفع</span>
          <b>نقداً</b>
        </div>
        <div className="receipt-current-divider" />
        <div className="receipt-current-heading">الأصناف المباعة</div>
        <ItemsTable />
        <div className="receipt-current-divider" />
        <div className="receipt-current-detail">
          <span>المجموع الفرعي</span>
          <b>{money(2440)}</b>
        </div>
        <div className="receipt-current-detail">
          <span>الخصم</span>
          <b>{money(100)}</b>
        </div>
        <div className="receipt-current-detail">
          <span>الضريبة</span>
          <b>{money(327.6)}</b>
        </div>
        <div className="receipt-current-grand">
          <span>الإجمالي</span>
          <b>{money(2667.6)}</b>
        </div>
        <div className="receipt-current-detail">
          <span>المبلغ المستلم</span>
          <b>{money(2700)}</b>
        </div>
        <div className="receipt-current-detail">
          <span>الباقي</span>
          <b>{money(32.4)}</b>
        </div>
        <Actions />
      </div>
    </div>
  );
}

function RefinedReceipt() {
  return (
    <div className="receipt-preview-card receipt-refined-card">
      <header className="receipt-refined-top">
        <span className="receipt-success-mark">
          <CircleCheck size={25} />
        </span>
        <div className="receipt-refined-title">
          <small>تمت عملية البيع بنجاح</small>
          <h2>متجر النخبة</h2>
          <span>إيصال بيع</span>
        </div>
        <div className="receipt-refined-amount">
          <small>إجمالي الفاتورة</small>
          <strong>{money(2667.6)}</strong>
        </div>
      </header>

      <div className="receipt-refined-body">
        <div className="receipt-success-row">
          <span className="receipt-paid-status">
            <Check size={14} />
            تم الدفع نقداً
          </span>
          <span className="receipt-refined-invoice">
            رقم الفاتورة
            <b>XS-20261025-8A43F1</b>
          </span>
        </div>

        <div className="receipt-refined-meta">
          <div className="receipt-meta-item">
            <span>العميل</span>
            <b>محمد عبد الرحمن</b>
          </div>
          <div className="receipt-meta-item">
            <span>رقم الهاتف</span>
            <b className="receipt-ltr">+20 100 555 0190</b>
          </div>
          <div className="receipt-meta-item">
            <span>تاريخ ووقت البيع</span>
            <b>٢٥ أكتوبر ٢٠٢٦، ٢:٣٥ م</b>
          </div>
          <div className="receipt-meta-item">
            <span>نفّذ البيع</span>
            <b>أحمد حسن</b>
          </div>
          <div className="receipt-meta-item">
            <span>عدد الوحدات</span>
            <b>٤ وحدات · ٣ أصناف</b>
          </div>
          <div className="receipt-meta-item">
            <span>طريقة الدفع</span>
            <b>
              <Banknote size={13} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
              نقداً
            </b>
          </div>
        </div>

        <section className="receipt-refined-items">
          <div className="receipt-refined-items-title">
            <span>تفاصيل الأصناف</span>
            <small>٣ أصناف · ٤ وحدات</small>
          </div>
          <ItemsTable refined />
        </section>

        <div className="receipt-refined-summary">
          <div className="receipt-payment-details">
            <div className="receipt-summary-line">
              <span>المبلغ المستلم</span>
              <b>{money(2700)}</b>
            </div>
            <div className="receipt-summary-line">
              <span>الباقي للعميل</span>
              <b>{money(32.4)}</b>
            </div>
            <div className="receipt-summary-line">
              <span>حالة الدفع</span>
              <b>مكتملة</b>
            </div>
          </div>

          <div className="receipt-total-panel">
            <div className="receipt-summary-line">
              <span>المجموع الفرعي</span>
              <b>{money(2440)}</b>
            </div>
            <div className="receipt-summary-line discount">
              <span>الخصم</span>
              <b>− {money(100)}</b>
            </div>
            <div className="receipt-summary-line">
              <span>الضريبة</span>
              <b>{money(327.6)}</b>
            </div>
            <div className="receipt-summary-line receipt-total-amount">
              <span>الإجمالي</span>
              <b>{money(2667.6)}</b>
            </div>
          </div>
        </div>

        <p className="receipt-thanks-refined">شكراً لزيارتكم، نتمنى لكم يوماً سعيداً</p>
        <Actions refined />
      </div>
    </div>
  );
}

export function ReceiptPreview({ variant }: { variant: PreviewVariant }) {
  return (
    <main className="receipt-preview-scene">
      <div className="receipt-preview-backdrop">
        {variant === "current" ? <CurrentReceipt /> : <RefinedReceipt />}
      </div>
    </main>
  );
}
