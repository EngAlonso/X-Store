import { useState } from "react";
import "./_group.css";

export function Clear() {
  const [saleType, setSaleType] = useState<"retail" | "wholesale">("retail");

  return (
    <main className="pos-type-preview">
      <header className="preview-heading">
        <div>
          <span>نقطة البيع</span>
          <h1>صندوق البيع</h1>
        </div>
        <p>أضف المنتجات وأكمل الدفع بخطوات قليلة.</p>
      </header>

      <section className="pos-products">
        <label className="pos-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="البحث عن منتج"
            placeholder="ابحث باسم المنتج بأي لهجة أو English..."
            readOnly
          />
          <kbd>⌘ K</kbd>
        </label>

        <div
          className="sale-type-tabs sale-type-tabs--clear"
          role="group"
          aria-label="قسم البيع"
        >
          <button
            type="button"
            className={saleType === "retail" ? "is-active" : ""}
            aria-pressed={saleType === "retail"}
            onClick={() => setSaleType("retail")}
          >
            <b>القطاعي</b>
            <small>سعر القطاعي</small>
          </button>
          <button
            type="button"
            className={saleType === "wholesale" ? "is-active" : ""}
            aria-pressed={saleType === "wholesale"}
            onClick={() => setSaleType("wholesale")}
          >
            <b>الجملة</b>
            <small>سعر الجملة</small>
          </button>
        </div>

        <div className="sample-products">
          <button type="button" className="sample-product">
            <small>عام</small>
            <strong>بيلي بلي</strong>
            <span>200 ج.م.</span>
          </button>
        </div>
      </section>
    </main>
  );
}
