import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AnalyticsStudioPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const dashboards = normalizeRows<{ id: string; title: string; description: string; widgets_json: string }>(
    db.prepare("SELECT * FROM dashboards WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)
  );

  const kpis = normalizeRows<{ code: string; division_code: string; name: string; unit: string; formula_text: string }>(
    db
      .prepare(
        "SELECT code, division_code, name, unit, formula_text FROM kpi_definitions WHERE organization_id IS NULL OR organization_id = ? ORDER BY division_code ASC LIMIT 24"
      )
      .all(orgId)
  );

  const stats = normalizeRows<{ division_code: string; metric_name: string; unit: string; avg_val: number; min_val: number; max_val: number; cnt: number; data_status: string }>(
    db
      .prepare(
        `SELECT division_code, metric_name, unit, data_status,
                ROUND(AVG(metric_value), 2) AS avg_val,
                ROUND(MIN(metric_value), 2) AS min_val,
                ROUND(MAX(metric_value), 2) AS max_val,
                COUNT(*) AS cnt
         FROM observations
         WHERE organization_id = ?
         GROUP BY division_code, metric_name, unit, data_status`
      )
      .all(orgId)
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <div className="sg-eyebrow">Analytics, KPIs &amp; Dashboards</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>Analytics Studio &amp; KPI Registry</h1>
        <p className="sg-muted" style={{ margin: 0 }}>
          Cross-division statistical aggregations, standardized KPI formulas, and organization dashboards.
        </p>
      </div>

      <div className="sg-card">
        <h2 className="sg-h3">Observation Aggregations (Source-Attributed)</h2>
        {stats.length === 0 ? (
          <p className="sg-muted">No observations available yet.</p>
        ) : (
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead><tr><th>Division</th><th>Metric</th><th>Samples</th><th>Min</th><th>Mean</th><th>Max</th><th>Status</th></tr></thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={`${s.division_code}-${s.metric_name}`}>
                    <td className="sg-mono">Div {s.division_code}</td>
                    <td style={{ fontWeight: 600 }}>{s.metric_name} ({s.unit})</td>
                    <td className="sg-mono">{s.cnt}</td>
                    <td className="sg-mono">{s.min_val}</td>
                    <td className="sg-mono" style={{ color: "var(--sg-gold)", fontWeight: 700 }}>{s.avg_val}</td>
                    <td className="sg-mono">{s.max_val}</td>
                    <td><StatusBadge status={s.data_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sg-grid-2">
        <div className="sg-card">
          <h2 className="sg-h3">Configured Dashboards ({dashboards.length})</h2>
          {dashboards.map((d) => (
            <div key={d.id} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.6rem", marginBottom: "0.6rem" }}>
              <div style={{ fontWeight: 700 }}>{d.title}</div>
              <div className="sg-muted" style={{ fontSize: "0.82rem" }}>{d.description}</div>
            </div>
          ))}
        </div>

        <div className="sg-card">
          <h2 className="sg-h3">Standardized KPI Registry (Sample)</h2>
          <div style={{ maxHeight: 280, overflowY: "auto", display: "grid", gap: "0.45rem" }}>
            {kpis.map((k) => (
              <div key={k.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.35rem" }}>
                <span><strong>{k.code}</strong> · {k.name}</span>
                <span className="sg-mono sg-muted">{k.formula_text} ({k.unit})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
