import Link from "next/link";
import { getDb, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MapPin, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PublicCitiesPage() {
  ensureSeeded();
  const db = getDb();

  const cities = normalizeRows<{
    id: string;
    slug: string;
    name: string;
    local_name: string | null;
    country_code: string;
    country_name: string | null;
    region_name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    population: number | null;
    population_source: string | null;
    readiness_score: number;
    data_status: string;
    summary: string | null;
  }>(
    db
      .prepare(
        `SELECT c.*, co.name AS country_name
         FROM cities c
         LEFT JOIN countries co ON co.code = c.country_code
         WHERE c.is_public = 1
         ORDER BY c.name ASC`
      )
      .all()
  );

  const publishedReports = normalizeRows<{
    id: string;
    title: string;
    division_code: string;
    created_at: string;
  }>(
    db
      .prepare(
        "SELECT id, title, division_code, created_at FROM reports WHERE is_public = 1 AND status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 6"
      )
      .all()
  );

  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem" }}>
      <div className="sg-eyebrow">Global Urban Observatory</div>
      <h1 className="sg-h1">Global City Network</h1>
      <p className="sg-muted" style={{ maxWidth: "760px", marginBottom: "1rem" }}>
        Public city profiles registered for transparent urban evaluation. Every profile discloses its
        geographic coordinates, timezone, data readiness, and truthful data status.
      </p>
      <div className="sg-banner" style={{ marginBottom: "2rem" }}>
        <strong>Transparency Notice:</strong> The cities listed below use clearly labeled{" "}
        <code>HISTORICAL</code> or <code>SIMULATED</code> evaluation baselines. Live city feeds appear
        as <code>LIVE</code> only when an organization connects an authorized municipal API.
      </div>

      <div className="sg-grid-3">
        {cities.map((c) => (
          <div key={c.id} className="sg-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <span className="sg-eyebrow">{c.country_name || c.country_code}</span>
                <StatusBadge status={c.data_status} />
              </div>
              <h2 className="sg-h3" style={{ marginTop: "0.5rem" }}>
                {c.name} {c.local_name ? <span className="sg-muted" style={{ fontWeight: 400, fontSize: "0.9rem" }}>({c.local_name})</span> : null}
              </h2>
              <p className="sg-muted" style={{ fontSize: "0.84rem" }}>{c.summary}</p>
              <div style={{ fontSize: "0.8rem", display: "grid", gap: "0.25rem", marginTop: "0.75rem" }} className="sg-muted">
                <div><MapPin size={12} style={{ display: "inline", marginRight: 4 }} /> {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)} · {c.timezone}</div>
                <div>Population: {c.population ? c.population.toLocaleString() : "Undisclosed"} ({c.population_source || "Reference"})</div>
                <div>Data Readiness Index: <strong style={{ color: "var(--sg-gold)" }}>{c.readiness_score}/100</strong></div>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link href={`/app/cities/${c.slug}`} className="sg-btn sg-btn-outline" style={{ width: "100%" }}>
                Inspect City Workspace <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <hr className="sg-divider" />

      <section>
        <div className="sg-eyebrow">Open Data &amp; Transparency</div>
        <h2 className="sg-h2">Published Public Briefs</h2>
        {publishedReports.length === 0 ? (
          <p className="sg-muted">No public reports have been approved for release yet.</p>
        ) : (
          <div className="sg-grid-2">
            {publishedReports.map((r) => (
              <div key={r.id} className="sg-card">
                <div className="sg-eyebrow">Division {r.division_code} · Approved Public Release</div>
                <h3 className="sg-h3" style={{ marginTop: "0.3rem" }}>{r.title}</h3>
                <p className="sg-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                  Published {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
