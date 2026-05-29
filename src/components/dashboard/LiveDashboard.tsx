"use client";

import { useCallback, useState } from "react";
import type { Circle } from "@/types";
import { CircleCard } from "@/components/circle/CircleCard";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { usePolling } from "@/hooks/usePolling";
import Link from "next/link";
import styles from "./LiveDashboard.module.css";

interface LiveDashboardProps {
  initialCircles: Circle[];
}

export function LiveDashboard({ initialCircles }: LiveDashboardProps) {
  const [circles, setCircles] = useState<Circle[]>(initialCircles);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [newCirclesCount, setNewCirclesCount] = useState(0);

  const fetchCircles = useCallback(async () => {
    const res = await fetch("/api/v1/circles?filter=mine");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data as Circle[];
  }, []);

  const { isConnected } = usePolling({
    fetchFn: fetchCircles,
    interval: 10000, // Poll every 10 seconds for user dashboard
    enabled: true,
    onSuccess: (data) => {
      const prevCount = circles.length;
      const newCount = data.length;
      if (prevCount > 0 && newCount > prevCount) {
        setNewCirclesCount(newCount - prevCount);
        setTimeout(() => setNewCirclesCount(0), 3000);
      }
      setCircles(data);
      setLastUpdate(new Date());
    },
  });

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>My Circles</h1>
        <div className={styles.headerActions}>
          <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate || undefined} />
          <Link href="/circles/create" className="btn btn--accent">
            + New Circle
          </Link>
        </div>
      </div>

      {newCirclesCount > 0 && (
        <div className={styles.newItemsBanner}>
          🎉 {newCirclesCount} new circle{newCirclesCount !== 1 ? "s" : ""} available!
        </div>
      )}

      {circles.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIllustration} aria-hidden="true">
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Empty savings circle">
              <circle cx="48" cy="48" r="44" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="6 4" />
              <circle cx="48" cy="20" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-brand-primary)" strokeWidth="2" />
              <circle cx="72" cy="34" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
              <circle cx="72" cy="62" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
              <circle cx="48" cy="76" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
              <circle cx="24" cy="62" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
              <circle cx="24" cy="34" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
              <circle cx="48" cy="48" r="10" fill="var(--color-brand-primary)" opacity="0.15" />
              <text x="48" y="53" textAnchor="middle" fontSize="14" fill="var(--color-brand-primary)">₦</text>
            </svg>
          </div>
          <h2 className={styles.emptyTitle}>Start your savings journey</h2>
          <p className={styles.emptyText}>
            You haven&apos;t joined any circles yet. Create your own or browse open circles to get started.
          </p>
          <div className={styles.emptyCtas}>
            <Link href="/circles/create" className="btn btn--primary">
              Create your first circle
            </Link>
            <Link href="/circles" className="btn btn--secondary">
              Browse circles
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} members={[]} />
          ))}
        </div>
      )}
    </>
  );
}
