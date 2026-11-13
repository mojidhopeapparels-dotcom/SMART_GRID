import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Database,
  Globe2,
  Layers,
  ShieldCheck,
  Table2,
  CheckCircle2,
} from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function HomePage() {
  return (
    <div>
      {/* 1. Hero */}
      <section
        style={{
          padding: "5rem 0 4rem",
          borderBottom: "1px solid var(--sg-border)",
          background:
            "radial-gradient(circle at 75% 20%, rgba(201,162,39,0.14) 0%, rgba(8,8,8,0) 55%)",
        }}
      >
        <div className="sg-container">
          <div style={{ maxWidth: "820px" }}>
            <div className="sg-eyebrow">Global Smart City Intelligence &amp; Management Ecosystem</div>
            <h1 className="sg-h1">
              SMART GRID
              <span style={{ display: "block", color: "var(--sg-gold)" }}>
                The Intelligence Behind Tomorrow&apos;s Cities.
              </span>
            </h1>
            <p className="sg-muted" style={{ fontSize: "1.1rem", maxWidth: "680px", marginBottom: "1.75rem" }}>
              One connected public and enterprise ecosystem uniting 24 urban intelligence divisions,
              trusted data integrations, geospatial Digital Twin layers, SMART GRID AI, and SMART
              GRID SHEETS—built with strict multi-tenant security and truthful data provenance.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <Link href="/sign-in" className="sg-btn sg-btn-primary">
                Launch Enterprise Workspace
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/divisions" className="sg-btn sg-btn-outline">
                Explore 24 Intelligence Divisions
              </Link>
              <Link href="/cities" className="sg-btn sg-btn-ghost">
                View Global City Network
              </Link>
            </div>
          </div>

          {/* 5 Core Questions strip */}
          <div className="sg-grid-3" style={{ marginTop: "3rem" }}>
            {[
              { q: "1. What is happening?", d: "Traceable city observations and historical benchmarks with explicit freshness status." },
              { q: "2. Where is it happening?", d: "Coordinate-referenced assets, sensors, corridors, and administrative boundaries." },
              { q: "3. Why might it be happening?", d: "Cross-division analytical joins without overstating causality." },
              { q: "4. What could happen next?", d: "Hypothetical scenarios and forecasts with disclosed assumptions." },
              { q: "5. What should the organization do?", d: "Auditable projects, work orders, incidents, and human-approved workflows." },
              { q: "Truthful Status Guarantee", d: "Every dataset distinguishes LIVE, HISTORICAL, SIMULATED, STALE, or INTEGRATION REQUIRED." },
            ].map((item) => (
              <div key={item.q} className="sg-card">
                <div style={{ fontWeight: 700, color: "var(--sg-gold)", marginBottom: "0.35rem", fontSize: "0.92rem" }}>
                  {item.q}
                </div>
                <p className="sg-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  {item.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Platform Architecture Showcase (White balanced surface for 25% White target) */}
      <section style={{ background: "var(--sg-white)", color: "var(--sg-black)", padding: "4rem 0" }}>
        <div className="sg-container">
          <div className="sg-eyebrow" style={{ color: "#8c6d11" }}>Unified Architecture</div>
          <h2 className="sg-h2" style={{ color: "var(--sg-black)" }}>
            Two Experiences. One Governed Urban Intelligence Foundation.
          </h2>
          <p style={{ color: "var(--sg-grey)", maxWidth: "700px", marginBottom: "2rem" }}>
            Public transparency portals and isolated enterprise municipal workspaces share consistent
            data contracts and division terminology while enforcing strict server-side boundaries.
          </p>

          <div className="sg-grid-4">
            {[
              {
                icon: Layers,
                title: "24 Intelligence Divisions",
                desc: "Structured urban domains from City Governance and Mobility to Water, Energy, Safety, Finance, and Food Systems.",
                href: "/divisions",
              },
              {
                icon: Cpu,
                title: "SMART GRID AI",
                desc: "Permission-aware retrieval, source citations, report drafting, and SHEETS Copilot—never fabricating unconfigured feeds.",
                href: "/ai",
              },
              {
                icon: Table2,
                title: "SMART GRID SHEETS",
                desc: "Multi-sheet workbooks, formula engine (=SUM, =AVERAGE, =IF, =ROUND), CSV/XLSX/JSON import-export, and data cleaning.",
                href: "/sheets",
              },
              {
                icon: Globe2,
                title: "Digital Twin & GIS",
                desc: "2D/3D spatial exploration, GeoJSON layer management, proximity/coverage queries, and scenario comparisons.",
                href: "/digital-twin",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href} className="sg-card-white" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: "#080808",
                        color: "#C9A227",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "0.85rem",
                      }}
                    >
                      <Icon size={19} />
                    </div>
                    <h3 className="sg-h3">{card.title}</h3>
                    <p style={{ color: "#525252", fontSize: "0.86rem", margin: 0 }}>{card.desc}</p>
                  </div>
                  <div style={{ marginTop: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "#8c6d11", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    Explore module <ArrowRight size={14} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. 24 Divisions Preview */}
      <section style={{ padding: "4rem 0", borderBottom: "1px solid var(--sg-border)" }}>
        <div className="sg-container">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "1rem", marginBottom: "1.75rem" }}>
            <div>
              <div className="sg-eyebrow">Domain Taxonomy</div>
              <h2 className="sg-h2">All 24 City Intelligence Divisions</h2>
            </div>
            <Link href="/divisions" className="sg-btn sg-btn-outline">
              Browse Full Directory <ArrowRight size={15} />
            </Link>
          </div>

          <div className="sg-grid-4">
            {DIVISIONS.slice(0, 8).map((div) => (
              <Link key={div.code} href={`/divisions/${div.slug}`} className="sg-card">
                <div className="sg-eyebrow">Division {div.code}</div>
                <div style={{ fontWeight: 700, margin: "0.35rem 0" }}>{div.name}</div>
                <p className="sg-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                  {div.purpose}
                </p>
              </Link>
            ))}
          </div>
          <p className="sg-muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
            Showing 01–08 of 24 standardized urban divisions. <Link href="/divisions" style={{ color: "var(--sg-gold)", textDecoration: "underline" }}>View all 24 divisions</Link>.
          </p>
        </div>
      </section>

      {/* 4. Data Trust & Security */}
      <section style={{ padding: "4rem 0" }}>
        <div className="sg-container">
          <div className="sg-grid-2">
            <div className="sg-card-gold">
              <div className="sg-eyebrow">Data Integrity</div>
              <h2 className="sg-h2">Truthful Data States — Zero Fabricated Telemetry</h2>
              <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
                Cities vary in digital readiness. SMART GRID works equally well with live authorized
                APIs, archived historical CSV/XLSX datasets, or evaluation models—and labels every
                record transparently.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
                <StatusBadge status="LIVE" />
                <StatusBadge status="HISTORICAL" />
                <StatusBadge status="SIMULATED" />
                <StatusBadge status="INTEGRATION_REQUIRED" />
                <StatusBadge status="STALE" />
                <StatusBadge status="UNAVAILABLE" />
              </div>
              <div style={{ marginTop: "1.25rem" }}>
                <Link href="/data-integrations" className="sg-btn sg-btn-outline">
                  <Database size={15} /> Data &amp; Integrations Architecture
                </Link>
              </div>
            </div>

            <div className="sg-card">
              <div className="sg-eyebrow">Enterprise Governance</div>
              <h2 className="sg-h2">Multi-Tenant Isolation &amp; Human Accountability</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 1.25rem", display: "grid", gap: "0.6rem", fontSize: "0.88rem" }}>
                {[
                  "Server-side RBAC permissions and strict organization isolation on every API route.",
                  "Scrypt password hashing, HTTP-only signed sessions, and RFC 6238 TOTP MFA.",
                  "Immutable audit trail across authentication, exports, workflows, and AI queries.",
                  "Human approval gates required before consequential operational or publication actions.",
                ].map((pt) => (
                  <li key={pt} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                    <CheckCircle2 size={16} style={{ color: "var(--sg-gold)", flexShrink: 0, marginTop: 3 }} />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                <Link href="/security" className="sg-btn sg-btn-secondary">
                  <ShieldCheck size={15} /> Security &amp; Data Trust
                </Link>
                <Link href="/developers" className="sg-btn sg-btn-ghost">
                  Developer Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
