export default function EnterpriseLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: "grid", gap: "1rem", padding: "1.5rem 0" }}
    >
      <div className="sg-card" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span className="sg-badge sg-badge-gold">Loading</span>
        <span className="sg-muted" style={{ fontSize: "0.9rem" }}>
          Synchronizing tenant-scoped urban intelligence data…
        </span>
      </div>
    </div>
  );
}
