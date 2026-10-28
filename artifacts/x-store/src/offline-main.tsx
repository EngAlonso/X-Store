import { createRoot } from "react-dom/client";
import OfflineApp from "./offline/OfflineApp";

import "./offline/offline.css";

createRoot(document.getElementById("offline-root")!).render(<OfflineApp />);
