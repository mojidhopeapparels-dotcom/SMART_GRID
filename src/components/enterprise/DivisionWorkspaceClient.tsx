"use client";

import Link from "next/link";
import { useState } from "react";
import type { DivisionDefinition } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ShieldAlert, Bot, Table2, MapPin } from "lucide-react";

type TabId = "overview" | "data" | "sources" | "assets" | "alerts" | "reports" | "governance";

export function DivisionWorkspaceClient({
  division,
  datasets,
  sources,
  observations,
  assets,
  sensors,
  alerts,
  reports,
  cityName,
}: {
  division: DivisionDefinition;
  datasets: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  assets: Record<string, unknown>[];
  sensors: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  cityName: string;
}) {
  const [tab, setTab] = useState<TabId>("overview");

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview & KPIs" },
    { id: "data", label: `Data & Observations (${observations.length})` },
    { id: "sources", label: `Sources & Quality (${sources.length})` },
    { id: "assets", label: `Assets & Sensors (${assets.length + sensors.length})` },
    { id: "alerts", label: `Events & Alerts (${alerts.length})` },
    { id: "reports", label: `Reports (${reports.length})` },
    { id: "governance", label: "Guardrails & Settings" },
  ];

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
        <div>
          <div className="sg-eyebrow">Division {division.code} · {division.category} · {cityName}</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>{division.name}</h1>
          <p className="sg-muted" style={{ margin: 0, maxWidth: "760px" }}>{division.description}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/app/ai" className="sg-btn sg-btn-outline"><Bot size={14} /> AI Analysis</Link>
          <Link href="/app/sheets" className="sg-btn sg-btn-outline"><Table2 size={14} /> Open in SHEETS</Link>
          <Link href="/app/digital-twin" className="sg-btn sg-btn-outline"><MapPin size={14} /> Map View</Link>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.75rem" }} role="tablist" aria-label="Division workspace sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`sg-btn ${tab === t.id ? "sg-btn-primary" : "sg-btn-ghost"}`}
            style={{ padding: "0.42rem 0.8rem", fontSize: "0.8rem" }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="sg-grid-2">
          <div className="sg-card">
            <div className="sg-eyebrow">Domain Scope: {division.domainFocusLabel}</div>
            <h2 className="sg-h3" style={{ marginTop: "0.35rem" }}>Operational Capabilities</h2>
            <ul style={{ paddingLeft: "1.1rem", margin: "0.65rem 0 0", display: "grid", gap: "0.4rem", fontSize: "0.88rem" }}>
              {division.capabilities.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>

          <div className="sg-card">
            <div className="sg-eyebrow">Standardized KPIs</div>
            <h2 className="sg-h3" style={{ marginTop: "0.35rem" }}>Division Indicator Registry</h2>
            <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.65rem" }}>
              {division.kpis.map((k) => {
                const latest = observations.find((o) => o.kpi_code === k.code);
                return (
                  <div key={k.code} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.55rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{k.name}</strong>
                      <span className="sg-mono" style={{ color: "var(--sg-gold)" }}>
                        {latest ? `${latest.metric_value} ${latest.unit}` : `No feed (${k.unit})`}
                      </span>
                    </div>
                    <div className="sg-muted" style={{ fontSize: "0.8rem" }}>{k.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "data" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="sg-card">
            <h2 className="sg-h3">Division Datasets ({datasets.length})</h2>
            {datasets.length === 0 ? (
              <p className="sg-muted">No datasets ingested for Division {division.code} yet. Use Data Catalog or Integration Hub to ingest CSV/JSON/XLSX records.</p>
            ) : (
              <div className="sg-table-wrap">
                <table className="sg-table">
                  <thead><tr><th>Dataset</th><th>Classification</th><th>Quality</th><th>Rows</th><th>Status</th></tr></thead>
                  <tbody>
                    {datasets.map((d) => (
                      <tr key={String(d.id)}>
                        <td style={{ fontWeight: 600 }}>{String(d.name)}</td>
                        <td>{String(d.classification)}</td>
                        <td className="sg-mono">{String(d.quality_score)}%</td>
                        <td className="sg-mono">{String(d.row_count)}</td>
                        <td><StatusBadge status={String(d.data_status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="sg-card">
            <h2 className="sg-h3">Recorded Observations ({observations.length})</h2>
            {observations.length === 0 ? (
              <p className="sg-muted">No historical or live observations recorded for this division filter.</p>
            ) : (
              <div className="sg-table-wrap">
                <table className="sg-table">
                  <thead><tr><th>Metric</th><th>Value</th><th>Source</th><th>Status</th><th>Timestamp</th></tr></thead>
                  <tbody>
                    {observations.map((o) => (
                      <tr key={String(o.id)}>
                        <td>{String(o.metric_name)}</td>
                        <td className="sg-mono" style={{ color: "var(--sg-gold)", fontWeight: 700 }}>{String(o.metric_value)} {String(o.unit)}</td>
                        <td className="sg-muted">{String(o.source_name)}</td>
                        <td><StatusBadge status={String(o.data_status)} /></td>
                        <td className="sg-mono sg-muted" style={{ fontSize: "0.78rem" }}>{new Date(String(o.observed_at)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "sources" && (
        <div className="sg-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <h2 className="sg-h3" style={{ margin: 0 }}>Configured Data Sources</h2>
            <Link href="/app/integrations" className="sg-btn sg-btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>Configure Connector</Link>
          </div>
          {sources.length === 0 ? (
            <div className="sg-banner">No external connectors registered for Division {division.code}. Status: <strong>INTEGRATION REQUIRED</strong>.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {sources.map((s) => (
                <div key={String(s.id)} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{String(s.name)}</div>
                    <div className="sg-muted" style={{ fontSize: "0.8rem" }}>{String(s.provider)} · {String(s.connection_type)} · {String(s.last_error || "Ready")}</div>
                  </div>
                  <StatusBadge status={String(s.status)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "assets" && (
        <div className="sg-grid-2">
          <div className="sg-card">
            <h2 className="sg-h3">Division Assets ({assets.length})</h2>
            {assets.length === 0 ? <p className="sg-muted">No assets registered in this division.</p> : (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {assets.map((a) => (
                  <div key={String(a.id)} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.5rem" }}>
                    <div style={{ fontWeight: 700 }}>{String(a.name)} <span className="sg-mono sg-muted">({String(a.asset_tag)})</span></div>
                    <div className="sg-muted" style={{ fontSize: "0.8rem" }}>{String(a.asset_type)} · Condition: {String(a.condition_status)} · {String(a.operational_status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sg-card">
            <h2 className="sg-h3">Registered Sensors ({sensors.length})</h2>
            {sensors.length === 0 ? <p className="sg-muted">No telemetry sensors registered in this division.</p> : (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {sensors.map((s) => (
                  <div key={String(s.id)} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{String(s.name)}</div>
                      <div className="sg-muted" style={{ fontSize: "0.8rem" }}>{String(s.device_code)} · {String(s.measurement_type)} ({String(s.unit)})</div>
                    </div>
                    <StatusBadge status={String(s.data_status)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div className="sg-card">
          <h2 className="sg-h3">Division Alerts ({alerts.length})</h2>
          {alerts.length === 0 ? <p className="sg-muted">No alerts recorded for this division.</p> : (
            <div style={{ display: "grid", gap: "0.65rem" }}>
              {alerts.map((al) => (
                <div key={String(al.id)} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.55rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{String(al.title)}</div>
                    <div className="sg-muted" style={{ fontSize: "0.82rem" }}>{String(al.message)}</div>
                  </div>
                  <StatusBadge status={String(al.data_status)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="sg-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 className="sg-h3" style={{ margin: 0 }}>Division Reports ({reports.length})</h2>
            <Link href="/app/reports" className="sg-btn sg-btn-outline" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>Report Center</Link>
          </div>
          {reports.length === 0 ? <p className="sg-muted">No reports authored for this division yet.</p> : (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {reports.map((r) => (
                <div key={String(r.id)} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.5rem" }}>
                  <div style={{ fontWeight: 700 }}>{String(r.title)}</div>
                  <div className="sg-muted" style={{ fontSize: "0.8rem" }}>Status: {String(r.status)} · {String(r.report_type)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "governance" && (
        <div className="sg-card-gold">
          <div className="sg-eyebrow" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <ShieldAlert size={14} /> Domain Guardrails &amp; Expected Datasets
          </div>
          <h2 className="sg-h3" style={{ marginTop: "0.4rem" }}>Safety &amp; Truthfulness Boundaries</h2>
          <ul style={{ paddingLeft: "1.1rem", display: "grid", gap: "0.4rem", fontSize: "0.88rem" }}>
            {division.guardrails.map((g) => <li key={g}>{g}</li>)}
          </ul>
          <h3 className="sg-h3" style={{ marginTop: "1rem" }}>Standard Expected Datasets</h3>
          <ul style={{ paddingLeft: "1.1rem", display: "grid", gap: "0.35rem", fontSize: "0.86rem" }}>
            {division.exampleDatasets.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
