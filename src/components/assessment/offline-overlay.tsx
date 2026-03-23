"use client";

import { useState, useEffect } from "react";

export function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    // Check initial state — use callback form to avoid synchronous setState in effect
    if (!navigator.onLine) requestAnimationFrame(() => setIsOffline(true));

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "8px 16px",
        textAlign: "center",
        background: "rgba(202, 138, 4, 0.15)",
        borderBottom: "1px solid rgba(202, 138, 4, 0.3)",
        color: "#fbbf24",
        fontSize: "12px",
        fontFamily: "var(--font-display, system-ui)",
        fontWeight: 500,
        animation: "cardIn 0.3s ease both",
      }}
    >
      You appear to be offline. Your progress is saved — reconnect to continue.
    </div>
  );
}
