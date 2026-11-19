import { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import "./_group.css";
import "./Unified.css";

export function Unified() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="xsu-page" dir="rtl">
      <div className="xsu-shell">
        <section className="xsu-brand" aria-label="هوية X-Store">
          <div className="xsu-brand-top">
            <div className="xsu-brand-lockup">
              <span className="xsu-logo-frame">
                <img src="/__mockup/images/x-store-mark.png" alt="" />
              </span>
              <span className="xsu-brand-name">X-Store</span>
              <span className="xsu-brand-divider" />
              <span className="xsu-brand-caption">إدارة متجرك</span>
            </div>
            <span className="xsu-secure-pill">
              <ShieldCheck size={15} strokeWidth={1.8} />
              <span>مساحة آمنة</span>
            </span>
          </div>

          <div className="xsu-brand-copy">
            <span className="xsu-eyebrow">
              <span className="xsu-eyebrow-dot" />
              يومك التجاري يبدأ بهدوء
            </span>
            <h2>
              كل تفاصيل
              <br />
              متجرك، <em>في مكانها.</em>
            </h2>
            <p>
              مساحة عمل واحدة تساعدك على متابعة شؤون متجرك بثقة، من أول اليوم
              إلى آخره.
            </p>
          </div>

          <div className="xsu-brand-footer">
            <div className="xsu-footer-mark">
              <LockKeyhole size={17} strokeWidth={1.7} />
            </div>
            <div>
              <strong>عملك محفوظ بعناية</strong>
              <span>دخول موثوق لفريقك، كل يوم.</span>
            </div>
            <span className="xsu-footer-index">01 / 01</span>
          </div>

          <span className="xsu-orbit xsu-orbit-one" aria-hidden="true" />
          <span className="xsu-orbit xsu-orbit-two" aria-hidden="true" />
          <span className="xsu-orbit xsu-orbit-three" aria-hidden="true" />
          <span className="xsu-brand-glint" aria-hidden="true" />
        </section>

        <section className="xsu-login" aria-labelledby="xsu-title">
          <div className="xsu-login-inner">
            <div className="xsu-mobile-lockup">
              <span className="xsu-logo-frame">
                <img src="/__mockup/images/x-store-mark.png" alt="" />
              </span>
              <span className="xsu-brand-name">X-Store</span>
              <span className="xsu-mobile-caption">إدارة متجرك</span>
            </div>

            <div className="xsu-heading">
              <div className="xsu-heading-icon">
                <Smartphone size={20} strokeWidth={1.75} />
              </div>
              <div>
                <span className="xsu-heading-kicker">مرحباً بعودتك</span>
                <h1 id="xsu-title">تسجيل الدخول</h1>
              </div>
            </div>
            <p className="xsu-intro">
              أدخل بيانات حسابك للعودة إلى مساحة عملك.
            </p>

            <form className="xsu-form" onSubmit={(event) => event.preventDefault()}>
              <label className="xsu-field">
                <span className="xsu-field-label">رقم الهاتف</span>
                <span className="xsu-input-wrap">
                  <Smartphone size={17} aria-hidden="true" />
                  <input
                    type="tel"
                    autoComplete="username"
                    inputMode="tel"
                    placeholder="مثال: +20 10 1234 5678"
                    aria-label="رقم الهاتف"
                  />
                </span>
              </label>

              <label className="xsu-field">
                <span className="xsu-field-label">كلمة المرور</span>
                <span className="xsu-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="أدخل كلمة المرور"
                    aria-label="كلمة المرور"
                  />
                  <button
                    className="xsu-visibility"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              <button className="xsu-submit" type="submit">
                <span>دخول إلى متجري</span>
                <ArrowLeft size={17} strokeWidth={2} />
              </button>
            </form>

            <div className="xsu-support">
              <span className="xsu-support-rule" />
              <p>لم تُضف إدارة المنصة معلومات التواصل بعد.</p>
              <span className="xsu-support-rule" />
            </div>
            <p className="xsu-footnote">
              <ShieldCheck size={14} strokeWidth={1.8} />
              <span>بياناتك تبقى خاصة وآمنة</span>
            </p>
          </div>
        </section>
      </div>
      <div className="xsu-page-stamp" aria-hidden="true">X / WORKSPACE</div>
    </main>
  );
}
