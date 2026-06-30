import Link from "next/link";

const cachedCircles = [
  { id: "demo-1", name: "Lagos Monthly Ajo", members: 4, maxMembers: 8 },
  { id: "demo-2", name: "Abuja Save Together", members: 6, maxMembers: 10 },
];

export default function OfflinePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "1rem", textAlign: "center", padding: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--color-text-primary)" }}>You&apos;re offline</h1>
      <p style={{ color: "var(--color-text-secondary)", maxWidth: "480px" }}>
        No internet connection. You can still review cached circles and return later when your connection is back.
      </p>
      <div style={{ display: "grid", gap: "0.75rem", width: "min(100%, 420px)", marginTop: "0.5rem" }}>
        {cachedCircles.map((circle) => (
          <div key={circle.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1rem", textAlign: "left" }}>
            <strong>{circle.name}</strong>
            <div style={{ color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
              {circle.members}/{circle.maxMembers} members · Read-only view
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
        <Link href="/" style={{ color: "var(--color-brand-primary)", textDecoration: "underline" }}>Go to home</Link>
        <Link href="/dashboard" style={{ color: "var(--color-brand-primary)", textDecoration: "underline" }}>Open dashboard</Link>
      </div>
    </div>
  );
}
