import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { DIVISIONS, getDivisionBySlug } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function generateStaticParams() {
  return DIVISIONS.map((d) => ({ slug: d.slug }));
}

export default async function PublicDivisionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const division = getDivisionBySlug(slug);
  if (!division) notFound();

  const related = division.relatedDivisions
    .map((s) => DIVISIONS.find((d) => d.slug === s))
    .filter(Boolean);

  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem" }}>
      <Link href="/divisions" className="sg-btn sg-btn-ghost" style={{ marginBottom: "1.5rem" }}>
        <ArrowLeft size={15} /> Back to All 24 Divisions
      </Link>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Division {division.code} · {division.category}</div>
          <h1 className="sg-h1">{division.name}</h1>
          <p className="sg-muted" style={{ maxWidth: "760px", fontSize: "1.05rem" }}>
            {division.description}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
          <StatusBadge status="INTEGRATION_REQUIRED" />
          <Link href={`/app/divisions/${division.slug}`} className="sg-btn sg-btn-primary">
            Open in Enterprise App <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <hr className="sg-divider" />

      <div className="sg-grid-2">
        <div className="sg-card">
          <div className="sg-eyebrow">Core Capabilities</div>
          <h2 className="sg-h3" style={{ marginTop: "0.4rem" }}>{division.domainFocusLabel}</h2>
          <ul style={{ paddingLeft: "1.1rem", margin: "0.75rem 0 0", display: "grid", gap: "0.45rem", fontSize: "0.9rem" }}>
            {division.capabilities.map((cap) => (
              <li key={cap}>{cap}</li>
            ))}
          </ul>
        </div>

        <div className="sg-card">
          <div className="sg-eyebrow">Standardized KPIs</div>
          <h2 className="sg-h3" style={{ marginTop: "0.4rem" }}>Indicator Definitions</h2>
          <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
            {division.kpis.map((kpi) => (
              <div key={kpi.code} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.9rem" }}>
                  <span>{kpi.name}</span>
                  <span className="sg-mono" style={{ color: "var(--sg-gold)" }}>{kpi.code} ({kpi.unit})</span>
                </div>
                <p className="sg-muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>{kpi.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sg-card">
          <div className="sg-eyebrow">Expected Datasets &amp; Data Requirements</div>
          <h2 className="sg-h3" style={{ marginTop: "0.4rem" }}>Traceable Source Inputs</h2>
          <ul style={{ paddingLeft: "1.1rem", margin: "0.75rem 0", display: "grid", gap: "0.4rem", fontSize: "0.88rem" }}>
            {division.exampleDatasets.map((ds) => (
              <li key={ds}>{ds}</li>
            ))}
          </ul>
          <p className="sg-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
            Live feeds appear as <strong>LIVE</strong> only when an authorized connector is configured in
            the Enterprise Integration Hub. Otherwise, records carry <strong>HISTORICAL</strong>,{" "}
            <strong>SIMULATED</strong>, or <strong>INTEGRATION REQUIRED</strong> labels.
          </p>
        </div>

        <div className="sg-card-gold">
          <div className="sg-eyebrow" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <ShieldAlert size={14} /> Governance &amp; Operational Guardrails
          </div>
          <h2 className="sg-h3" style={{ marginTop: "0.4rem" }}>Trust &amp; Safety Boundaries</h2>
          <ul style={{ paddingLeft: "1.1rem", margin: "0.75rem 0 0", display: "grid", gap: "0.45rem", fontSize: "0.88rem" }}>
            {division.guardrails.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ marginTop: "2.5rem" }}>
          <div className="sg-eyebrow">Cross-Division Integration</div>
          <h2 className="sg-h3" style={{ marginTop: "0.35rem", marginBottom: "1rem" }}>Related Intelligence Divisions</h2>
          <div className="sg-grid-3">
            {related.map((rel) =>
              rel ? (
                <Link key={rel.code} href={`/divisions/${rel.slug}`} className="sg-card">
                  <div className="sg-eyebrow">Division {rel.code}</div>
                  <div style={{ fontWeight: 700, marginTop: "0.25rem" }}>{rel.name}</div>
                </Link>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
