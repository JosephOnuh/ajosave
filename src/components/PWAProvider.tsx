"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ajosave:pwa-dismiss-until";
const PROMPT_VISITS_KEY = "ajosave:pwa-visits";

export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const visited = Number(localStorage.getItem(PROMPT_VISITS_KEY) ?? 0) + 1;
    localStorage.setItem(PROMPT_VISITS_KEY, String(visited));

    if (dismissedUntil > Date.now()) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      if (visited >= 2) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setShowBanner(false);
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    const until = Date.now() + 1000 * 60 * 60 * 24 * 7;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div style={{
      position: "fixed", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
      background: "var(--color-bg-surface)", border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-xl)", padding: "1rem 1.5rem",
      display: "flex", alignItems: "center", gap: "1rem",
      boxShadow: "var(--shadow-md)", zIndex: 999, maxWidth: "calc(100vw - 2rem)",
    }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
        Install Ajosave to use it faster on your device.
      </span>
      <button className="btn btn--primary btn--sm" onClick={handleInstall}>Install</button>
      <button className="btn btn--ghost btn--sm" onClick={handleDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
