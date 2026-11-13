"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

interface SubscriptionRow {
  plan_code: string;
  status: string;
  seat_limit: number;
  storage_limit_mb: number;
  ai_monthly_quota: number;
  current_period_start: string;
  current_period_end: string;
}

const PLANS = [
  { code: "STARTER", label: "Starter Municipal", seats: 10, storage: "2 GB", aiQuota: 250 },
  { code: "PROFESSIONAL", label: "Professional City", seats: 30, storage: "5 GB", aiQuota: 600 },
  { code: "ENTERPRISE", label: "Enterprise Grid", seats: 100, storage: "25 GB", aiQuota: 2500 },
  { code: "CITY_NETWORK", label: "Global City Network", seats: 500, storage: "100 GB", aiQuota: 10000 },
];

export function BillingClient({
  initialSub,
  usage,
  memberCount,
}: {
  initialSub: SubscriptionRow | null;
  usage: { metric_type: string; total: number }[];
  memberCount: number;
}) {
  const [sub, setSub] = useState<SubscriptionRow | null>(initialSub);
  const [notice, setNotice] = useState("");

  async function selectPlan(planCode: string) {
    setNotice("");
    const res = await fetch("/api/v1/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_PLAN", planCode }),
    });
    if (res.ok) {
      const updated = await fetch("/api/v1/admin?scope=billing").then((r) => r.json());
      if (updated.data?.subscription) setSub(updated.data.subscription);
      setNotice(`Subscription plan switched to ${planCode} (internal evaluation/quota mode — no payment gateway connected).`);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card">
        <span className="sg-badge sg-badge-gold">Billing, Quotas & Entitlements</span>
        <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Subscription & Usage Metering</h1>
        <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
          Inspect tenant seat utilization, AI query consumption, and storage quotas. External payment processor: <strong>INTEGRATION_REQUIRED</strong> (local quota controls active).
        </p>
      </div>

      {notice && <div className="sg-badge sg-badge-gold">{notice}</div>}

      <div className="sg-grid sg-grid-3">
        <div className="sg-card">
          <div className="sg-muted" style={{ fontSize: "0.8rem" }}>Active Plan</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--sg-gold)", marginTop: "0.25rem" }}>{sub?.plan_code || "UNASSIGNED"}</div>
          <div className="sg-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>Status: {sub?.status || "N/A"}</div>
        </div>
        <div className="sg-card">
          <div className="sg-muted" style={{ fontSize: "0.8rem" }}>Seated Members</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>{memberCount} / {sub?.seat_limit || 0}</div>
        </div>
        <div className="sg-card">
          <div className="sg-muted" style={{ fontSize: "0.8rem" }}>Monthly AI Quota</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>{sub?.ai_monthly_quota?.toLocaleString() || 0} reqs</div>
        </div>
      </div>

      <div className="sg-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
          <CreditCard size={18} style={{ color: "var(--sg-gold)" }} />
          <h2 style={{ fontSize: "1.15rem" }}>Plan Tiers & Quota Allocation</h2>
        </div>
        <div className="sg-grid sg-grid-4">
          {PLANS.map((p) => {
            const active = sub?.plan_code === p.code;
            return (
              <div
                key={p.code}
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${active ? "var(--sg-gold)" : "var(--border-subtle)"}`,
                  background: "var(--bg-elevated)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <strong>{p.label}</strong>
                <div className="sg-muted" style={{ fontSize: "0.82rem" }}>Seats: {p.seats} · Storage: {p.storage}</div>
                <div className="sg-muted" style={{ fontSize: "0.82rem" }}>AI Quota: {p.aiQuota}/mo</div>
                <button
                  type="button"
                  className={`sg-btn ${active ? "sg-btn-primary" : "sg-btn-secondary"}`}
                  style={{ marginTop: "auto" }}
                  disabled={active}
                  onClick={() => selectPlan(p.code)}
                >
                  {active ? "Current Plan" : "Apply Tier"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sg-card">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Recorded Metered Usage</h2>
        {usage.length === 0 ? (
          <p className="sg-muted">No usage events metered yet in the current billing period.</p>
        ) : (
          <table className="sg-table">
            <thead>
              <tr>
                <th>Metric Type</th>
                <th>Recorded Quantity</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.metric_type}>
                  <td><code>{u.metric_type}</code></td>
                  <td><strong>{Number(u.total).toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
