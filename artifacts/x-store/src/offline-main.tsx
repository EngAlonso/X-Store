import { createRoot } from "react-dom/client";
import OfflineApp from "./offline/OfflineApp";
import IntroSplash from "./components/intro-splash";

import "./offline/offline.css";

createRoot(document.getElementById("offline-root")!).render(
  <>
    <IntroSplash videoSrc="./x-store-intro.mp4" />
    <OfflineApp />
  </>,
);
