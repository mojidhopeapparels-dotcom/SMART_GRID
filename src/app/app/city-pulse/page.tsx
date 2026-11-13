import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function CityPulsePage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const events = normalizeRows<{
    id: string;
    title: string;
    category: string;
    description: string;
    source_name: string;
    verification_status: string;
    division_code: string;
    occurred_at: string;
  }>(
    db
      .prepare("SELECT * FROM city_events WHERE organization_id = ? ORDER BY occurred_at DESC")
      .all(ctx.organizationId)
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <div className="sg-eyebrow">Chronological Urban Feed</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>City Pulse &amp; Event Timeline</h1>
        <p className="sg-muted" style={{ margin: 0 }}>
          Source-attributed operational, environmental, and infrastructure events across divisions.
        </p>
      </div>

      <div style={{ display: "grid", gap: "0.85rem" }}>
        {events.map((e) => (
          <div key={e.id} className="sg-card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
            <div>
              <div className="sg-eyebrow">Division {e.division_code} · {e.category} · {new Date(e.occurred_at).toLocaleString()}</div>
              <h2 className="sg-h3" style={{ marginTop: "0.25rem" }}>{e.title}</h2>
              <p className="sg-muted" style={{ margin: 0, fontSize: "0.86rem" }}>{e.description} (Source: {e.source_name})</p>
            </div>
            <StatusBadge status={e.verification_status} />
          </div>
        ))}
      </div>
    </div>
  );
}
