import './_group.css';
import './ProductForm.css';

function Field({ label, type = 'text' }: { label: string; type?: string }) {
  return (
    <label className="preview-field">
      <span>{label}</span>
      <input type={type} />
    </label>
  );
}

export function Current() {
  return (
    <main className="xstore-product-mockup xstore-product-mockup--current">
      <section className="product-preview-dialog">
        <header className="current-dialog-heading">
          <h1>إضافة منتج</h1>
          <button type="button" aria-label="إغلاق">×</button>
        </header>
        <form className="current-product-grid">
          <Field label="اسم المنتج" />
          <Field label="رمز SKU" />
          <Field label="الباركود" />
          <Field label="التصنيف" />
          <Field label="سعر البيع" type="number" />
          <Field label="سعر التكلفة" type="number" />
          <Field label="الكمية" type="number" />
          <Field label="اللون" />
          <Field label="المقاس" />
          <Field label="رقم القطعة" />
          <Field label="تاريخ الصلاحية" type="date" />
          <footer className="current-dialog-actions">
            <button type="button" className="preview-button preview-button--quiet">إلغاء</button>
            <button type="button" className="preview-button preview-button--primary">حفظ المنتج</button>
          </footer>
        </form>
      </section>
    </main>
  );
}
