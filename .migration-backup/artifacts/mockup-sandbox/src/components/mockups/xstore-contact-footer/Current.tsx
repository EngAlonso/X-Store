import { ArrowUpLeft } from "lucide-react";
import "./_group.css";

export function Current() {
  return (
    <main className="xf-stage">
      <footer className="xf-current">
        <a className="xf-current-brand" href="/">
          <img src="/__mockup/images/x-store-mark.png" alt="" />
          <span>X-Store</span>
        </a>
        <span className="xf-current-tagline">إدارة أوضح. متجر أقوى.</span>
        <a className="xf-current-link" href="/">
          العودة إلى الرئيسية <ArrowUpLeft size={15} />
        </a>
      </footer>
    </main>
  );
}
