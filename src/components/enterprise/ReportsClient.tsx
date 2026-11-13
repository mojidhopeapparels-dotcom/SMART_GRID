"use client";

import { useState } from "react";
import { Plus, CheckCircle2, Globe2, Download } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";

interface ReportRow {
  id: string;
  title: string;
  report_type: string;
  division_code: string | null;
  status: string;
  content_markdown: string;
  is_public: number;
  updated_at: string;
}

export function ReportsClient({
  initialReports,
  cities,
  canWrite,
  canPublish,
}: {
  initialReports: ReportRow[];
  cities: { id: string; name: string }[];
  canWrite: boolean;
  canPublish: boolean;
}) {
  const [reports, setReports] = useState(initialReports);
  const [selected, setSelected] = useState<ReportRow | null>(initialReports[0] || null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [cityId, setCityId] = useState(cities[0]?.id || "");
  const [divisionCode, setDivisionCode] = useState("05");
  const [contentMarkdown, setContentMarkdown] = useState("## Executive Summary\n\nEnter verified source citations and limitations here.");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/v1/operations?type=reports");
    const json = await res.json();
    if (res.ok) {
      setReports(json.data);
      if (selected) {
        const updated = (json.data as ReportRow[]).find((r) => r.id === selected.id);
        if (updated) setSelected(updated);
      }
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const res = await fetch("/api/v1/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "report",
        cityId: cityId || null,
        divisionCode: divisionCode || null,
        title,
        reportType: "DIVISION",
        contentMarkdown,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setTitle("");
      await refresh();
    } else {
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error?.message || "Failed to save draft report.");
    }
  }

  async function changeStatus(id: string, status: string) {
    setErrorMsg(null);
    const res = await fetch("/api/v1/operations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REPORT_STATUS", id, status }),
    });
    if (res.ok) {
      await refresh();
    } else {
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error?.message || "Failed to update report status.");
    }
  }

  function downloadMarkdown(r: ReportRow) {
    const blob = new Blob([`# ${r.title}\nStatus: ${r.status}\n\n${r.content_markdown}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.title.replace(/[^a-zA-Z0-9_-]+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Authoring &amp; Publication</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Report Center</h1>
          <p className="sg-muted" style={{ margin: 0 }}>
            Draft structured reports, enforce human review &amp; approval gates, and publish approved briefs.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowCreate((v) => !v)}>
            <Plus size={15} /> New Draft Report
          </button>
        )}
      </div>

      {errorMsg && <div className="sg-banner sg-banner-error" role="alert">{errorMsg}</div>}

      {showCreate && (
        <form onSubmit={onCreate} className="sg-card-gold" style={{ display: "grid", gap: "0.85rem" }}>
          <div className="sg-grid-3">
            <div>
              <label className="sg-label" htmlFor="rep-title">Report Title</label>
              <input id="rep-title" className="sg-input" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="sg-label" htmlFor="rep-city">City</label>
              <select id="rep-city" className="sg-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="rep-div">Division</label>
              <select id="rep-div" className="sg-select" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)}>
                {DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="sg-label" htmlFor="rep-body">Markdown Content (include sources &amp; limitations)</label>
            <textarea id="rep-body" className="sg-textarea sg-mono" rows={6} required value={contentMarkdown} onChange={(e) => setContentMarkdown(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Save Draft</button>
            <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="sg-split-sidebar">
        <div className="sg-card" style={{ display: "grid", gap: "0.45rem" }}>
          <div className="sg-eyebrow">Reports ({reports.length})</div>
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r)}
              className={`sg-nav-item ${selected?.id === r.id ? "sg-nav-item-active" : ""}`}
              style={{ width: "100%", textAlign: "left", background: selected?.id === r.id ? undefined : "transparent", border: "1px solid var(--sg-border)", cursor: "pointer", flexDirection: "column", alignItems: "flex-start" }}
            >
              <strong style={{ fontSize: "0.85rem" }}>{r.title}</strong>
              <span className="sg-muted" style={{ fontSize: "0.74rem" }}>{r.status} · Div {r.division_code || "All"}</span>
            </button>
          ))}
        </div>

        <div className="sg-card">
          {!selected ? (
            <p className="sg-muted">Select a report to view or approve.</p>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.75rem" }}>
                <div>
                  <span className="sg-badge sg-badge-gold">{selected.status}</span>
                  <h2 className="sg-h2" style={{ marginTop: "0.4rem", marginBottom: 0 }}>{selected.title}</h2>
                </div>
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  {canWrite && selected.status === "DRAFT" && (
                    <button type="button" className="sg-btn sg-btn-outline" onClick={() => changeStatus(selected.id, "UNDER_REVIEW")}>
                      Submit for Review
                    </button>
                  )}
                  {canPublish && selected.status !== "PUBLISHED" && (
                    <button type="button" className="sg-btn sg-btn-primary" onClick={() => changeStatus(selected.id, "PUBLISHED")}>
                      <Globe2 size={14} /> Approve &amp; Publish
                    </button>
                  )}
                  <button type="button" className="sg-btn sg-btn-ghost" onClick={() => downloadMarkdown(selected)}>
                    <Download size={14} /> Export .md
                  </button>
                </div>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, fontSize: "0.9rem", lineHeight: 1.65 }}>
                {selected.content_markdown}
              </pre>
              {selected.is_public === 1 && (
                <div className="sg-banner" style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <CheckCircle2 size={15} /> Published to Global City Network Public Transparency feed.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
