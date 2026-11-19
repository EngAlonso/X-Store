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
            <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">👕</span><h3>الملابس والأحذية</h3></article>
            <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">🛒</span><h3>البقالة والسوبرماركت</h3></article>
            <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">📱</span><h3>الإلكترونيات والإكسسوارات</h3></article>
            <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">💄</span><h3>العطور والتجميل</h3></article>
            <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">☕</span><h3>الكافيهات</h3></article>
            <article className="store-fit-card"><span className="store-fit-icon" aria-hidden="true">🍽️</span><h3>المطاعم</h3></article>
          </div>
        </div>
      </section>
    </div>
  );
}
