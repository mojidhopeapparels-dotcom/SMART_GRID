"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

const FAQ_ITEMS = [
  {
    topic: "Platform",
    q: "What is SMART GRID?",
    a: "SMART GRID is a global Smart City Intelligence & Management Ecosystem unifying 24 urban intelligence divisions, trusted data integrations, GIS/Digital Twin layers, SMART GRID AI, and SMART GRID SHEETS.",
  },
  {
    topic: "Data Trust",
    q: "How does SMART GRID ensure sample data is not mistaken for live telemetry?",
    a: "Every dataset, KPI, sensor, and chart carries an explicit status badge: LIVE, HISTORICAL, SIMULATED, INTEGRATION REQUIRED, STALE, PARTIAL, ERROR, or UNAVAILABLE. A source is marked LIVE only when an authorized connector actively syncs within its freshness window.",
  },
  {
    topic: "AI",
    q: "What happens if no external AI API key is configured?",
    a: "SMART GRID AI does not fabricate responses. If GEMINI_API_KEY or OPENAI_API_KEY is absent, the AI workspace displays an honest UNAVAILABLE / INTEGRATION REQUIRED status while preserving user input.",
  },
  {
    topic: "SHEETS",
    q: "Which spreadsheet formats and formulas are supported in SMART GRID SHEETS?",
    a: "SMART GRID SHEETS supports CSV, XLSX, and JSON import and export, multi-sheet workbooks, version history, and formulas including SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, ROUND, CONCAT, LEFT, RIGHT, MID, DATE, TODAY, and VLOOKUP.",
  },
  {
    topic: "Security",
    q: "How is multi-tenant isolation enforced between organizations?",
    a: "Every private record is scoped by organization_id, and every enterprise API route validates the user's signed HTTP-only session, active organization membership, and server-side RBAC permissions before querying or mutating records.",
  },
  {
    topic: "Operations",
    q: "Can SMART GRID directly switch power grids or dispatch emergency units?",
    a: "No. SMART GRID is an intelligence, analytics, and coordination platform—never a replacement for SCADA physical control or 911/CAD emergency dispatch.",
  },
];

export function FaqClient() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("ALL");
  const topics = ["ALL", "Platform", "Data Trust", "AI", "SHEETS", "Security", "Operations"];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (topic !== "ALL" && item.topic !== topic) return false;
      if (!q) return true;
      return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
    });
  }, [query, topic]);

  return (
    <div>
      <div className="sg-card" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--sg-grey)" }} />
          <input
            type="search"
            className="sg-input"
            style={{ paddingLeft: "2rem" }}
            placeholder="Search frequently asked questions..."
            aria-label="Search FAQ"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {topics.map((t) => (
            <button
              key={t}
              type="button"
              className={`sg-btn ${topic === t ? "sg-btn-primary" : "sg-btn-ghost"}`}
              style={{ padding: "0.35rem 0.7rem", fontSize: "0.78rem" }}
              onClick={() => setTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.85rem" }}>
        {filtered.map((item) => (
          <div key={item.q} className="sg-card">
            <div className="sg-eyebrow">{item.topic}</div>
            <h2 className="sg-h3" style={{ marginTop: "0.25rem" }}>{item.q}</h2>
            <p className="sg-muted" style={{ margin: 0, fontSize: "0.9rem" }}>{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
