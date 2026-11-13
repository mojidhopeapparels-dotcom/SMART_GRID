"use client";

import { useState } from "react";
import { Plus, Play, Power } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface SourceRow {
  id: string;
  name: string;
  provider: string;
  division_code: string;
  connection_type: string;
  endpoint_ref: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
}

interface RunRow {
  id: string;
  source_name: string;
  status: string;
  message: string | null;
  started_at: string;
}

export function IntegrationsClient({
  initialSources,
  initialRuns,
  cities,
  canManage,
}: {
  initialSources: SourceRow[];
  initialRuns: RunRow[];
  cities: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [sources, setSources] = useState(initialSources);
  const [runs, setRuns] = useState(initialRuns);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [cityId, setCityId] = useState(cities[0]?.id || "");
  const [divisionCode, setDivisionCode] = useState("05");
  const [connectionType, setConnectionType] = useState("REST_API");
  const [endpointRef, setEndpointRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/integrations");
      const json = await res.json();
      if (res.ok) {
        setSources(json.data.sources);
        setRuns(json.data.runs);
      } else {
        setError(json?.error?.message || "Failed to refresh integrations.");
      }
    } catch {
      setError("Network error while refreshing integrations.");
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/v1/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          provider,
          cityId: cityId || null,
          divisionCode,
          connectionType,
          endpointRef: endpointRef.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Failed to register connector.");
      } else {
        setShowAdd(false);
        setName("");
        setProvider("");
        setEndpointRef("");
        await refresh();
      }
    } catch {
      setError("Network error while registering connector.");
    }
  }

  async function runAction(sourceId: string, action: "TEST_CONNECTION" | "DISABLE" | "ENABLE") {
    setBusyId(sourceId);
    setError(null);
    try {
      const res = await fetch("/api/v1/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message || "Failed to execute connector action.");
      } else {
        await refresh();
      }
    } catch {
      setError("Network error executing connector action.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Connector Architecture</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Integration Hub</h1>
          <p className="sg-muted" style={{ margin: 0 }}>
            Register external municipal APIs, test connectivity truthfully, and monitor ingestion runs.
          </p>
        </div>
        {canManage && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowAdd((v) => !v)}>
            <Plus size={15} /> Add Data Source
          </button>
        )}
      </div>

      {!showAdd && error && (
        <div className="sg-banner sg-banner-error" role="alert">{error}</div>
      )}

      {showAdd && (
        <form onSubmit={onCreate} className="sg-card-gold" style={{ display: "grid", gap: "0.9rem" }}>
          <h2 className="sg-h3" style={{ margin: 0 }}>Register External Data Connector</h2>
          {error && <div className="sg-banner sg-banner-error" role="alert">{error}</div>}
          <div className="sg-grid-3">
            <div>
              <label className="sg-label" htmlFor="src-name">Connector Name</label>
              <input id="src-name" className="sg-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="OpenAQ City Telemetry" />
            </div>
            <div>
              <label className="sg-label" htmlFor="src-prov">Provider</label>
              <input id="src-prov" className="sg-input" required value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Environmental Agency" />
            </div>
            <div>
              <label className="sg-label" htmlFor="src-type">Connection Type</label>
              <select id="src-type" className="sg-select" value={connectionType} onChange={(e) => setConnectionType(e.target.value)}>
                <option value="REST_API">REST API</option>
                <option value="GEOJSON">GeoJSON Feed</option>
                <option value="WEBHOOK">Webhook</option>
                <option value="CSV_UPLOAD">CSV Upload</option>
                <option value="IOT_TELEMETRY">IoT Telemetry</option>
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="src-city">City</label>
              <select id="src-city" className="sg-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="src-div">Division</label>
              <select id="src-div" className="sg-select" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)}>
                {DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="src-url">Public HTTPS Endpoint (Optional)</label>
              <input id="src-url" type="url" className="sg-input" value={endpointRef} onChange={(e) => setEndpointRef(e.target.value)} placeholder="https://api.example.org/v1/feed" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Register Connector</button>
            <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: "grid", gap: "0.85rem" }}>
        {sources.map((s) => (
          <div key={s.id} className="sg-card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <strong>{s.name}</strong>
                <StatusBadge status={s.status} />
              </div>
              <div className="sg-muted" style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                {s.provider} · {s.connection_type} · Div {s.division_code}
                {s.endpoint_ref ? ` · ${s.endpoint_ref}` : ""}
              </div>
              {s.last_error && (
                <div style={{ fontSize: "0.78rem", color: "#fbbf24", marginTop: "0.2rem" }}>
                  {s.last_error}
                </div>
              )}
            </div>
            {canManage && (
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  className="sg-btn sg-btn-outline"
                  disabled={busyId === s.id}
                  onClick={() => runAction(s.id, "TEST_CONNECTION")}
                >
                  <Play size={13} /> {busyId === s.id ? "Testing..." : "Test Connection"}
                </button>
                <button
                  type="button"
                  className="sg-btn sg-btn-ghost"
                  onClick={() => runAction(s.id, s.status === "DISABLED" ? "ENABLE" : "DISABLE")}
                >
                  <Power size={13} /> {s.status === "DISABLED" ? "Enable" : "Disable"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sg-card">
        <h2 className="sg-h3">Recent Sync &amp; Verification Runs</h2>
        {runs.length === 0 ? (
          <p className="sg-muted" style={{ margin: 0, fontSize: "0.85rem" }}>No connection tests run yet. Click &ldquo;Test Connection&rdquo; above to log a verification run.</p>
        ) : (
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead><tr><th>Source</th><th>Status</th><th>Message</th><th>Timestamp</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.source_name}</td>
                    <td><StatusBadge status={r.status === "SUCCESS" ? "LIVE" : "ERROR"} /></td>
                    <td className="sg-muted">{r.message}</td>
                    <td className="sg-mono sg-muted" style={{ fontSize: "0.78rem" }}>{new Date(r.started_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
