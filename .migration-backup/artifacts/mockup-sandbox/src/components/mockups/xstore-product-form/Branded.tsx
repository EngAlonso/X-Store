import { Boxes, Package, SlidersHorizontal } from 'lucide-react';
import './_group.css';
import './ProductForm.css';

function Field({
  label,
  placeholder,
  type = 'text',
  required = false,
  fullWidth = false,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <label className={`preview-field ${fullWidth ? 'preview-field--wide' : ''}`}>
      <span>{label}{required && <i aria-hidden="true"> *</i>}</span>
      <input type={type} placeholder={placeholder} required={required} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} />
    </label>
  );
}

function SectionHeading({
  number,
  icon,
  title,
  note,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <div className="product-preview-section">
      <span className="product-preview-section-number">{number}</span>
      <span className="product-preview-section-icon">{icon}</span>
      <div>
        <b>{title}</b>
        <small>{note}</small>
      </div>
    </div>
  );
}

export function Branded() {
  return (
    <main className="xstore-product-mockup xstore-product-mockup--branded">
      <section className="product-preview-dialog">
        <header className="branded-dialog-heading">
          <div>
            <span className="branded-eyebrow">كتالوج المتجر</span>
            <h1>إضافة منتج</h1>
          </div>
          <button type="button" aria-label="إغلاق">×</button>
        </header>

        <form className="branded-product-grid">
          <div className="branded-product-intro preview-field--wide">
            <span className="branded-product-icon"><Package size={21} /></span>
            <div>
              <strong>أضف منتجًا إلى مخزونك</strong>
              <p>أدخل المعلومات الأساسية والأسعار والكمية.</p>
            </div>
            <span className="branded-auto-note">SKU تلقائي · تصنيف عام</span>
          </div>

          <SectionHeading number="01" icon={<Package size={16} />} title="بيانات المنتج" note="الاسم والباركود للتعرّف عليه." />
          <Field label="اسم المنتج" placeholder="مثال: تيشيرت قطني أسود" required />
          <Field label="الباركود (اختياري)" placeholder="اكتب الرقم أو امسح الكود" />

          <SectionHeading number="02" icon={<Boxes size={16} />} title="السعر والمخزون" note="سعر الوحدة والكمية المتاحة." />
          <Field label="سعر البيع" placeholder="0.00" type="number" required />
          <Field label="سعر التكلفة (اختياري)" placeholder="اتركه فارغًا لو غير متاح" type="number" />
          <Field label="الكمية" placeholder="0" type="number" required />

          <SectionHeading number="03" icon={<SlidersHorizontal size={16} />} title="تفاصيل إضافية" note="كل هذه المعلومات اختيارية." />
          <Field label="اللون (اختياري)" placeholder="مثال: أسود" />
          <Field label="المقاس (اختياري)" placeholder="مثال: M أو 42" />
          <Field label="رقم القطعة (اختياري)" placeholder="رقم الموديل أو كود المورد" fullWidth />

          <footer className="branded-dialog-actions">
            <span>الحقول المطلوبة موضّحة بعلامة <b>*</b></span>
            <div>
              <button type="button" className="preview-button preview-button--quiet">إلغاء</button>
              <button type="button" className="preview-button preview-button--primary">حفظ المنتج</button>
            </div>
          </footer>
        </form>
      </section>
    </main>
  );
}
