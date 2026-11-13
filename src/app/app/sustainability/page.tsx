import Link from "next/link";
import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const SDG_MAPPINGS = [
  { sdg: "SDG 6 — Clean Water & Sanitation", divisions: "08 Water & Wastewater · 09 Waste & Sanitation", metric: "Water Quality & Non-Revenue Loss" },
  { sdg: "SDG 7 — Affordable & Clean Energy", divisions: "07 Energy & Power Grid · 22 Public Lighting", metric: "Renewable Share & LED Conversion" },
  { sdg: "SDG 11 — Sustainable Cities & Communities", divisions: "04 Public Transit · 05 Air Quality · 13 Urban Planning · 23 Parks", metric: "PM2.5 Mean, Transit Access & 10-Min Park Access" },
  { sdg: "SDG 13 — Climate Action", divisions: "06 Weather & Climate · 10 Disaster & Climate Risk", metric: "Heat Anomaly & Hazard Exposure" },
];

export default async function SustainabilityPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const obs = normalizeRows<{ metric_name: string; metric_value: number; unit: string; data_status: string; division_code: string }>(
    db
      .prepare("SELECT metric_name, metric_value, unit, data_status, division_code FROM observations WHERE organization_id = ? AND division_code IN ('05','07','08','09','10') ORDER BY observed_at DESC LIMIT 8")
      .all(ctx.organizationId)
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <div className="sg-eyebrow">UN SDG Alignment</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Sustainability &amp; SDG Intelligence</h1>
        <p className="sg-muted" style={{ margin: 0 }}>
          Maps SMART GRID divisions and verified indicators directly to Sustainable Development Goal targets.
        </p>
      </div>

      <div className="sg-grid-2">
        {SDG_MAPPINGS.map((m) => (
          <div key={m.sdg} className="sg-card">
            <div className="sg-eyebrow">{m.divisions}</div>
            <h2 className="sg-h3" style={{ marginTop: "0.3rem" }}>{m.sdg}</h2>
            <p className="sg-muted" style={{ margin: 0, fontSize: "0.86rem" }}>Tracked Indicators: {m.metric}</p>
          </div>
        ))}
      </div>

      <div className="sg-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 className="sg-h3" style={{ margin: 0 }}>Recent Sustainability-Linked Observations</h2>
          <Link href="/app/scenarios" className="sg-btn sg-btn-outline" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>Model Scenarios</Link>
        </div>
        <div className="sg-table-wrap">
          <table className="sg-table">
            <thead><tr><th>Division</th><th>Metric</th><th>Value</th><th>Status</th></tr></thead>
            <tbody>
              {obs.map((o, idx) => (
                <tr key={idx}>
                  <td className="sg-mono">Div {o.division_code}</td>
                  <td>{o.metric_name}</td>
                  <td className="sg-mono" style={{ color: "var(--sg-gold)" }}>{o.metric_value} {o.unit}</td>
                  <td><StatusBadge status={o.data_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
