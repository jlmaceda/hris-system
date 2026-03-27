import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from "virtual:pwa-register";
import { syncOfflineAttendanceQueue } from "@/lib/attendance-records";

registerSW({
  immediate: true,
  onOfflineReady: () => {
    console.log("PWA ready: offline support is enabled.");
  },
  onNeedRefresh: () => {
    console.log("New content available. Refresh to update.");
  },
});

// Attempt offline sync on startup and whenever the device comes back online.
if (typeof window !== "undefined") {
  void syncOfflineAttendanceQueue().catch(() => {});
  window.addEventListener("online", () => {
    void syncOfflineAttendanceQueue().catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
