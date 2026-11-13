import Link from "next/link";
import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const incidents = normalizeRows<{
    id: string;
    title: string;
    severity: string;
    status: string;
    division_code: string;
    created_at: string;
  }>(db.prepare("SELECT * FROM incidents WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 8").all(orgId));

  const workOrders = normalizeRows<{
    id: string;
    title: string;
    priority: string;
    status: string;
    division_code: string;
  }>(db.prepare("SELECT * FROM work_orders WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 8").all(orgId));

  const sources = normalizeRows<{
    id: string;
    name: string;
    division_code: string;
    status: string;
  }>(db.prepare("SELECT id, name, division_code, status FROM data_sources WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId));

  const cities = normalizeRows<{
    id: string;
    name: string;
    slug: string;
    readiness_score: number;
    data_status: string;
  }>(
    db
      .prepare("SELECT id, name, slug, readiness_score, data_status FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC")
      .all(orgId)
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div className="sg-card">
        <div className="sg-eyebrow">Division 01 · City Governance &amp; Command</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>Global Command Center</h1>
        <p className="sg-muted" style={{ margin: 0 }}>
          Cross-city situational posture, open incidents, active maintenance work orders, and data connector readiness.
        </p>
      </div>

      <div className="sg-grid sg-grid-3">
        <div className="sg-card">
          <div className="sg-eyebrow">Active City Profiles</div>
          <div style={{ fontSize: "1.9rem", fontWeight: 800, marginTop: "0.25rem" }}>{cities.length}</div>
          <div className="sg-muted" style={{ fontSize: "0.82rem" }}>Evaluated against readiness benchmarks</div>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">Open Incidents</div>
          <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--sg-gold)", marginTop: "0.25rem" }}>
            {incidents.filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED").length}
          </div>
          <Link href="/app/operations" className="sg-muted" style={{ fontSize: "0.82rem" }}>Manage Operations →</Link>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">Data Connectors</div>
          <div style={{ fontSize: "1.9rem", fontWeight: 800, marginTop: "0.25rem" }}>{sources.length}</div>
          <Link href="/app/integrations" className="sg-muted" style={{ fontSize: "0.82rem" }}>Inspect Integration Hub →</Link>
        </div>
      </div>

      <div className="sg-grid sg-grid-2">
        <div className="sg-card">
          <h2 className="sg-h3">City Readiness Posture</h2>
          <div className="sg-table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th>Readiness</th>
                  <th>Data Status</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/app/cities/${c.slug}`} style={{ fontWeight: 600, color: "var(--sg-gold)" }}>
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.readiness_score}/100</td>
                    <td><StatusBadge status={c.data_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sg-card">
          <h2 className="sg-h3">Connector &amp; Integration Health</h2>
          <div className="sg-table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Div</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.division_code}</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="sg-grid sg-grid-2">
        <div className="sg-card">
          <h2 className="sg-h3">Incidents Queue ({incidents.length})</h2>
          <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.75rem" }}>
            {incidents.map((inc) => (
              <div key={inc.id} style={{ padding: "0.65rem", borderRadius: "var(--sg-radius-sm)", border: "1px solid var(--sg-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{inc.title}</strong>
                  <div className="sg-muted" style={{ fontSize: "0.78rem" }}>Division {inc.division_code} · Severity: {inc.severity}</div>
                </div>
                <span className="sg-badge sg-badge-gold">{inc.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sg-card">
          <h2 className="sg-h3">Maintenance Work Orders ({workOrders.length})</h2>
          <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.75rem" }}>
            {workOrders.map((wo) => (
              <div key={wo.id} style={{ padding: "0.65rem", borderRadius: "var(--sg-radius-sm)", border: "1px solid var(--sg-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{wo.title}</strong>
                  <div className="sg-muted" style={{ fontSize: "0.78rem" }}>Division {wo.division_code} · Priority: {wo.priority}</div>
                </div>
                <span className="sg-badge sg-badge-white">{wo.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
