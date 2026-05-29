"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import styles from "./ContributeButton.module.css";

interface Props {
  circleId: string;
  circleName: string;
  amountNgn: number;
  cycleFrequency: string;
  currentCycle: number;
}

export function ContributeButton({ circleId, circleName, amountNgn, cycleFrequency, currentCycle }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Stellar network fee estimate (fixed low fee)
  const feeEstimate = "~0.00001 XLM";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/contribute`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast("Redirecting to payment…", "info");
      window.location.href = json.data.authorizationUrl;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to initiate payment", "error");
      setLoading(false);
      setShowModal(false);
    }
  };

  return (
    <>
      <Button variant="accent" onClick={() => setShowModal(true)}>
        Contribute Now
      </Button>

      {showModal && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className={styles.modal}>
            <h2 id="confirm-title" className={styles.title}>Confirm Contribution</h2>

            <dl className={styles.details}>
              <div className={styles.row}>
                <dt>Circle</dt>
                <dd>{circleName}</dd>
              </div>
              <div className={styles.row}>
                <dt>Amount</dt>
                <dd>₦{amountNgn.toLocaleString("en-NG")}</dd>
              </div>
              <div className={styles.row}>
                <dt>Cycle</dt>
                <dd>Cycle {currentCycle} ({cycleFrequency})</dd>
              </div>
              <div className={styles.row}>
                <dt>Network Fee</dt>
                <dd>{feeEstimate}</dd>
              </div>
            </dl>

            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => setShowModal(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="accent" onClick={handleConfirm} loading={loading}>
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
