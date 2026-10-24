import { KeyRound } from "lucide-react";
import "./_group.css";

export function Current() {
  return (
    <main className="current-auth" dir="rtl">
      <section className="current-auth-brand">
        <div className="current-brand">
          <img src="/__mockup/images/x-store-mark.png" alt="" />
          <span>X-Store</span>
          <small>نظام إدارة متجرك</small>
        </div>
        <p>مساحة عملك تبدأ من هنا.</p>
        <div className="current-auth-note">
          <img src="/__mockup/images/x-store-mark.png" alt="" />
          <span>
            تجربة عمل هادئة
            <br />
            وموثوقة كل يوم.
          </span>
        </div>
      </section>

      <section className="current-auth-widget">
        <div className="current-auth-card">
          <div className="current-auth-heading">
            <span className="current-auth-icon">
              <KeyRound size={20} />
            </span>
            <div>
              <h1>تسجيل الدخول</h1>
              <p>استخدم رقم الهاتف وكلمة المرور المخصصين لحسابك.</p>
            </div>
          </div>

          <form className="current-auth-form" onSubmit={(event) => event.preventDefault()}>
            <label className="current-auth-field">
              <span>رقم الهاتف</span>
              <input type="tel" autoComplete="username" placeholder="مثال: +20 10 1234 5678" />
            </label>
            <label className="current-auth-field">
              <span>كلمة المرور</span>
              <input type="password" autoComplete="current-password" placeholder="أدخل كلمة المرور" />
            </label>
            <button className="current-auth-submit" type="submit">دخول</button>
          </form>

          <div className="current-auth-empty">لم تُضف إدارة المنصة معلومات التواصل بعد.</div>
        </div>
      </section>
    </main>
  );
}
