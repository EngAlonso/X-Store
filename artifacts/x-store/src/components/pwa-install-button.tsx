import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import "./pwa-install-button.css";

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

function isRunningAsInstalledApp(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isAppleMobile(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function PwaInstallButton() {
  const [installed, setInstalled] = useState(isRunningAsInstalledApp);
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as DeferredInstallPrompt);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("has-pwa-install-button", !installed);
    return () => document.documentElement.classList.remove("has-pwa-install-button");
  }, [installed]);

  async function installOrShowHelp() {
    if (!installPrompt) {
      setHelpOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setInstalled(true);
      else setHelpOpen(true);
    } catch {
      setInstallPrompt(null);
      setHelpOpen(true);
    }
  }

  if (installed) return null;

  return (
    <>
      <button
        className="pwa-install-button"
        type="button"
        onClick={() => void installOrShowHelp()}
        aria-haspopup="dialog"
        aria-expanded={helpOpen}
      >
        <Download size={18} aria-hidden="true" />
        <span>تثبيت التطبيق</span>
      </button>

      {helpOpen && (
        <div className="pwa-install-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setHelpOpen(false);
        }}>
          <section
            className="pwa-install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
          >
            <button
              className="pwa-install-close"
              type="button"
              aria-label="إغلاق"
              onClick={() => setHelpOpen(false)}
            >
              <X size={18} />
            </button>
            <span className="pwa-install-dialog-icon"><Download size={22} /></span>
            <h2 id="pwa-install-title">تثبيت X-Store</h2>
            {isAppleMobile() ? (
              <ol>
                <li>افتح الموقع في Safari واضغط زر المشاركة.</li>
                <li>اختر «إضافة إلى الشاشة الرئيسية» ثم اضغط «إضافة».</li>
              </ol>
            ) : (
              <ol>
                <li>افتح قائمة المتصفح.</li>
                <li>اختر «تثبيت التطبيق» أو «Install app».</li>
              </ol>
            )}
            <button className="pwa-install-confirm" type="button" onClick={() => setHelpOpen(false)}>
              فهمت
            </button>
          </section>
        </div>
      )}
    </>
  );
}
