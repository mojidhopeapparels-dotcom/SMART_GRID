"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

type OpTab = "assets" | "projects" | "work_orders" | "incidents";

export function OperationsClient({
  initialAssets,
  initialProjects,
  initialWorkOrders,
  initialIncidents,
  cities,
  canWrite,
}: {
  initialAssets: Record<string, unknown>[];
  initialProjects: Record<string, unknown>[];
  initialWorkOrders: Record<string, unknown>[];
  initialIncidents: Record<string, unknown>[];
  cities: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<OpTab>("assets");
  const [assets, setAssets] = useState(initialAssets);
  const [projects, setProjects] = useState(initialProjects);
  const [workOrders, setWorkOrders] = useState(initialWorkOrders);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [showAdd, setShowAdd] = useState(false);

  const [cityId, setCityId] = useState(cities[0]?.id || "");
  const [divisionCode, setDivisionCode] = useState("08");
  const [title, setTitle] = useState("");
  const [tagOrType, setTagOrType] = useState("AST-001");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refreshAll() {
    const [a, p, w, i] = await Promise.all([
      fetch("/api/v1/operations?type=assets").then((r) => r.json()),
      fetch("/api/v1/operations?type=projects").then((r) => r.json()),
      fetch("/api/v1/operations?type=work_orders").then((r) => r.json()),
      fetch("/api/v1/operations?type=incidents").then((r) => r.json()),
    ]);
    if (a.data) setAssets(a.data);
    if (p.data) setProjects(p.data);
    if (w.data) setWorkOrders(w.data);
    if (i.data) setIncidents(i.data);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const payload =
      tab === "assets"
        ? { entity: "asset", cityId, divisionCode, assetTag: tagOrType, name: title, assetType: description || "Infrastructure" }
        : tab === "projects"
          ? { entity: "project", cityId, divisionCode, title, description: description || title, budgetAmount: 50000 }
          : tab === "work_orders"
            ? { entity: "work_order", cityId, divisionCode, title, description: description || title, priority: "MEDIUM" }
            : { entity: "incident", cityId, divisionCode, title, description: description || title, severity: "MEDIUM" };

    const res = await fetch("/api/v1/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowAdd(false);
      setTitle("");
      setDescription("");
      await refreshAll();
    } else {
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error?.message || "Failed to create operational record.");
    }
  }

  async function advanceWorkOrder(id: string, status: string) {
    setErrorMsg(null);
    const res = await fetch("/api/v1/operations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "WORK_ORDER_STATUS", id, status }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error?.message || "Failed to update work order status.");
      return;
    }
    await refreshAll();
  }

  async function advanceIncident(id: string, status: string) {
    setErrorMsg(null);
    const res = await fetch("/api/v1/operations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "INCIDENT_STATUS", id, status }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error?.message || "Failed to update incident status.");
      return;
    }
    await refreshAll();
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Enterprise Coordination</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Operations, Assets &amp; Projects</h1>
          <p className="sg-muted" style={{ margin: 0 }}>
            Manage infrastructure assets, capital projects, preventive/corrective work orders, and incident cases.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowAdd((v) => !v)}>
            <Plus size={15} /> Create {tab.replace("_", " ")}
          </button>
        )}
      </div>

      {errorMsg && <div className="sg-banner sg-banner-error" role="alert">{errorMsg}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
        {(["assets", "projects", "work_orders", "incidents"] as OpTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`sg-btn ${tab === t ? "sg-btn-primary" : "sg-btn-ghost"}`}
            onClick={() => setTab(t)}
          >
            {t.replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {showAdd && (
        <form onSubmit={onCreate} className="sg-card-gold" style={{ display: "grid", gap: "0.85rem" }}>
          <div className="sg-grid-3">
            <div>
              <label className="sg-label" htmlFor="op-title">Title / Name</label>
              <input id="op-title" className="sg-input" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="sg-label" htmlFor="op-city">City</label>
              <select id="op-city" className="sg-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="op-div">Division</label>
              <select id="op-div" className="sg-select" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)}>
                {DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </div>
          </div>
          {tab === "assets" && (
            <div>
              <label className="sg-label" htmlFor="op-tag">Asset Tag</label>
              <input id="op-tag" className="sg-input" value={tagOrType} onChange={(e) => setTagOrType(e.target.value)} />
            </div>
          )}
          <div>
            <label className="sg-label" htmlFor="op-desc">{tab === "assets" ? "Asset Type" : "Description"}</label>
            <input id="op-desc" className="sg-input" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Save Record</button>
            <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {tab === "assets" && (
        <div className="sg-table-wrap">
          <table className="sg-table">
            <thead><tr><th>Tag</th><th>Name</th><th>Type</th><th>Division</th><th>Condition</th><th>Status</th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={String(a.id)}>
                  <td className="sg-mono">{String(a.asset_tag)}</td>
                  <td style={{ fontWeight: 700 }}>{String(a.name)}</td>
                  <td>{String(a.asset_type)}</td>
                  <td>Div {String(a.division_code)}</td>
                  <td>{String(a.condition_status)}</td>
                  <td><StatusBadge status={String(a.data_status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "projects" && (
        <div className="sg-grid-2">
          {projects.map((p) => (
            <div key={String(p.id)} className="sg-card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="sg-eyebrow">Division {String(p.division_code)}</span>
                <span className="sg-badge sg-badge-gold">{String(p.status)} · {String(p.progress_pct)}%</span>
              </div>
              <h2 className="sg-h3" style={{ marginTop: "0.4rem" }}>{String(p.title)}</h2>
              <p className="sg-muted" style={{ fontSize: "0.85rem" }}>{String(p.description)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "work_orders" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {workOrders.map((w) => (
            <div key={String(w.id)} className="sg-card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                  <strong>{String(w.title)}</strong>
                  <span className="sg-badge sg-badge-gold">{String(w.status)}</span>
                  <span className="sg-badge sg-badge-grey">{String(w.priority)}</span>
                </div>
                <div className="sg-muted" style={{ fontSize: "0.83rem" }}>{String(w.description)}</div>
              </div>
              {canWrite && String(w.status) !== "CLOSED" && (
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button type="button" className="sg-btn sg-btn-outline" onClick={() => advanceWorkOrder(String(w.id), "IN_PROGRESS")}>Start</button>
                  <button type="button" className="sg-btn sg-btn-primary" onClick={() => advanceWorkOrder(String(w.id), "CLOSED")}>Close</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "incidents" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {incidents.map((inc) => (
            <div key={String(inc.id)} className="sg-card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                  <strong>{String(inc.title)}</strong>
                  <span className="sg-badge sg-badge-warn">{String(inc.severity)}</span>
                  <span className="sg-badge sg-badge-white">{String(inc.status)}</span>
                </div>
                <div className="sg-muted" style={{ fontSize: "0.83rem" }}>{String(inc.description)}</div>
              </div>
              {canWrite && String(inc.status) !== "CLOSED" && (
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button type="button" className="sg-btn sg-btn-outline" onClick={() => advanceIncident(String(inc.id), "RESOLVED")}>Resolve</button>
                  <button type="button" className="sg-btn sg-btn-primary" onClick={() => advanceIncident(String(inc.id), "CLOSED")}>Close</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
