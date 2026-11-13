"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import type { DivisionDefinition } from "@/lib/domain/divisions";

const CATEGORIES = [
  "ALL",
  "Governance & Spatial",
  "Mobility & Infrastructure",
  "Environment & Utilities",
  "Safety, Health & Urban",
  "Economy & Community",
] as const;

export function DivisionsDirectoryClient({ divisions }: { divisions: DivisionDefinition[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return divisions.filter((d) => {
      if (category !== "ALL" && d.category !== category) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.code.includes(q) ||
        d.purpose.toLowerCase().includes(q) ||
        d.capabilities.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [divisions, query, category]);

  return (
    <div>
      <div
        className="sg-card"
        style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}
      >
        <div style={{ flex: "1 1 260px", position: "relative" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--sg-grey)" }}
            aria-hidden="true"
          />
          <input
            type="search"
            className="sg-input"
            style={{ paddingLeft: "2.1rem" }}
            placeholder="Search divisions by name, code (01-24), or capability..."
            aria-label="Search 24 intelligence divisions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }} role="group" aria-label="Filter by division category">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`sg-btn ${category === cat ? "sg-btn-primary" : "sg-btn-ghost"}`}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.78rem" }}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="sg-card" style={{ textAlign: "center", padding: "2.5rem" }}>
          <p className="sg-muted" style={{ margin: 0 }}>
            No divisions matched &ldquo;{query}&rdquo;. Clear filters to view all 24 SMART GRID divisions.
          </p>
        </div>
      ) : (
        <div className="sg-grid-3">
          {filtered.map((div) => (
            <Link
              key={div.code}
              href={`/divisions/${div.slug}`}
              className="sg-card"
              style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <span className="sg-eyebrow">Division {div.code}</span>
                  <span className="sg-badge sg-badge-grey">{div.category}</span>
                </div>
                <h2 className="sg-h3" style={{ marginTop: "0.5rem" }}>{div.name}</h2>
                <p className="sg-muted" style={{ fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
                  {div.purpose}
                </p>
                <div style={{ fontSize: "0.78rem", color: "var(--sg-grey-light)" }}>
                  Focus: <strong style={{ color: "var(--sg-white)" }}>{div.domainFocusLabel}</strong>
                </div>
              </div>
              <div style={{ marginTop: "1rem", color: "var(--sg-gold)", fontSize: "0.82rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                Inspect Division Blueprint <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
