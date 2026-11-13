"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";

interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setResults(json.data?.results || []);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card">
        <span className="sg-badge sg-badge-gold">Tenant-Scoped Discovery</span>
        <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Global Enterprise Search</h1>
        <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
          Search across all 24 divisions, authorized cities, datasets, workbooks, physical assets, and municipal reports.
        </p>

        <form onSubmit={onSearch} style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <input
            className="sg-input"
            style={{ flex: 1, minWidth: "240px" }}
            placeholder="Search e.g. Energy, Substation, Metroville, Flood..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className="sg-btn sg-btn-primary" disabled={loading}>
            <Search size={16} /> {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {searched && (
        <div className="sg-card">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.85rem" }}>
            Results ({results.length})
          </h2>
          {results.length === 0 ? (
            <p className="sg-muted">No authorized records matched "{q}".</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {results.map((hit) => (
                <Link
                  key={`${hit.type}-${hit.id}`}
                  href={hit.href}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.8rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-elevated)",
                    textDecoration: "none",
                    color: "var(--sg-white)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span className="sg-badge sg-badge-gold">{hit.type}</span>
                      <strong>{hit.title}</strong>
                    </div>
                    <div className="sg-muted" style={{ fontSize: "0.82rem", marginTop: "0.25rem" }}>
                      {hit.subtitle}
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--sg-gold)" }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
