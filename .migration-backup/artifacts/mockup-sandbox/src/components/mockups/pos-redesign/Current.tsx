import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Banknote,
  CircleCheck,
  CreditCard,
  Minus,
  Package,
  Pause,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import './_group.css';

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  quantity: number;
};

const products: Product[] = [
  { id: 'p1', name: 'قميص قطني كلاسيك', sku: 'TS-1001', category: 'ملابس', price: 320, quantity: 18 },
  { id: 'p2', name: 'بنطال يومي مريح', sku: 'PA-2041', category: 'ملابس', price: 475, quantity: 12 },
  { id: 'p3', name: 'حقيبة كتف عملية', sku: 'BG-3012', category: 'إكسسوارات', price: 680, quantity: 7 },
  { id: 'p4', name: 'حذاء رياضي خفيف', sku: 'SH-4028', category: 'أحذية', price: 890, quantity: 5 },
  { id: 'p5', name: 'وشاح ناعم', sku: 'SC-5104', category: 'إكسسوارات', price: 185, quantity: 21 },
  { id: 'p6', name: 'محفظة جلد صغيرة', sku: 'WL-6203', category: 'إكسسوارات', price: 390, quantity: 9 },
];

const formatCount = (value: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(value);
const money = (value: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(value);
const paymentNames = { cash: 'نقداً', card: 'بطاقة', wallet: 'محفظة' } as const;

export function Current() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [term, setTerm] = useState('');
  const [discount, setDiscount] = useState('0');
  const [received, setReceived] = useState('');
  const [payment, setPayment] = useState<'cash' | 'card' | 'wallet'>('cash');
  const [notice, setNotice] = useState('');

  const visible = useMemo(
    () => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term.toLowerCase())),
    [term],
  );
  const cartLines = products.filter((product) => cart[product.id]).map((product) => ({ ...product, count: cart[product.id] }));
  const subtotal = cartLines.reduce((sum, product) => sum + product.price * product.count, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const tax = (subtotal - discountAmount) * 0.15;
  const total = subtotal - discountAmount + tax;

  function add(product: Product) {
    setCart((current) => ({ ...current, [product.id]: Math.min(product.quantity, (current[product.id] || 0) + 1) }));
  }

  function mutateCart(id: string, amount: number) {
    setCart((current) => {
      const quantity = (current[id] || 0) + amount;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: quantity };
    });
  }

  return (
    <div className="pos-preview" dir="rtl">
      <main className="main-content">
        <div className="pos-page">
          <div className="page-title">
            <div>
              <div className="eyebrow">نقطة البيع</div>
              <h1>صندوق البيع</h1>
              <p>أضف المنتجات وأكمل الدفع بخطوات قليلة.</p>
            </div>
            <div className="pos-head-actions">
              <button className="button button-quiet" onClick={() => setNotice('سيظهر نموذج الاستبدال هنا.')}>
                <ArrowLeftRight size={16} /> استبدال
              </button>
              <button className="button button-quiet held-toggle" onClick={() => setNotice('لا توجد فواتير معلقة.')}>
                <Pause size={16} /> فواتير معلقة <span className="count-bubble">٠</span>
              </button>
            </div>
          </div>

          <div className="pos-layout">
            <section className="pos-products">
              <label className="search-box pos-search">
                <Search size={18} />
                <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="ابحث عن منتج أو امسح الباركود..." />
                <kbd>⌘ K</kbd>
              </label>
              <div className="product-grid">
                {visible.map((product, index) => (
                  <button key={product.id} onClick={() => add(product)} className="product-tile">
                    <span className={`product-art art-${index % 5}`}>
                      <Package size={25} />
                      {cart[product.id] ? <i>{cart[product.id]}</i> : null}
                    </span>
                    <span className="tile-category">{product.category}</span>
                    <b>{product.name}</b>
                    <small className="ltr-id">{product.sku}</small>
                    <span className="tile-bottom">
                      <strong>{money(product.price)}</strong>
                      <span>متاح {formatCount(product.quantity)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <aside className="cart-panel">
              <div className="cart-head">
                <div>
                  <h2>الطلب الحالي</h2>
                  <span>{formatCount(cartLines.reduce((sum, product) => sum + product.count, 0))} أصناف</span>
                </div>
                <button className="table-action" onClick={() => setCart({})} disabled={!cartLines.length}>
                  <Trash2 size={14} /> تفريغ
                </button>
              </div>
              <div className="cart-lines">
                {cartLines.map((product) => (
                  <div className="cart-line" key={product.id}>
                    <span className="cart-line-art"><Package size={17} /></span>
                    <div className="cart-line-title"><b>{product.name}</b><small>{money(product.price)}</small></div>
                    <div className="stepper">
                      <button onClick={() => mutateCart(product.id, -1)} aria-label="إنقاص"><Minus size={13} /></button>
                      <b>{product.count}</b>
                      <button onClick={() => mutateCart(product.id, 1)} aria-label="زيادة" disabled={product.count >= product.quantity}><Plus size={13} /></button>
                    </div>
                    <strong>{money(product.price * product.count)}</strong>
                  </div>
                ))}
                {!cartLines.length && (
                  <div className="cart-empty">
                    <div className="cart-empty-icon"><ShoppingCart size={20} /></div>
                    <b>السلة فارغة</b>
                    <span>اختر منتجاً لإضافته إلى الفاتورة.</span>
                  </div>
                )}
              </div>
              <div className="cart-calculation">
                <div><span>المجموع الفرعي</span><b>{money(subtotal)}</b></div>
                <label>
                  <span>الخصم</span>
                  <div className="discount-input">
                    <input aria-label="قيمة الخصم" type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} disabled={!cartLines.length} />
                    <span>ر.س</span>
                  </div>
                </label>
                <div><span>ضريبة القيمة المضافة · ١٥٪</span><b>{money(tax)}</b></div>
                <div className="cart-total"><span>الإجمالي</span><b>{money(total)}</b></div>
              </div>
              <div className="payment-tabs">
                {(['cash', 'card', 'wallet'] as const).map((method, index) => {
                  const Icon = [Banknote, CreditCard, Wallet][index];
                  return (
                    <button key={method} onClick={() => setPayment(method)} className={payment === method ? 'payment-active' : ''}>
                      <Icon size={16} /> {paymentNames[method]}
                    </button>
                  );
                })}
              </div>
              {payment === 'cash' && (
                <label className="received-field">
                  <span>المبلغ المستلم</span>
                  <div>
                    <input type="number" min={total} value={received} onChange={(event) => setReceived(event.target.value)} placeholder={formatCount(total)} />
                    <small>الباقي {money(Math.max(0, (Number(received) || total) - total))}</small>
                  </div>
                </label>
              )}
              <div className="cart-actions">
                <button className="button button-quiet" onClick={() => setNotice('تم حفظ الفاتورة المعلقة في المعاينة.')} disabled={!cartLines.length}>
                  <Pause size={15} /> تعليق
                </button>
                <button className="button button-confirm" onClick={() => setNotice('هذه معاينة للتصميم، لن يتم تسجيل عملية بيع.')} disabled={!cartLines.length}>
                  <CircleCheck size={17} /> إتمام البيع
                </button>
              </div>
            </aside>
          </div>

          {notice && (
            <div className="toast-note" role="status">
              {notice}
              <button onClick={() => setNotice('')} aria-label="إغلاق"><X size={14} /></button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
