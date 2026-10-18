import { Boxes, Coffee, Package, ShoppingCart, Smartphone, Utensils } from 'lucide-react';
import './_group.css';
import './Refined.css';

export function Refined() {
  return (
    <div className="store-fit-preview store-fit-refined" dir="rtl">
      <section className="store-fit-section" aria-labelledby="store-fit-title-refined">
        <div className="store-fit-inner">
          <div className="store-fit-heading">
            <div>
              <span className="store-fit-eyebrow">مجالات مختلفة، إدارة واحدة</span>
              <h2 id="store-fit-title-refined">كل نشاط له تفاصيله،<br/><em>وإدارته تستحق الوضوح.</em></h2>
            </div>
            <div className="store-fit-heading-copy">
              <p>من نقطة البيع إلى المخزون وتقارير الأداء، X-Store يجمع أدوات يومك في تجربة واحدة مرتّبة.</p>
              <div className="store-fit-meta"><span><strong>٠٦</strong> قطاعات متنوعة</span><i aria-hidden="true"/><span>نظام واحد متكامل</span></div>
            </div>
          </div>
          <div className="store-fit-grid">
            <article className="store-fit-card"><div className="store-fit-card-top"><span className="store-fit-icon"><Package size={21}/></span><span className="store-fit-index">01</span></div><h3>الملابس والأحذية</h3><p>تابع الأصناف والمقاسات والألوان من المخزون إلى نقطة البيع.</p></article>
            <article className="store-fit-card"><div className="store-fit-card-top"><span className="store-fit-icon store-fit-icon-sage"><ShoppingCart size={21}/></span><span className="store-fit-index">02</span></div><h3>البقالة والسوبرماركت</h3><p>نظّم الكميات وسجّل حركة المبيعات اليومية بسهولة.</p></article>
            <article className="store-fit-card"><div className="store-fit-card-top"><span className="store-fit-icon store-fit-icon-gold"><Smartphone size={21}/></span><span className="store-fit-index">03</span></div><h3>الإلكترونيات والإكسسوارات</h3><p>تابع الأصناف ومبيعاتها وتقاريرها بوضوح.</p></article>
            <article className="store-fit-card"><div className="store-fit-card-top"><span className="store-fit-icon store-fit-icon-rose"><Boxes size={21}/></span><span className="store-fit-index">04</span></div><h3>العطور والتجميل</h3><p>رتّب المنتجات والمخزون وراقب حركتها اليومية.</p></article>
            <article className="store-fit-card"><div className="store-fit-card-top"><span className="store-fit-icon store-fit-icon-gold"><Coffee size={21}/></span><span className="store-fit-index">05</span></div><h3>الكافيهات</h3><p>سجّل المبيعات وتابع الأصناف والمخزون اليومي بسهولة.</p></article>
            <article className="store-fit-card"><div className="store-fit-card-top"><span className="store-fit-icon store-fit-icon-sage"><Utensils size={21}/></span><span className="store-fit-index">06</span></div><h3>المطاعم</h3><p>تابع حركة المبيعات والأصناف من نقطة البيع.</p></article>
          </div>
        </div>
      </section>
    </div>
  );
}
