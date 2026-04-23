"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ContributeButton({ circleId }: { circleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContribute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/contribute`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      window.location.href = json.data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate payment");
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="accent" onClick={handleContribute} loading={loading}>
        Contribute Now
      </Button>
      {error && (
        <p style={{ marginTop: "0.5rem", fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
