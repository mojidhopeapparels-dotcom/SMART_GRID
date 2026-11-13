"use client";

import { useState } from "react";
import { Upload, Globe2, Plus } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface DatasetRow {
  id: string;
  name: string;
  description: string;
  city_name: string | null;
  division_code: string;
  classification: string;
  data_status: string;
  row_count: number;
  quality_score: number;
  is_public_published: number;
  limitations: string | null;
  updated_at: string;
}

export function DataCatalogClient({
  initialDatasets,
  cities,
  canWrite,
  canPublish,
}: {
  initialDatasets: DatasetRow[];
  cities: { id: string; name: string }[];
  canWrite: boolean;
  canPublish: boolean;
}) {
  const [datasets, setDatasets] = useState(initialDatasets);
  const [showIngest, setShowIngest] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cityId, setCityId] = useState(cities[0]?.id || "");
  const [divisionCode, setDivisionCode] = useState("05");
  const [classification, setClassification] = useState("INTERNAL");
  const [csvText, setCsvText] = useState("metricName,metricValue,unit\nPM2.5 Mean,42.5,ug/m3\nPM2.5 Mean,39.8,ug/m3");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const res = await fetch("/api/v1/datasets");
    const json = await res.json();
    if (res.ok) setDatasets(json.data);
  }

  async function onIngest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const records = lines.slice(1).map((line) => {
        const parts = line.split(",");
        return {
          metricName: parts[0]?.trim() || "Metric",
          metricValue: Number(parts[1]?.trim() || 0),
          unit: parts[2]?.trim() || "unit",
        };
      });
      const res = await fetch("/api/v1/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          cityId,
          divisionCode,
          classification,
          dataStatus: "HISTORICAL",
          records,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Ingestion failed.");
      } else {
        setShowIngest(false);
        setName("");
        setDescription("");
        await refresh();
      }
    } catch {
      setError("Failed to parse CSV records.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(ds: DatasetRow) {
    const res = await fetch("/api/v1/datasets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: ds.id,
        isPublicPublished: !ds.is_public_published,
      }),
    });
    if (res.ok) await refresh();
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Data Trust &amp; Provenance</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Data Catalog &amp; Quality</h1>
          <p className="sg-muted" style={{ margin: 0 }}>
            Inspect dataset schemas, quality scores, classification levels, and ingest validated CSV series.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowIngest((v) => !v)}>
            <Plus size={15} /> Ingest Dataset
          </button>
        )}
      </div>

      {showIngest && (
        <form onSubmit={onIngest} className="sg-card-gold" style={{ display: "grid", gap: "0.9rem" }}>
          <h2 className="sg-h3" style={{ margin: 0 }}><Upload size={16} style={{ display: "inline", marginRight: 6 }} />Ingest Historical CSV Series</h2>
          {error && <div className="sg-banner sg-banner-error">{error}</div>}
          <div className="sg-grid-2">
            <div>
              <label className="sg-label" htmlFor="ds-name">Dataset Name</label>
              <input id="ds-name" className="sg-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ward 4 Particulate Archive" />
            </div>
            <div>
              <label className="sg-label" htmlFor="ds-city">City</label>
              <select id="ds-city" className="sg-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="ds-div">Division</label>
              <select id="ds-div" className="sg-select" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)}>
                {DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="ds-cls">Classification</label>
              <select id="ds-cls" className="sg-select" value={classification} onChange={(e) => setClassification(e.target.value)}>
                <option value="INTERNAL">INTERNAL</option>
                <option value="PUBLIC">PUBLIC</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="RESTRICTED">RESTRICTED</option>
              </select>
            </div>
          </div>
          <div>
            <label className="sg-label" htmlFor="ds-desc">Description &amp; Provenance</label>
            <input id="ds-desc" className="sg-input" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Source agency, collection method, and coverage period..." />
          </div>
          <div>
            <label className="sg-label" htmlFor="ds-csv">CSV Payload (metricName,metricValue,unit)</label>
            <textarea id="ds-csv" className="sg-textarea sg-mono" rows={4} value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary" disabled={saving}>{saving ? "Validating & Saving..." : "Validate & Ingest"}</button>
            <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setShowIngest(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="sg-table-wrap">
        <table className="sg-table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>City / Division</th>
              <th>Classification</th>
              <th>Quality</th>
              <th>Rows</th>
              <th>Status</th>
              <th>Open Data</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((ds) => (
              <tr key={ds.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{ds.name}</div>
                  <div className="sg-muted" style={{ fontSize: "0.78rem" }}>{ds.description}</div>
                </td>
                <td>{ds.city_name || "Global"} · Div {ds.division_code}</td>
                <td><span className="sg-badge sg-badge-grey">{ds.classification}</span></td>
                <td className="sg-mono" style={{ color: "var(--sg-gold)" }}>{ds.quality_score}%</td>
                <td className="sg-mono">{ds.row_count}</td>
                <td><StatusBadge status={ds.data_status} /></td>
                <td>
                  {canPublish ? (
                    <button type="button" className="sg-btn sg-btn-ghost" style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }} onClick={() => togglePublish(ds)}>
                      <Globe2 size={13} /> {ds.is_public_published ? "Published" : "Publish"}
                    </button>
                  ) : (
                    <span className="sg-muted">{ds.is_public_published ? "Public" : "Private"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
