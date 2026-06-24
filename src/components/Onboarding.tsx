"use client";

import { useEffect, useState } from "react";
import styles from "./Onboarding.module.css";

const STORAGE_KEY = "ajosave:onboarding";

const STEPS = [
  { key: "welcome", title: "Welcome", subtitle: "Welcome to Ajosave" },
  { key: "wallet", title: "Wallet Connect", subtitle: "Connect your Stellar wallet (Freighter)" },
  { key: "how", title: "How Ajo Works", subtitle: "Rotating savings circles: pool funds, take turns receiving the pot" },
  { key: "first", title: "First Circle", subtitle: "Create or join your first circle" },
];

export function Onboarding({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<number>(0);
  const [inProgress, setInProgress] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || { seen: false, step: 0 };
    } catch { return { seen: false, step: 0 }; }
  });

  useEffect(() => {
    setStep(inProgress.step || 0);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...inProgress, step }));
  }, [step]);

  const finish = (seen = true) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: seen, step }));
    onClose?.();
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <button aria-label="Close onboarding" className={styles.close} onClick={() => finish(false)}>✕</button>
        <h2>{STEPS[step].subtitle}</h2>

        <div className={styles.progress} aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s.key} className={`${styles.step} ${i === step ? styles.active : ""}`}>
              <span className={styles.stepDot}>{i + 1}</span>
            </div>
          ))}
        </div>

        <div className={styles.content}>
          {step === 0 && (
            <div>
              <h3>Welcome to Ajosave</h3>
              <p>Rotating savings circles powered by Stellar and USDC — pool funds, take turns receiving the pot.</p>
            </div>
          )}
          {step === 1 && (
            <div>
              <h3>Connect Wallet</h3>
              <p>Connect your Stellar wallet (Freighter) to send/receive USDC on-chain. You can skip and connect later.</p>
            </div>
          )}
          {step === 2 && (
            <div>
              <h3>How Ajo Works</h3>
              <ul>
                <li>Create or join a circle</li>
                <li>Contribute regularly</li>
                <li>Members take turns receiving the pooled funds</li>
              </ul>
            </div>
          )}
          {step === 3 && (
            <div>
              <h3>Your First Circle</h3>
              <p>Choose to create a new circle or browse open circles to join and start saving together.</p>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <button className="btn btn--ghost" onClick={() => { finish(false); }}>Dismiss</button>
          <div>
            {step > 0 && <button className="btn btn--ghost" onClick={() => setStep(s => Math.max(0, s - 1))}>Back</button>}
            {step < STEPS.length - 1 && <button className="btn btn--primary" onClick={() => setStep(s => s + 1)}>Next</button>}
            {step === STEPS.length - 1 && <button className="btn btn--primary" onClick={() => finish(true)}>Get started</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
