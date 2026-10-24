import { Boxes, Coffee, Package, ShoppingCart, Smartphone, Utensils } from 'lucide-react';
import './_group.css';

export function Current() {
  return (
    <div className="store-fit-preview" dir="rtl">
      <section className="store-fit-section" aria-labelledby="store-fit-title">
        <div className="store-fit-inner">
          <div className="store-fit-heading">
            <span className="eyebrow">مجالات مختلفة، إدارة واحدة</span>
            <h2 id="store-fit-title">متجرك أيًا كان مجاله،<br/>إدارته أسهل.</h2>
            <p>من متابعة المخزون إلى تسجيل المبيعات، X-Store يرتّب شغل اليوم في مساحة واحدة.</p>
          </div>
          <div className="store-fit-grid">
            <article className="store-fit-card"><span className="store-fit-icon"><Package size={20}/></span><div><h3>الملابس والأحذية</h3><p>تابع الأصناف والمقاسات والألوان من المخزون إلى نقطة البيع.</p></div></article>
            <article className="store-fit-card"><span className="store-fit-icon store-fit-icon-sage"><ShoppingCart size={20}/></span><div><h3>البقالة والسوبرماركت</h3><p>نظّم الكميات وسجّل حركة المبيعات اليومية بسهولة.</p></div></article>
            <article className="store-fit-card"><span className="store-fit-icon store-fit-icon-gold"><Smartphone size={20}/></span><div><h3>الإلكترونيات والإكسسوارات</h3><p>تابع الأصناف ومبيعاتها وتقاريرها بوضوح.</p></div></article>
            <article className="store-fit-card"><span className="store-fit-icon store-fit-icon-rose"><Boxes size={20}/></span><div><h3>العطور والتجميل</h3><p>رتّب المنتجات والمخزون وراقب حركتها اليومية.</p></div></article>
            <article className="store-fit-card"><span className="store-fit-icon store-fit-icon-gold"><Coffee size={20}/></span><div><h3>الكافيهات</h3><p>سجّل المبيعات وتابع الأصناف والمخزون اليومي بسهولة.</p></div></article>
            <article className="store-fit-card"><span className="store-fit-icon store-fit-icon-sage"><Utensils size={20}/></span><div><h3>المطاعم</h3><p>تابع حركة المبيعات والأصناف من نقطة البيع.</p></div></article>
          </div>
        </div>
      </section>
    </div>
  );
}
