import Link from "next/link";
import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function EnterpriseHomePage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const citiesCount = (
    db.prepare("SELECT COUNT(*) AS c FROM cities WHERE organization_id = ? OR is_public = 1").get(orgId) as { c: number }
  ).c;
  const datasetsCount = (
    db.prepare("SELECT COUNT(*) AS c FROM datasets WHERE organization_id = ?").get(orgId) as { c: number }
  ).c;
  const workbooksCount = ctx.isCareerFestVisitor
    ? (
        db
          .prepare(
            "SELECT COUNT(*) AS c FROM workbooks WHERE organization_id = ? AND is_archived = 0 AND (owner_session_id IS NULL OR owner_session_id = ?)"
          )
          .get(orgId, ctx.sessionId) as { c: number }
      ).c
    : (
        db
          .prepare("SELECT COUNT(*) AS c FROM workbooks WHERE organization_id = ? AND is_archived = 0")
          .get(orgId) as { c: number }
      ).c;
  const activeAlertsCount = (
    db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE organization_id = ? AND status = 'ACTIVE'").get(orgId) as { c: number }
  ).c;

  const recentAlerts = normalizeRows<{
    id: string;
    title: string;
    priority: string;
    division_code: string;
    data_status: string;
  }>(
    db
      .prepare("SELECT id, title, priority, division_code, data_status FROM alerts WHERE organization_id = ? ORDER BY created_at DESC LIMIT 5")
      .all(orgId)
  );

  const recentWorkbooks = ctx.isCareerFestVisitor
    ? normalizeRows<{
        id: string;
        title: string;
        division_code: string | null;
        updated_at: string;
      }>(
        db
          .prepare(
            "SELECT id, title, division_code, updated_at FROM workbooks WHERE organization_id = ? AND is_archived = 0 AND (owner_session_id IS NULL OR owner_session_id = ?) ORDER BY updated_at DESC LIMIT 4"
          )
          .all(orgId, ctx.sessionId)
      )
    : normalizeRows<{
        id: string;
        title: string;
        division_code: string | null;
        updated_at: string;
      }>(
        db
          .prepare("SELECT id, title, division_code, updated_at FROM workbooks WHERE organization_id = ? AND is_archived = 0 ORDER BY updated_at DESC LIMIT 4")
          .all(orgId)
      );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div className="sg-card-gold">
        <div className="sg-eyebrow">Authenticated Workspace Home · {ctx.organizationName}</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.35rem" }}>
          Welcome back, {ctx.fullName}
        </h1>
        <p className="sg-muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Role: <strong style={{ color: "var(--sg-gold)" }}>{ctx.roleCode}</strong> · Tenant Scope:{" "}
          <code>{ctx.organizationSlug}</code> · Truthful provenance active across all 24 Urban Intelligence Divisions.
        </p>
        <div style={{ display: "flex", gap: "0.65rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <Link href="/app/command-center" className="sg-btn sg-btn-primary">Global Command Center</Link>
          <Link href="/app/sheets" className="sg-btn sg-btn-outline">Open SMART GRID SHEETS</Link>
          <Link href="/app/ai" className="sg-btn sg-btn-outline">Open SMART GRID AI</Link>
          <Link href="/app/divisions" className="sg-btn sg-btn-ghost">Browse 24 Divisions</Link>
        </div>
      </div>

      <div className="sg-grid sg-grid-4">
        <div className="sg-card">
          <div className="sg-eyebrow">Authorized Cities</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem" }}>{citiesCount}</div>
          <Link href="/app/cities" className="sg-muted" style={{ fontSize: "0.82rem" }}>Manage City Network →</Link>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">Tenant Datasets</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem" }}>{datasetsCount}</div>
          <Link href="/app/data-catalog" className="sg-muted" style={{ fontSize: "0.82rem" }}>Inspect Data Catalog →</Link>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">Active Alerts</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--sg-gold)", marginTop: "0.25rem" }}>{activeAlertsCount}</div>
          <Link href="/app/alerts" className="sg-muted" style={{ fontSize: "0.82rem" }}>Review Alert Center →</Link>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">SHEETS Workbooks</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem" }}>{workbooksCount}</div>
          <Link href="/app/sheets" className="sg-muted" style={{ fontSize: "0.82rem" }}>Launch Spreadsheet Studio →</Link>
        </div>
      </div>

      <div className="sg-grid sg-grid-2">
        <div className="sg-card">
          <h2 className="sg-h3">Recent Tenant Alerts</h2>
          <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.75rem" }}>
            {recentAlerts.length === 0 ? (
              <p className="sg-muted">No active alerts in this tenant.</p>
            ) : (
              recentAlerts.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", padding: "0.65rem", borderRadius: "var(--sg-radius-sm)", border: "1px solid var(--sg-border)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{a.title}</div>
                    <div className="sg-muted" style={{ fontSize: "0.78rem" }}>Division {a.division_code} · Priority: {a.priority}</div>
                  </div>
                  <StatusBadge status={a.data_status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sg-card">
          <h2 className="sg-h3">Recent SMART GRID SHEETS Workbooks</h2>
          <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.75rem" }}>
            {recentWorkbooks.length === 0 ? (
              <p className="sg-muted">No workbooks created yet. Open SHEETS to create a template or import a dataset.</p>
            ) : (
              recentWorkbooks.map((w) => (
                <Link
                  key={w.id}
                  href={`/app/sheets?id=${w.id}`}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem", borderRadius: "var(--sg-radius-sm)", border: "1px solid var(--sg-border)" }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{w.title}</div>
                    <div className="sg-muted" style={{ fontSize: "0.78rem" }}>Division {w.division_code || "Cross-Division"}</div>
                  </div>
                  <span className="sg-badge sg-badge-gold">Open →</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="sg-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 className="sg-h3" style={{ margin: 0 }}>24 Urban Intelligence Divisions Quick Access</h2>
          <Link href="/app/divisions" className="sg-badge sg-badge-gold">View All 24</Link>
        </div>
        <div className="sg-grid sg-grid-4">
          {DIVISIONS.slice(0, 8).map((d) => (
            <Link key={d.code} href={`/app/divisions/${d.slug}`} className="sg-card" style={{ padding: "0.85rem" }}>
              <div className="sg-eyebrow">Division {d.code}</div>
              <div style={{ fontWeight: 700, fontSize: "0.92rem", marginTop: "0.2rem" }}>{d.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
