import { ArrowUpLeft, ShieldCheck } from "lucide-react";
import "./_group.css";

export function Refreshed() {
  return (
    <footer className="xf-refined">
      <div className="xf-inner">
        <div className="xf-brand">
          <a className="xf-brand-lockup" href="/">
            <img src="/__mockup/images/x-store-mark.png" alt="" />
            <span>X-Store</span>
          </a>
          <p>أدوات متجرك اليومية، في مساحة عمل واحدة واضحة.</p>
          <span className="xf-brand-note"><ShieldCheck size={15} /> نظام إدارة متجرك</span>
        </div>
        <nav className="xf-nav" aria-label="روابط سريعة">
          <b>روابط سريعة</b>
          <a href="/">الرئيسية</a>
          <a href="/contact">اتصل بنا</a>
          <a href="/sign-in">تسجيل الدخول</a>
        </nav>
        <div className="xf-account">
          <span>مساحة عملك</span>
          <b>كل متجرك، في مكان واحد.</b>
          <a href="/sign-in">دخول الحساب <ArrowUpLeft size={16} /></a>
        </div>
      </div>
      <div className="xf-bottom">
        <span>© 2026 X-Store. جميع الحقوق محفوظة.</span>
        <span>إدارة أوضح. متجر أقوى.</span>
      </div>
      <span className="xf-glow" aria-hidden="true" />
    </footer>
  );
}
