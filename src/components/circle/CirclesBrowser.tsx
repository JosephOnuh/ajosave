"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CircleCard } from "@/components/circle/CircleCard";

interface Props {
  initialData: { data: any[]; total: number; page: number; limit: number };
  initialQuery: Record<string, string | undefined>;
}

export default function CirclesBrowser({ initialData, initialQuery }: Props) {
  const [circles, setCircles] = useState(initialData.data || []);
  const [total, setTotal] = useState(initialData.total || 0);
  const [page, setPage] = useState(initialData.page || 1);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ ...(initialQuery as any), page: String(p), limit: String(initialData.limit) });
    const res = await fetch(`/api/v1/circles?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      setCircles((prev) => [...prev, ...json.data.data]);
      setTotal(json.data.total);
      setPage(json.data.page);
    }
    setLoading(false);
  }, [initialQuery, initialData.limit]);

  useEffect(() => {
    if (!sentinel.current) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((ent) => {
        if (ent.isIntersecting && !loading && circles.length < total) {
          fetchPage(page + 1).catch(() => {});
        }
      });
    }, { root: null, rootMargin: '0px', threshold: 0.8 });
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [sentinel, loading, circles.length, total, page, fetchPage]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>Showing {circles.length} of {total} circles</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {circles.map((c) => (
          <CircleCard key={c.id} circle={c} members={[]} showJoin />
        ))}
      </div>

      <div ref={sentinel} style={{ height: '1px' }} aria-hidden />

      {loading && <div style={{ padding: '1rem', textAlign: 'center' }}>Loading…</div>}
    </div>
  );
}
