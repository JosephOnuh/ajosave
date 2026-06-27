"use client";

import { useState, useRef, useEffect } from "react";
import { useFreighterWallet } from "@/hooks/useFreighterWallet";
import styles from "./FreighterWalletStatus.module.css";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function FreighterWalletStatus() {
  const { connectionState, publicKey, error, connect, disconnect } = useFreighterWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (connectionState === "not_installed") {
    return (
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.pill}
        aria-label="Install Freighter wallet"
      >
        <span className={`${styles.dot} ${styles.dotOff}`} aria-hidden="true" />
        Install Freighter
      </a>
    );
  }

  if (connectionState === "disconnected" || connectionState === "connecting") {
    return (
      <button
        className={styles.pill}
        onClick={connect}
        disabled={connectionState === "connecting"}
        aria-label={connectionState === "connecting" ? "Connecting wallet…" : "Connect Freighter wallet"}
      >
        <span className={`${styles.dot} ${styles.dotOff}`} aria-hidden="true" />
        {connectionState === "connecting" ? "Connecting…" : "Connect Wallet"}
        {error && <span className={styles.srOnly}> — {error}</span>}
      </button>
    );
  }

  // connected
  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.pill} ${styles.pillConnected}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Wallet connected: ${publicKey}. Open wallet options`}
      >
        <span className={`${styles.dot} ${styles.dotOn}`} aria-hidden="true" />
        {truncateAddress(publicKey!)}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <p className={styles.fullAddress} role="menuitem" aria-label={`Full address: ${publicKey}`}>
            {truncateAddress(publicKey!)}
          </p>
          <button
            className={styles.disconnectBtn}
            role="menuitem"
            onClick={() => { disconnect(); setOpen(false); }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
