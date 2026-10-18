import "./_group.css";

export function Current() {
  return (
    <main className="xc-preview">
      <header className="xc-preview-nav">
        <div className="xc-brand"><span className="xc-brand-mark">X</span><span>X-Store</span></div>
        <div className="xc-nav-links"><span>اتصل بنا</span><span>دخول الحساب</span></div>
      </header>
      <section className="xc-current-stage" dir="rtl">
        <div className="xc-old-backdrop">
          <div className="xc-old-modal">
            <div className="xc-old-head"><h2>اتصل بنا</h2><button className="xc-old-close" aria-label="إغلاق">×</button></div>
            <p className="xc-old-intro">تواصل مع إدارة المنصة من خلال إحدى الوسائل التالية.</p>
            <div className="xc-old-empty">لم تُضف إدارة المنصة معلومات التواصل بعد.</div>
          </div>
        </div>
      </section>
    </main>
  );
}
