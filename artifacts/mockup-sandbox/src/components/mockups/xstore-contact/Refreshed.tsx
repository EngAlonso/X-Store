import "./_group.css";

const channels = [
  { icon: "☎", eyebrow: "تواصل هاتفي", title: "اتصال مباشر", value: "رقم الدعم المُضاف للمنصة" },
  { icon: "✉", eyebrow: "راسلنا", title: "البريد الإلكتروني", value: "البريد المُضاف للمنصة" },
];

const socials = ["WhatsApp", "Facebook", "Instagram", "Telegram"];

export function Refreshed() {
  return (
    <main className="xc-refreshed" dir="rtl">
      <header className="xc-preview-nav">
        <div className="xc-brand"><span className="xc-brand-mark">X</span><span>X-Store</span></div>
        <div className="xc-nav-links"><span>الرئيسية</span><span>دخول الحساب</span></div>
      </header>
      <section className="xc-hero">
        <div className="xc-hero-copy">
          <span className="xc-eyebrow"><i /> مركز التواصل الرسمي</span>
          <h1>خلّينا نساعدك<br /><em>تكمّل شغلك بثقة.</em></h1>
          <p>تواصل مع إدارة X-Store بالطريقة الأنسب لك. كل قنوات التواصل الرسمية في مكان واحد.</p>
        </div>
        <div className="xc-hero-art" aria-hidden="true"><span className="xc-orbit" /><span className="xc-message-icon">✉</span></div>
      </section>
      <section className="xc-page-content">
        <div className="xc-contact-panel">
          <span className="xc-section-kicker">قنوات التواصل</span>
          <h2 className="xc-section-title">اختر الطريقة الأنسب لك</h2>
          <p className="xc-section-note">تقدر تتواصل مباشرة أو تتابعنا على منصات التواصل.</p>
          <div className="xc-channel-grid">
            {channels.map((channel) => <div className="xc-channel" key={channel.title}>
              <span className="xc-channel-icon">{channel.icon}</span>
              <span className="xc-channel-copy"><small>{channel.eyebrow}</small><b>{channel.title}</b><em>{channel.value}</em></span>
            </div>)}
          </div>
          <div className="xc-social-head">تابعنا على منصات التواصل</div>
          <div className="xc-social-grid">{socials.map((social) => <span className="xc-social" key={social}>{social}</span>)}</div>
        </div>
        <aside className="xc-help-panel">
          <span className="xc-help-icon">?</span>
          <h3>تحتاج مساعدة في حسابك؟</h3>
          <p>سجّل الدخول للوصول إلى حسابك وإدارة متجرك من مكان واحد.</p>
          <span className="xc-help-link">الذهاب لتسجيل الدخول <b>←</b></span>
        </aside>
      </section>
    </main>
  );
}
