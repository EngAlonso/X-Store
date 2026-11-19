import './_group.css';
import { ShieldCheck } from 'lucide-react';

export function Current() {
  return (
    <main dir="rtl" className="xstore-auth-mockup">
      <div className="auth-screen">
        <div className="auth-brand">
          <a href="#" className="brand">
            <img src="/__mockup/images/x-store-mark.png" alt="" />
            <span>X-Store</span>
            <small>نظام إدارة متجرك</small>
          </a>
          <p>مساحة عملك تبدأ من هنا.</p>
          <div className="auth-note">
            <img src="/__mockup/images/x-store-mark.png" alt="" />
            <span>
              تجربة عمل هادئة
              <br />
              وموثوقة كل يوم.
            </span>
          </div>
        </div>

        <div className="auth-widget">
          <section className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-icon"><ShieldCheck size={20} /></span>
              <div>
                <h1>إعداد حساب المؤسس</h1>
                <p>أنشئ الحساب الأول، وسيصبح مالك المنصة.</p>
              </div>
            </div>
            <form className="auth-form">
              <label className="field">
                <span>اسم المؤسس</span>
                <input autoComplete="name" />
              </label>
              <label className="field">
                <span>رقم الهاتف</span>
                <input type="tel" placeholder="مثال: ‎+20 10 1234 5678" />
              </label>
              <label className="field">
                <span>كلمة المرور</span>
                <input type="password" placeholder="10 أحرف على الأقل" />
              </label>
              <label className="field">
                <span>تأكيد كلمة المرور</span>
                <input type="password" />
              </label>
              <div className="role-hint">
                <ShieldCheck size={16} />
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
