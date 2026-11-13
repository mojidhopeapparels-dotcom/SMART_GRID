import Link from "next/link";
import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EnterpriseDivisionsPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const dsCounts = normalizeRows<{ division_code: string; cnt: number }>(
    db.prepare("SELECT division_code, COUNT(*) AS cnt FROM datasets WHERE organization_id = ? GROUP BY division_code").all(orgId)
  );
  const srcRows = normalizeRows<{ division_code: string; status: string }>(
    db.prepare("SELECT division_code, status FROM data_sources WHERE organization_id = ?").all(orgId)
  );
  const alertCounts = normalizeRows<{ division_code: string; cnt: number }>(
    db.prepare("SELECT division_code, COUNT(*) AS cnt FROM alerts WHERE organization_id = ? AND status = 'ACTIVE' GROUP BY division_code").all(orgId)
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <div className="sg-eyebrow">Standardized Urban Intelligence</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>24 Intelligence Divisions</h1>
        <p className="sg-muted" style={{ margin: 0 }}>
          Open any division workspace to inspect KPIs, datasets, data sources, spatial nodes, assets,
          alerts, reports, and domain-specific guardrails.
        </p>
      </div>

      <div className="sg-grid-3">
        {DIVISIONS.map((div) => {
          const ds = dsCounts.find((r) => r.division_code === div.code)?.cnt ?? 0;
          const al = alertCounts.find((r) => r.division_code === div.code)?.cnt ?? 0;
          const src = srcRows.find((r) => r.division_code === div.code)?.status ?? "INTEGRATION_REQUIRED";

          return (
            <Link key={div.code} href={`/app/divisions/${div.slug}`} className="sg-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <span className="sg-eyebrow">Division {div.code}</span>
                  <StatusBadge status={src} />
                </div>
                <h2 className="sg-h3" style={{ marginTop: "0.45rem" }}>{div.name}</h2>
                <p className="sg-muted" style={{ fontSize: "0.83rem", margin: 0 }}>{div.purpose}</p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--sg-border)", paddingTop: "0.6rem", fontSize: "0.78rem" }}>
                <span className="sg-muted">{ds} datasets · {al} active alerts</span>
                <span style={{ color: "var(--sg-gold)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                  Open <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
