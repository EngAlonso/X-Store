import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeftRight,
  Banknote,
  BriefcaseBusiness,
  Check,
  CreditCard,
  Footprints,
  Glasses,
  Minus,
  Package,
  Pause,
  Plus,
  Search,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import './CalmCounter.css';

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  quantity: number;
  icon: typeof Package;
  tone: string;
};
type Payment = 'cash' | 'card' | 'wallet';
type HeldSale = { id: string; label: string; time: string; items: Record<string, number> };

const products: Product[] = [
  { id: 'p1', name: 'قميص قطني كلاسيكي', sku: 'TS-1001', category: 'ملابس', price: 320, quantity: 18, icon: Shirt, tone: 'sage' },
  { id: 'p2', name: 'بنطال يومي مريح', sku: 'PA-2041', category: 'ملابس', price: 475, quantity: 12, icon: Package, tone: 'clay' },
  { id: 'p3', name: 'حقيبة كتف عملية', sku: 'BG-3012', category: 'إكسسوارات', price: 680, quantity: 7, icon: BriefcaseBusiness, tone: 'blue' },
  { id: 'p4', name: 'حذاء رياضي خفيف', sku: 'SH-4028', category: 'أحذية', price: 890, quantity: 5, icon: Footprints, tone: 'ochre' },
  { id: 'p5', name: 'وشاح ناعم', sku: 'SC-5104', category: 'إكسسوارات', price: 185, quantity: 21, icon: ShoppingBag, tone: 'rose' },
  { id: 'p6', name: 'محفظة جلد صغيرة', sku: 'WL-6203', category: 'إكسسوارات', price: 390, quantity: 9, icon: Wallet, tone: 'sage' },
  { id: 'p7', name: 'نظارة شمسية عصرية', sku: 'GL-7310', category: 'إكسسوارات', price: 255, quantity: 14, icon: Glasses, tone: 'blue' },
  { id: 'p8', name: 'قميص كتان صيفي', sku: 'TS-1128', category: 'ملابس', price: 410, quantity: 8, icon: Shirt, tone: 'ochre' },
];

const paymentLabels: Record<Payment, string> = { cash: 'نقداً', card: 'بطاقة', wallet: 'محفظة' };
const money = (value: number) =>
  new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(value);
const count = (value: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(value);

export function CalmCounter() {
  const [cart, setCart] = useState<Record<string, number>>({ p1: 1, p3: 1, p5: 2 });
  const [term, setTerm] = useState('');
  const [discount, setDiscount] = useState('40');
  const [received, setReceived] = useState('1600');
  const [payment, setPayment] = useState<Payment>('cash');
  const [heldSales, setHeldSales] = useState<HeldSale[]>([
    { id: 'X-٢٤٨١', label: 'طلب زبون — قطعتان', time: '١١:٣٢ ص', items: { p2: 1, p6: 1 } },
  ]);
  const [dialog, setDialog] = useState<'held' | 'exchange' | null>(null);
  const [notice, setNotice] = useState('');
  const [exchangeInvoice, setExchangeInvoice] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const visible = useMemo(
    () =>
      products.filter((product) => {
        return `${product.name} ${product.sku}`.toLowerCase().includes(term.toLowerCase());
      }),
    [term],
  );
  const cartLines = products.filter((product) => cart[product.id]).map((product) => ({ ...product, count: cart[product.id] }));
  const itemCount = cartLines.reduce((sum, product) => sum + product.count, 0);
  const subtotal = cartLines.reduce((sum, product) => sum + product.price * product.count, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const tax = (subtotal - discountAmount) * 0.15;
  const total = subtotal - discountAmount + tax;
  const change = Math.max(0, (Number(received) || 0) - total);

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

  function holdSale() {
    if (!cartLines.length) return;
    setHeldSales((current) => [
      { id: `X-${count(Date.now() % 9000 + 1000)}`, label: `${count(itemCount)} أصناف`, time: 'الآن', items: { ...cart } },
      ...current,
    ]);
    setCart({});
    setDiscount('0');
    setReceived('');
    setNotice('تم تعليق الفاتورة، ويمكن استعادتها في أي وقت.');
  }

  function restoreSale(sale: HeldSale) {
    setCart(sale.items);
    setHeldSales((current) => current.filter((item) => item.id !== sale.id));
    setDialog(null);
    setNotice('تمت استعادة الفاتورة إلى الطلب الحالي.');
  }

  function finishSale() {
    if (!cartLines.length) return;
    setCart({});
    setDiscount('0');
    setReceived('');
    setNotice('تم تسجيل البيع بنجاح. شكراً لك.');
  }

  function finishExchange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialog(null);
    setExchangeInvoice('');
    setNotice('تم تسجيل طلب الاستبدال في هذه المعاينة.');
  }

  return (
    <div className="cc-shell" dir="rtl">
      <main className="cc-main">
        <div className="cc-page-heading">
          <div>
            <div className="cc-kicker"><span /> نقطة البيع <span className="cc-kicker-sep">/</span> عملية جديدة</div>
            <h1>صندوق البيع</h1>
            <p>أضف المنتجات وأكمل الدفع بخطوات قليلة.</p>
          </div>
          <div className="cc-heading-actions">
            <button className="cc-button cc-button-muted" onClick={() => setDialog('exchange')}>
              <ArrowLeftRight size={16} /> استبدال منتج
            </button>
            <button className="cc-button cc-button-muted cc-held-trigger" onClick={() => setDialog('held')}>
              <Pause size={16} /> الفواتير المعلّقة
              <span className="cc-held-count">{count(heldSales.length)}</span>
            </button>
          </div>
        </div>

        <div className="cc-workspace">
          <section className="cc-catalog" aria-label="كتالوج المنتجات">
            <div className="cc-catalog-bar">
              <div className="cc-search">
                <Search size={18} />
                <input
                  ref={searchRef}
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="ابحث باسم المنتج أو امسح الباركود"
                  aria-label="البحث عن منتج"
                />
                {term && <button className="cc-clear-search" onClick={() => setTerm('')} aria-label="مسح البحث"><X size={15} /></button>}
                {!term && <kbd>⌘ K</kbd>}
              </div>
            </div>

            <div className="cc-section-caption">
              <div><h2>المنتجات</h2><span>اختر منتجاً لإضافته إلى الفاتورة</span></div>
              <span className="cc-result-count">{count(visible.length)} منتجات</span>
            </div>

            {visible.length ? (
              <div className="cc-product-grid">
                {visible.map((product) => {
                  const Icon = product.icon;
                  const inCart = cart[product.id] || 0;
                  return (
                    <button key={product.id} className={`cc-product-card ${inCart ? 'is-in-cart' : ''}`} onClick={() => add(product)} disabled={inCart >= product.quantity}>
                      <span className={`cc-product-art tone-${product.tone}`}>
                        <Icon size={25} strokeWidth={1.55} />
                        {inCart > 0 && <i>{count(inCart)}</i>}
                      </span>
                      <span className="cc-product-category">{product.category}</span>
                      <b className="cc-product-name">{product.name}</b>
                      <span className="cc-sku">{product.sku}</span>
                      <span className="cc-product-footer">
                        <strong>{money(product.price)}</strong>
                        <small>المتاح <b>{count(product.quantity)}</b></small>
                      </span>
                      <span className="cc-add-indicator"><Plus size={14} /></span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="cc-no-results">
                <span><Package size={21} /></span>
                <b>لم نعثر على منتجات</b>
                <small>جرّبي كلمة أخرى أو امسحي البحث لعرض كل المنتجات.</small>
                <button onClick={() => setTerm('')}>مسح البحث</button>
              </div>
            )}
          </section>

          <aside className="cc-checkout">
            <div className="cc-cart-top">
              <div className="cc-cart-title">
                <span className="cc-cart-icon"><ShoppingCart size={17} /></span>
                <div><h2>الطلب الحالي</h2><span>فاتورة جديدة</span></div>
              </div>
              <button className="cc-empty-cart" onClick={() => setCart({})} disabled={!cartLines.length}>
                <Trash2 size={14} /> تفريغ
              </button>
            </div>
            <div className="cc-cart-meta">
              <span>المنتجات في الفاتورة</span>
              <b>{count(itemCount)} {itemCount === 1 ? 'صنف' : 'أصناف'}</b>
            </div>

            <div className={`cc-cart-lines ${cartLines.length > 2 ? 'has-lines' : ''}`}>
              {cartLines.map((product) => (
                <div className="cc-cart-line" key={product.id}>
                  <span className={`cc-line-art tone-${product.tone}`}><product.icon size={16} strokeWidth={1.6} /></span>
                  <div className="cc-line-info"><b>{product.name}</b><small>{money(product.price)} <span>للقطعة</span></small></div>
                  <div className="cc-stepper">
                    <button onClick={() => mutateCart(product.id, -1)} aria-label="إنقاص الكمية"><Minus size={13} /></button>
                    <b>{count(product.count)}</b>
                    <button onClick={() => mutateCart(product.id, 1)} aria-label="زيادة الكمية" disabled={product.count >= product.quantity}><Plus size={13} /></button>
                  </div>
                  <strong className="cc-line-total">{money(product.price * product.count)}</strong>
                </div>
              ))}
              {!cartLines.length && (
                <div className="cc-cart-empty">
                  <span><ShoppingCart size={22} /></span>
                  <b>ابدئي بإضافة المنتجات</b>
                  <small>ستظهر تفاصيل الفاتورة هنا.</small>
                </div>
              )}
            </div>

            <div className="cc-calculation">
              <div><span>المجموع الفرعي</span><b>{money(subtotal)}</b></div>
              <label>
                <span>الخصم</span>
                <span className="cc-discount-input">
                  <input type="number" min="0" max={subtotal} value={discount} onChange={(event) => setDiscount(event.target.value)} disabled={!cartLines.length} aria-label="قيمة الخصم" />
                  <small>ر.س</small>
                </span>
              </label>
              <div><span>ضريبة القيمة المضافة <i>١٥٪</i></span><b>{money(tax)}</b></div>
              <div className="cc-grand-total"><span>الإجمالي المستحق</span><b>{money(total)}</b></div>
            </div>

            <div className="cc-payment-heading"><span>طريقة الدفع</span><small>اختاري وسيلة واحدة</small></div>
            <div className="cc-payment-tabs">
              {([
                ['cash', Banknote],
                ['card', CreditCard],
                ['wallet', Wallet],
              ] as const).map(([method, Icon]) => (
                <button key={method} className={payment === method ? 'is-selected' : ''} onClick={() => setPayment(method)}>
                  <Icon size={16} />{paymentLabels[method]}
                </button>
              ))}
            </div>
            {payment === 'cash' && (
              <div className="cc-cash-row">
                <label className="cc-received">
                  <span>المبلغ المستلم</span>
                  <span className="cc-received-input">
                    <input type="number" min="0" value={received} onChange={(event) => setReceived(event.target.value)} placeholder={count(total)} aria-label="المبلغ المستلم" />
                    <small>ر.س</small>
                  </span>
                </label>
                <div className="cc-change"><span>الباقي</span><b>{money(change)}</b></div>
              </div>
            )}
            {payment !== 'cash' && (
              <div className="cc-payment-note"><Check size={14} /> سيتم استلام المبلغ عبر {paymentLabels[payment]}</div>
            )}
            <div className="cc-actions">
              <button className="cc-button cc-hold-button" onClick={holdSale} disabled={!cartLines.length}>
                <Pause size={15} /> تعليق الفاتورة
              </button>
              <button className="cc-button cc-finish-button" onClick={finishSale} disabled={!cartLines.length || (payment === 'cash' && Number(received) > 0 && Number(received) < total)}>
                <Check size={17} /> إتمام البيع
              </button>
            </div>
            <div className="cc-secure-note"><span /> عملية آمنة · ضريبة ١٥٪ مطبّقة</div>
          </aside>
        </div>
      </main>

      {notice && <div className="cc-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="إغلاق التنبيه"><X size={15} /></button></div>}

      {dialog && (
        <div className="cc-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <section className="cc-dialog" role="dialog" aria-modal="true" aria-labelledby="cc-dialog-title">
            <div className="cc-dialog-head">
              <div>
                <span className="cc-dialog-mark">{dialog === 'held' ? <Pause size={17} /> : <ArrowLeftRight size={17} />}</span>
                <div><h2 id="cc-dialog-title">{dialog === 'held' ? 'الفواتير المعلّقة' : 'استبدال منتج'}</h2><small>{dialog === 'held' ? 'استعيدي طلباً محفوظاً للمتابعة' : 'أدخلي بيانات الفاتورة والمنتج البديل'}</small></div>
              </div>
              <button className="cc-dialog-close" onClick={() => setDialog(null)} aria-label="إغلاق"><X size={18} /></button>
            </div>
            {dialog === 'held' ? (
              <div className="cc-held-list">
                {heldSales.length ? heldSales.map((sale) => {
                  const heldTotal = Object.entries(sale.items).reduce((sum, [id, qty]) => {
                    const product = products.find((item) => item.id === id);
                    return sum + (product?.price || 0) * qty;
                  }, 0);
                  return (
                    <div className="cc-held-item" key={sale.id}>
                      <span className="cc-held-art"><ShoppingCart size={17} /></span>
                      <div><b className="cc-sku">{sale.id}</b><small>{sale.label} <i>·</i> {sale.time}</small></div>
                      <strong>{money(heldTotal)}</strong>
                      <button onClick={() => restoreSale(sale)}>استعادة</button>
                    </div>
                  );
                }) : <div className="cc-dialog-empty"><Pause size={21} /><b>لا توجد فواتير معلّقة</b><small>يمكنك تعليق طلب للعودة إليه لاحقاً.</small></div>}
              </div>
            ) : (
              <form className="cc-exchange-form" onSubmit={finishExchange}>
                <label><span>رقم الفاتورة الأصلية</span><input required value={exchangeInvoice} onChange={(event) => setExchangeInvoice(event.target.value)} placeholder="مثال: X-2481" /></label>
                <label><span>المنتج المرتجع</span><select defaultValue="" required><option value="" disabled>اختاري المنتج المرتجع</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>
                <div className="cc-exchange-pair">
                  <label><span>كمية المرتجع</span><input type="number" min="1" defaultValue="1" required /></label>
                  <label><span>كمية البديل</span><input type="number" min="1" defaultValue="1" required /></label>
                </div>
                <label><span>المنتج البديل</span><select defaultValue="" required><option value="" disabled>اختاري المنتج البديل</option>{products.filter((product) => product.quantity > 0).map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}</select></label>
                <div className="cc-exchange-hint"><ArrowLeftRight size={15} /> تتم مراجعة المرتجع والبديل ضمن طلب واحد.</div>
                <div className="cc-dialog-actions">
                  <button type="button" className="cc-button cc-button-muted" onClick={() => setDialog(null)}>إلغاء</button>
                  <button className="cc-button cc-finish-button" type="submit">متابعة الاستبدال</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
