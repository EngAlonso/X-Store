import { useEffect, useState } from "react";
import "./intro-splash.css";

function shouldShowIntro(): boolean {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function IntroSplash({ videoSrc = "/x-store-intro.mp4", desktopVideoSrc = "/x-store-intro-desktop.mp4" }: { videoSrc?: string; desktopVideoSrc?: string }) {
  const [visible, setVisible] = useState(shouldShowIntro);

  useEffect(() => {
    if (!visible) return;
    const fallback = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(fallback);
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => setVisible(false);
  return (
    <div className="x-store-intro" role="dialog" aria-label="مقدمة X-Store">
      <video
        className="x-store-intro-video"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        onCanPlay={(event) => {
          void event.currentTarget.play().catch(dismiss);
        }}
      >
        <source media="(min-width: 768px)" src={desktopVideoSrc} type="video/mp4" />
        <source src={videoSrc} type="video/mp4" />
      </video>
      <button className="x-store-intro-skip" type="button" onClick={dismiss}>
        تخطي المقدمة
      </button>
    </div>
  );
}
