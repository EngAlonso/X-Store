import './_group.css';
import './Refined.css';
import { ShieldCheck } from 'lucide-react';

export function Refined() {
  return (
    <main dir="rtl" className="xstore-auth-mockup xstore-auth-refined">
      <div className="auth-screen">
        <section className="auth-brand" aria-label="X-Store">
          <div className="brand">
            <img src="/__mockup/images/x-store-mark.png" alt="" />
            <span>X-Store</span>
            <small>نظام إدارة متجرك</small>
          </div>
          <p>مساحة عملك تبدأ من هنا.</p>
          <div className="auth-note">
            <img src="/__mockup/images/x-store-mark.png" alt="" />
            <span>
              تجربة عمل هادئة
              <br />
              وموثوقة كل يوم.
            </span>
          </div>
        </section>

        <div className="auth-widget">
          <section className="auth-card" aria-labelledby="founder-setup-title">
            <div className="auth-card-heading">
              <span className="auth-icon"><ShieldCheck size={21} strokeWidth={1.8} /></span>
              <div>
                <h1 id="founder-setup-title">إعداد حساب المؤسس</h1>
                <p>أنشئ الحساب الأول، وسيصبح مالك المنصة.</p>
              </div>
            </div>

            <form className="auth-form">
              <label className="field">
                <span>اسم المؤسس</span>
                <input autoComplete="name" aria-label="اسم المؤسس" />
              </label>
              <label className="field">
                <span>رقم الهاتف</span>
                <input type="tel" autoComplete="tel" placeholder="مثال: ‎+20 10 1234 5678" />
              </label>
              <label className="field">
                <span>كلمة المرور</span>
                <input type="password" autoComplete="new-password" placeholder="10 أحرف على الأقل" />
              </label>
              <label className="field">
                <span>تأكيد كلمة المرور</span>
                <input type="password" autoComplete="new-password" />
              </label>

              <div className="role-hint">
                <ShieldCheck size={17} strokeWidth={1.8} />
                <span>الإعداد لمرة واحدة. أول شخص يكمل الحفظ يصبح مالك المنصة، وبعدها يختفي هذا النموذج.</span>
              </div>
              <button className="auth-submit" type="button">إنشاء حساب المالك</button>
            </form>

            <div className="auth-contact-empty">لم تُضف إدارة المنصة معلومات التواصل بعد.</div>
          </section>
        </div>
      </div>
    </main>
  );
}
