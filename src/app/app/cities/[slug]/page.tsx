import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EnterpriseCityProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const ctx = await requirePageAuth();
  const { slug } = await params;
  const db = getDb();

  const city = normalizeRow<{
    id: string;
    slug: string;
    name: string;
    local_name: string | null;
    country_code: string;
    region_name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    currency: string;
    population: number | null;
    population_source: string | null;
    area_km2: number | null;
    readiness_score: number;
    data_status: string;
    boundary_geojson: string | null;
    summary: string | null;
  }>(
    db
      .prepare("SELECT * FROM cities WHERE slug = ? AND (organization_id = ? OR is_public = 1)")
      .get(slug, ctx.organizationId)
  );

  if (!city) notFound();

  const areas = normalizeRows<{ id: string; name: string; area_type: string; population: number | null }>(
    db.prepare("SELECT * FROM administrative_areas WHERE city_id = ?").all(city.id)
  );
  const datasets = normalizeRows<{ id: string; name: string; division_code: string; data_status: string; row_count: number }>(
    db
      .prepare("SELECT id, name, division_code, data_status, row_count FROM datasets WHERE organization_id = ? AND city_id = ?")
      .all(ctx.organizationId, city.id)
  );
  const assets = normalizeRows<{ id: string; name: string; asset_tag: string; division_code: string; operational_status: string }>(
    db
      .prepare("SELECT id, name, asset_tag, division_code, operational_status FROM assets WHERE organization_id = ? AND city_id = ?")
      .all(ctx.organizationId, city.id)
  );
  const projects = normalizeRows<{ id: string; title: string; status: string; progress_pct: number; division_code: string }>(
    db
      .prepare("SELECT id, title, status, progress_pct, division_code FROM projects WHERE organization_id = ? AND city_id = ?")
      .all(ctx.organizationId, city.id)
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <Link href="/app/cities" className="sg-btn sg-btn-ghost" style={{ marginBottom: "0.75rem" }}>
          <ArrowLeft size={14} /> All Cities
        </Link>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
          <div>
            <div className="sg-eyebrow">{city.country_code} · {city.region_name}</div>
            <h1 className="sg-h1" style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>
              {city.name} {city.local_name ? <span className="sg-muted" style={{ fontWeight: 400, fontSize: "1.2rem" }}>({city.local_name})</span> : null}
            </h1>
            <p className="sg-muted" style={{ margin: 0, maxWidth: "740px" }}>{city.summary}</p>
          </div>
          <StatusBadge status={city.data_status} showDescription />
        </div>
      </div>

      <div className="sg-grid-4">
        <div className="sg-card">
          <div className="sg-eyebrow">Coordinates &amp; TZ</div>
          <div className="sg-mono" style={{ fontWeight: 700, marginTop: "0.35rem" }}>
            <MapPin size={14} style={{ display: "inline", marginRight: 4, color: "var(--sg-gold)" }} />
            {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
          </div>
          <div className="sg-muted" style={{ fontSize: "0.8rem" }}>{city.timezone} · {city.currency}</div>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">Population (Reference)</div>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", marginTop: "0.35rem" }}>
            {city.population ? city.population.toLocaleString() : "Undisclosed"}
          </div>
          <div className="sg-muted" style={{ fontSize: "0.76rem" }}>{city.population_source || "Reference"}</div>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">Data Readiness</div>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", marginTop: "0.35rem", color: "var(--sg-gold)" }}>
            {city.readiness_score}/100
          </div>
          <div className="sg-muted" style={{ fontSize: "0.78rem" }}>{datasets.length} org datasets linked</div>
        </div>
        <div className="sg-card">
          <div className="sg-eyebrow">Operations</div>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", marginTop: "0.35rem" }}>
            {assets.length} Assets · {projects.length} Projects
          </div>
          <div className="sg-muted" style={{ fontSize: "0.78rem" }}>Tenant-isolated records</div>
        </div>
      </div>

      <div className="sg-grid-2">
        <div className="sg-card">
          <h2 className="sg-h3">Administrative Areas &amp; Boundary Context</h2>
          {areas.length === 0 ? (
            <p className="sg-muted" style={{ fontSize: "0.85rem" }}>No sub-municipal administrative areas registered yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {areas.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.45rem", fontSize: "0.86rem" }}>
                  <span><strong>{a.name}</strong> ({a.area_type})</span>
                  <span className="sg-muted">{a.population ? a.population.toLocaleString() : "—"}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: "1rem" }}>
            <Link href="/app/digital-twin" className="sg-btn sg-btn-outline">Open in Digital Twin &amp; GIS</Link>
          </div>
        </div>

        <div className="sg-card">
          <h2 className="sg-h3">Organization Datasets for {city.name}</h2>
          {datasets.length === 0 ? (
            <p className="sg-muted" style={{ fontSize: "0.85rem" }}>No organization datasets scoped to this city yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {datasets.map((ds) => (
                <div key={ds.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.5rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{ds.name}</div>
                    <div className="sg-muted" style={{ fontSize: "0.76rem" }}>Division {ds.division_code} · {ds.row_count} rows</div>
                  </div>
                  <StatusBadge status={ds.data_status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sg-card">
        <h2 className="sg-h3">Division Coverage (24 Divisions)</h2>
        <div className="sg-grid-4" style={{ marginTop: "0.75rem" }}>
          {DIVISIONS.map((d) => {
            const hasDs = datasets.some((ds) => ds.division_code === d.code);
            return (
              <Link key={d.code} href={`/app/divisions/${d.slug}`} className="sg-card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="sg-eyebrow">{d.code}</span>
                  <StatusBadge status={hasDs ? "SIMULATED" : "INTEGRATION_REQUIRED"} />
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.84rem", marginTop: "0.35rem" }}>{d.name}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
