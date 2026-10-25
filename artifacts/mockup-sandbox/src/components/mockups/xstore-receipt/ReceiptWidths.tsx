import "./_group.css";

const items = [
  { name: "ساعة ذكية Active 3", sku: "W-042", quantity: 1, price: 1450 },
  { name: "كابل USB-C سريع", sku: "C-108", quantity: 2, price: 185 },
  { name: "شاحن سريع 30W", sku: "CH-030", quantity: 1, price: 620 },
];

const invoice = "XS-20261025-8A43F1";
const amount = {
  subtotal: 2440,
  discount: 100,
  tax: 327.6,
  total: 2667.6,
  received: 2667.6,
  change: 0,
};

const fmt = (value: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value);

const money = (value: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);

function Watermark() {
  return (
    <img
      className="rw-watermark"
      src="/__mockup/images/x-store-receipt-watermark.jpeg"
      alt=""
      aria-hidden="true"
    />
  );
}

function ReceiptHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`rw-shop-header${compact ? " rw-shop-header--compact" : ""}`}>
      <span className="rw-brand-mark" aria-hidden="true">X</span>
      <div>
        <h2>متجر النخبة</h2>
        <p>إيصال بيع · القاهرة</p>
      </div>
      {!compact && <span className="rw-header-caption">نسخة العميل</span>}
    </header>
  );
}

function ReceiptMeta({ thermal = false }: { thermal?: boolean }) {
  return (
    <section className={`rw-meta${thermal ? " rw-meta--thermal" : ""}`} aria-label="بيانات الفاتورة">
      <div className="rw-meta-invoice">
        <span>رقم الفاتورة</span>
        <b dir="ltr">{invoice}</b>
      </div>
      <div className="rw-status"><i /> مدفوعة · تحويل بنكي</div>
      <div className="rw-meta-pair">
        <span>العميل</span><b>محمد عبد الرحمن</b>
      </div>
      <div className="rw-meta-pair">
        <span>الهاتف</span><b className="rw-ltr" dir="ltr">+20 100 555 0190</b>
      </div>
      <div className="rw-meta-pair">
        <span>التاريخ والوقت</span><b>٢٥ أكتوبر ٢٠٢٦، ٢:٣٥ م</b>
      </div>
      <div className="rw-meta-pair">
        <span>الحساب المنفذ</span><b>أحمد حسن</b>
      </div>
      <div className="rw-meta-pair">
        <span>طريقة الدفع</span><b>تحويل بنكي</b>
      </div>
      <div className="rw-meta-pair rw-transfer">
        <span>التحويل من</span><b>محمود إبراهيم</b>
      </div>
    </section>
  );
}

function WideItems() {
  return (
    <table className="rw-wide-table">
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
            <td><b>{item.name}</b><small dir="ltr">{item.sku}</small></td>
            <td>{fmt(item.quantity)}</td>
            <td>{money(item.price)}</td>
            <td><b>{money(item.price * item.quantity)}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ThermalItems({ narrow = false }: { narrow?: boolean }) {
  return (
    <section className={`rw-thermal-items${narrow ? " rw-thermal-items--narrow" : ""}`}>
      {items.map((item, index) => (
        <article className="rw-thermal-item" key={item.sku}>
          <div className="rw-item-title">
            <b>{item.name}</b>
            <small dir="ltr">{item.sku}</small>
          </div>
          <div className="rw-item-math">
            <span>{fmt(item.quantity)} × {money(item.price)}</span>
            <b>{money(item.price * item.quantity)}</b>
          </div>
          {index < items.length - 1 && <span className="rw-item-rule" />}
        </article>
      ))}
    </section>
  );
}

function Summary({ thermal = false }: { thermal?: boolean }) {
  return (
    <section className={`rw-summary${thermal ? " rw-summary--thermal" : ""}`}>
      <div className="rw-summary-lines">
        <div><span>المجموع الفرعي</span><b>{money(amount.subtotal)}</b></div>
        <div className="rw-discount"><span>الخصم</span><b>− {money(amount.discount)}</b></div>
        <div><span>الضريبة</span><b>{money(amount.tax)}</b></div>
      </div>
      <div className="rw-total">
        <span>الإجمالي</span>
        <b>{money(amount.total)}</b>
      </div>
      <div className="rw-paid">
        <div><span>المبلغ المستلم</span><b>{money(amount.received)}</b></div>
        <div><span>الباقي للعميل</span><b>{money(amount.change)}</b></div>
      </div>
    </section>
  );
}

function ReceiptFooter() {
  return (
    <footer className="rw-footer">
      <strong>شكراً لزيارتكم</strong>
      <span>نتمنى لكم يوماً سعيداً</span>
    </footer>
  );
}

function WideReceipt() {
  return (
    <article className="rw-paper rw-paper--wide" dir="rtl">
      <Watermark />
      <ReceiptHeader />
      <div className="rw-wide-sale">
        <div className="rw-wide-state"><span>حالة العملية</span><b>مكتملة</b></div>
        <span>٤ وحدات · ٣ أصناف</span>
      </div>
      <ReceiptMeta />
      <section className="rw-wide-lines">
        <div className="rw-section-heading"><b>تفاصيل الأصناف</b><span>٣ أصناف · ٤ وحدات</span></div>
        <WideItems />
      </section>
      <Summary />
      <ReceiptFooter />
    </article>
  );
}

function ThermalReceipt({ narrow = false }: { narrow?: boolean }) {
  return (
    <article className={`rw-paper rw-paper--thermal${narrow ? " rw-paper--58" : " rw-paper--80"}`} dir="rtl">
      <Watermark />
      <ReceiptHeader compact />
      <div className="rw-thermal-kind">إيصال بيع <span>●</span> مدفوعة</div>
      <div className="rw-thermal-invoice">
        <span>رقم الفاتورة</span>
        <b dir="ltr">{invoice}</b>
      </div>
      <ReceiptMeta thermal />
      <section className="rw-thermal-lines">
        <div className="rw-thermal-heading"><b>الأصناف</b><span>٣ أصناف / ٤ وحدات</span></div>
        <ThermalItems narrow={narrow} />
      </section>
      <Summary thermal />
      <ReceiptFooter />
    </article>
  );
}

export function ReceiptWidths() {
  return (
    <main className="rw-scene" dir="rtl">
      <style>{`
        .rw-scene, .rw-scene * { box-sizing: border-box; }
        .rw-scene {
          --rw-ink: #294232;
          --rw-green: #174a2d;
          --rw-muted: #79877c;
          --rw-rule: #dfe7dc;
          min-height: 100dvh;
          padding: 30px clamp(16px, 3vw, 44px) 48px;
          color: var(--rw-ink);
          background:
            radial-gradient(ellipse at 12% 0%, rgba(220, 234, 218, .82), transparent 34%),
            #eef2eb;
          font-family: var(--app-font-sans);
        }
        .rw-board { width: min(100%, 1320px); margin: 0 auto; }
        .rw-intro {
          display: flex; align-items: end; justify-content: space-between; gap: 20px;
          margin: 0 0 23px; padding: 0 2px;
        }
        .rw-kicker {
          display: flex; align-items: center; gap: 8px; margin-bottom: 7px;
          color: #66806b; font-size: 10px; font-weight: 700; letter-spacing: .08em;
        }
        .rw-kicker::before { width: 20px; height: 1px; content: ""; background: #75947a; }
        .rw-intro h1 {
          margin: 0; color: #213b2a; font-size: clamp(22px, 2.2vw, 30px);
          font-weight: 700; letter-spacing: -.035em; line-height: 1.3;
        }
        .rw-intro p { margin: 5px 0 0; color: #78857b; font-size: 12px; }
        .rw-board-note {
          display: flex; align-items: center; gap: 9px; padding: 9px 12px;
          border: 1px solid #dbe5d8; border-radius: 9px; color: #56705b;
          background: rgba(249, 251, 246, .72); font-size: 10px; white-space: nowrap;
        }
        .rw-board-note b { color: #28603c; font-size: 12px; }
        .rw-width-grid {
          display: grid; grid-template-columns: minmax(360px, 1.72fr) minmax(280px, 1fr) minmax(220px, .78fr);
          align-items: start; gap: 16px;
        }
        .rw-format { min-width: 0; }
        .rw-format-label {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          min-height: 34px; margin-bottom: 9px; padding: 0 2px;
        }
        .rw-format-label strong { color: #345640; font-size: 12px; }
        .rw-format-label span {
          padding: 4px 8px; border: 1px solid #dce5d9; border-radius: 999px;
          color: #6c7d70; background: #f5f8f2; font: 500 10px var(--app-font-mono);
          direction: ltr; white-space: nowrap;
        }
        .rw-paper {
          position: relative; isolation: isolate; overflow: hidden;
          border: 1px solid #e1e8de; background: #fffefa;
          box-shadow: 0 14px 34px rgba(37, 57, 39, .11), 0 2px 5px rgba(37, 57, 39, .05);
        }
        .rw-paper > :not(.rw-watermark) { position: relative; z-index: 1; }
        .rw-paper--wide { padding: 20px 21px 16px; border-radius: 13px; }
        .rw-paper--thermal {
          min-height: 776px; padding: 18px 17px 16px; border-radius: 8px;
          background-color: #fffefa;
        }
        .rw-paper--80 { padding-inline: 17px; }
        .rw-paper--58 { padding-inline: 13px; }
        .rw-watermark {
          position: absolute; z-index: 0; top: 46%; left: 50%; width: 64%;
          aspect-ratio: 1; object-fit: contain; opacity: .045; mix-blend-mode: multiply;
          transform: translate(-50%, -50%); pointer-events: none;
        }
        .rw-shop-header {
          display: flex; align-items: center; gap: 11px; min-height: 49px;
          padding-bottom: 13px; border-bottom: 1px solid var(--rw-rule);
        }
        .rw-brand-mark {
          display: grid; place-items: center; flex: 0 0 auto; width: 34px; height: 34px;
          border-radius: 10px; color: #f5f8ef; background: #174a2d;
          font: 700 19px var(--app-font-mono); direction: ltr;
        }
        .rw-shop-header h2 { margin: 0; color: #19482c; font-size: 15px; line-height: 1.35; }
        .rw-shop-header p { margin: 2px 0 0; color: #7f8b80; font-size: 9px; }
        .rw-header-caption {
          margin-inline-start: auto; padding: 5px 8px; border: 1px solid #e3e9df;
          border-radius: 6px; color: #718073; font-size: 9px;
        }
        .rw-wide-sale {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 0 10px; color: #7b877d; font-size: 10px;
        }
        .rw-wide-state { display: flex; align-items: center; gap: 9px; }
        .rw-wide-state b { color: #287347; font-size: 10px; }
        .rw-meta {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px;
          padding: 10px; border: 1px solid #e7ece4; border-radius: 9px; background: #fafbf7;
        }
        .rw-meta-invoice {
          display: flex; flex-direction: column; gap: 4px; grid-column: span 2;
          min-width: 0; padding-bottom: 6px; border-bottom: 1px dashed #dce5da;
        }
        .rw-meta-invoice span, .rw-meta-pair span { color: #879287; font-size: 8px; }
        .rw-meta-invoice b {
          overflow: hidden; color: #314638; font: 600 10px var(--app-font-mono);
          text-overflow: ellipsis; white-space: nowrap;
        }
        .rw-status {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          align-self: start; min-height: 24px; padding: 4px 7px;
          border: 1px solid #d8e8d7; border-radius: 999px; color: #347248;
          background: #f0f7ed; font-size: 8px; font-weight: 700; white-space: nowrap;
        }
        .rw-status i { width: 5px; height: 5px; border-radius: 50%; background: #4d8b5e; }
        .rw-meta-pair { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .rw-meta-pair b {
          overflow-wrap: anywhere; color: #425448; font-size: 9px; font-weight: 600; line-height: 1.4;
        }
        .rw-meta-pair .rw-ltr { text-align: right; font-family: var(--app-font-mono); white-space: nowrap; }
        .rw-transfer { grid-column: span 1; }
        .rw-wide-lines { margin-top: 15px; }
        .rw-section-heading, .rw-thermal-heading {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          margin-bottom: 5px; color: #354c3b; font-size: 10px;
        }
        .rw-section-heading span, .rw-thermal-heading span { color: #849086; font-size: 8px; font-weight: 500; }
        .rw-wide-table { width: 100%; table-layout: fixed; border-collapse: collapse; color: #49594d; font-size: 9px; }
        .rw-wide-table th, .rw-wide-table td { padding: 8px 5px; border-bottom: 1px solid #edf0e9; text-align: right; vertical-align: top; }
        .rw-wide-table th { color: #849086; font-size: 8px; font-weight: 600; }
        .rw-wide-table th:first-child { width: 37%; }
        .rw-wide-table th:nth-child(2) { width: 12%; }
        .rw-wide-table th:nth-child(3), .rw-wide-table th:nth-child(4) { width: 25.5%; }
        .rw-wide-table td:first-child b, .rw-wide-table td:first-child small { display: block; }
        .rw-wide-table td:first-child b { color: #374b3d; font-size: 9px; }
        .rw-wide-table td:first-child small { margin-top: 3px; color: #879187; font: 8px var(--app-font-mono); }
        .rw-wide-table td:nth-child(n+2) { white-space: nowrap; font-variant-numeric: tabular-nums; }
        .rw-wide-table td:last-child b { color: #244b2e; }
        .rw-summary { margin-top: 12px; }
        .rw-summary-lines { display: grid; gap: 7px; }
        .rw-summary-lines > div, .rw-paid > div {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          color: #77847a; font-size: 9px;
        }
        .rw-summary-lines b, .rw-paid b { color: #46584b; font-size: 9px; font-weight: 600; white-space: nowrap; }
        .rw-summary-lines .rw-discount b { color: #9c624e; }
        .rw-total {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          margin-top: 9px; padding: 9px 11px; border: 1px solid #dce9d9; border-radius: 8px;
          color: #315b3b; background: #f2f7ef; font-size: 11px; font-weight: 700;
        }
        .rw-total b { color: #1c6039; font: 700 17px var(--app-font-mono); white-space: nowrap; }
        .rw-paid { display: grid; gap: 6px; padding: 9px 2px 0; }
        .rw-footer {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          margin-top: 13px; padding-top: 10px; border-top: 1px dashed #dce5da;
          color: #718174; text-align: center;
        }
        .rw-footer strong { color: #42644b; font-size: 10px; }
        .rw-footer span { font-size: 8px; }
        .rw-shop-header--compact {
          flex-direction: column; justify-content: center; gap: 6px;
          min-height: 0; padding-bottom: 11px; text-align: center;
        }
        .rw-shop-header--compact .rw-brand-mark { width: 30px; height: 30px; border-radius: 50%; font-size: 17px; }
        .rw-shop-header--compact h2 { font-size: 14px; }
        .rw-shop-header--compact p { font-size: 8px; }
        .rw-thermal-kind {
          padding: 8px 0; border-bottom: 1px dashed #cdd7cc; color: #526759;
          font-size: 9px; font-weight: 600; text-align: center;
        }
        .rw-thermal-kind span { margin-inline: 5px; color: #559066; font-size: 5px; vertical-align: middle; }
        .rw-thermal-invoice {
          display: flex; flex-direction: column; gap: 4px; padding: 9px 0 8px;
          border-bottom: 1px dashed #cdd7cc; text-align: center;
        }
        .rw-thermal-invoice span { color: #7d897f; font-size: 8px; }
        .rw-thermal-invoice b { color: #334a39; font: 600 10px var(--app-font-mono); }
        .rw-meta--thermal {
          grid-template-columns: 1fr 1fr; gap: 7px 8px; padding: 9px 0;
          border: 0; border-bottom: 1px dashed #cdd7cc; border-radius: 0; background: transparent;
        }
        .rw-meta--thermal .rw-meta-invoice { display: none; }
        .rw-meta--thermal .rw-status {
          grid-column: 1 / -1; justify-self: center; min-height: 21px;
          padding: 3px 8px; font-size: 8px;
        }
        .rw-meta--thermal .rw-meta-pair { gap: 2px; }
        .rw-meta--thermal .rw-meta-pair span { font-size: 7px; }
        .rw-meta--thermal .rw-meta-pair b { font-size: 8px; line-height: 1.4; }
        .rw-meta--thermal .rw-meta-pair .rw-ltr { font-size: 8px; }
        .rw-meta--thermal .rw-transfer { grid-column: 1 / -1; }
        .rw-thermal-lines { margin-top: 11px; }
        .rw-thermal-heading { margin-bottom: 7px; font-size: 9px; }
        .rw-thermal-items { border-top: 1px solid #e3e9e1; }
        .rw-thermal-item { position: relative; padding: 8px 0 7px; border-bottom: 1px dashed #d9e1d7; }
        .rw-item-title { display: flex; align-items: start; justify-content: space-between; gap: 6px; }
        .rw-item-title b { color: #35483a; font-size: 9px; line-height: 1.45; }
        .rw-item-title small { color: #7d897f; font: 8px var(--app-font-mono); white-space: nowrap; }
        .rw-item-math { display: flex; align-items: center; justify-content: space-between; gap: 7px; margin-top: 4px; }
        .rw-item-math span { color: #7c887e; font-size: 8px; }
        .rw-item-math b { color: #2e5038; font-size: 9px; font-weight: 700; white-space: nowrap; }
        .rw-item-rule { display: none; }
        .rw-summary--thermal { margin-top: 10px; }
        .rw-summary--thermal .rw-summary-lines { gap: 6px; }
        .rw-summary--thermal .rw-summary-lines > div, .rw-summary--thermal .rw-paid > div { font-size: 8px; }
        .rw-summary--thermal .rw-summary-lines b, .rw-summary--thermal .rw-paid b { font-size: 8px; }
        .rw-summary--thermal .rw-total {
          margin-top: 8px; padding: 8px 0; border: 0; border-top: 1px solid #293d2e;
          border-bottom: 2px solid #293d2e; border-radius: 0; color: #2d4533; background: transparent;
          font-size: 10px;
        }
        .rw-summary--thermal .rw-total b { color: #193f27; font-size: 17px; }
        .rw-summary--thermal .rw-paid { gap: 5px; padding: 8px 0 0; }
        .rw-summary--thermal .rw-footer { margin-top: 12px; padding-top: 9px; }
        .rw-paper--58 { padding-inline: 12px; }
        .rw-paper--58 .rw-shop-header--compact { padding-bottom: 9px; }
        .rw-paper--58 .rw-shop-header--compact .rw-brand-mark { width: 26px; height: 26px; font-size: 15px; }
        .rw-paper--58 .rw-shop-header--compact h2 { font-size: 12px; }
        .rw-paper--58 .rw-shop-header--compact p { font-size: 7px; }
        .rw-paper--58 .rw-thermal-kind { font-size: 8px; }
        .rw-paper--58 .rw-thermal-invoice b { font-size: 9px; }
        .rw-paper--58 .rw-meta--thermal { gap: 6px 5px; }
        .rw-paper--58 .rw-meta--thermal .rw-meta-pair span { font-size: 7px; }
        .rw-paper--58 .rw-meta--thermal .rw-meta-pair b,
        .rw-paper--58 .rw-meta--thermal .rw-meta-pair .rw-ltr { font-size: 7.5px; }
        .rw-paper--58 .rw-item-title { display: block; }
        .rw-paper--58 .rw-item-title b { display: block; font-size: 8px; }
        .rw-paper--58 .rw-item-title small { display: block; margin-top: 2px; font-size: 7px; }
        .rw-paper--58 .rw-item-math { align-items: flex-start; flex-direction: column; gap: 3px; }
        .rw-paper--58 .rw-item-math span { font-size: 7px; }
        .rw-paper--58 .rw-item-math b { align-self: flex-end; font-size: 8px; }
        .rw-paper--58 .rw-thermal-heading { font-size: 8px; }
        .rw-paper--58 .rw-thermal-heading span { font-size: 7px; }
        .rw-paper--58 .rw-summary--thermal .rw-total b { font-size: 15px; }
        .rw-paper--58 .rw-summary--thermal .rw-summary-lines > div,
        .rw-paper--58 .rw-summary--thermal .rw-paid > div { font-size: 7.5px; }
        .rw-paper--58 .rw-summary--thermal .rw-summary-lines b,
        .rw-paper--58 .rw-summary--thermal .rw-paid b { font-size: 7.5px; }
        .rw-paper--58 .rw-footer strong { font-size: 9px; }
        .rw-paper--58 .rw-footer span { font-size: 7px; }
        @media (max-width: 980px) {
          .rw-width-grid { grid-template-columns: minmax(320px, 1.3fr) minmax(250px, 1fr); }
          .rw-format--58 { grid-column: 1 / -1; width: min(100%, 360px); justify-self: center; }
        }
        @media (max-width: 640px) {
          .rw-scene { padding: 23px 14px 35px; }
          .rw-intro { align-items: start; flex-direction: column; gap: 11px; margin-bottom: 17px; }
          .rw-board-note { white-space: normal; }
          .rw-width-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; }
          .rw-format--58 { grid-column: auto; width: min(100%, 310px); }
          .rw-format--80 { width: min(100%, 390px); justify-self: center; }
          .rw-format--wide { width: 100%; }
          .rw-paper--wide { padding: 17px 14px 14px; }
          .rw-paper--thermal { min-height: 0; }
          .rw-paper--80 { width: min(100%, 320px); margin-inline: auto; }
          .rw-paper--58 { width: min(100%, 235px); margin-inline: auto; }
          .rw-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .rw-meta-invoice { grid-column: 1 / -1; }
        }
      `}</style>
      <div className="rw-board">
        <header className="rw-intro">
          <div>
            <div className="rw-kicker">X-STORE · PRINT STUDY</div>
            <h1>إيصال واحد، بثلاثة مقاسات</h1>
            <p>توزيع مختلف لكل عرض ورق، مع البيانات نفسها جاهزة للطباعة.</p>
          </div>
          <div className="rw-board-note"><b>٣</b> صيغ طباعة <span>·</span> فاتورة واحدة للمقارنة</div>
        </header>
        <section className="rw-width-grid" aria-label="مقارنة مقاسات الإيصالات">
          <div className="rw-format rw-format--wide">
            <div className="rw-format-label"><strong>ورق عريض</strong><span>WIDE / 100 mm</span></div>
            <WideReceipt />
          </div>
          <div className="rw-format rw-format--80">
            <div className="rw-format-label"><strong>حراري قياسي</strong><span>80 mm</span></div>
            <ThermalReceipt />
          </div>
          <div className="rw-format rw-format--58">
            <div className="rw-format-label"><strong>حراري مدمج</strong><span>58 mm</span></div>
            <ThermalReceipt narrow />
          </div>
        </section>
      </div>
    </main>
  );
}
