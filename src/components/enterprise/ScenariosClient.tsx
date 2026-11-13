"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface ScenarioRow {
  id: string;
  name: string;
  description: string;
  baseline_label: string;
  parameters_json: string;
  results_json: string;
  assumptions: string;
  status: string;
}

export function ScenariosClient({
  initialScenarios,
  cities,
  canWrite,
}: {
  initialScenarios: ScenarioRow[];
  cities: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cityId, setCityId] = useState(cities[0]?.id || "");
  const [divisionCode, setDivisionCode] = useState("07");
  const [solarBoostPct, setSolarBoostPct] = useState(20);
  const [transitShiftPct, setTransitShiftPct] = useState(15);
  const [assumptions, setAssumptions] = useState("Modeled estimate assuming linear adoption and existing grid capacity.");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/v1/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "scenario",
        cityId,
        divisionCode,
        name,
        description,
        baselineLabel: "2026 Simulated Baseline",
        assumptions,
        solarBoostPct,
        transitShiftPct,
      }),
    });
    if (res.ok) {
      setShowAdd(false);
      setName("");
      setDescription("");
      const list = await fetch("/api/v1/operations?type=scenarios");
      const json = await list.json();
      if (list.ok) setScenarios(json.data);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">What-If Modeling</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Scenario Laboratory</h1>
          <p className="sg-muted" style={{ margin: 0 }}>
            Evaluate hypothetical policy and infrastructure parameter scenarios. All outputs are strictly labeled as modeled estimates.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowAdd((v) => !v)}>
            <Plus size={15} /> Create Scenario
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={onCreate} className="sg-card-gold" style={{ display: "grid", gap: "0.85rem" }}>
          <div className="sg-grid-2">
            <div>
              <label className="sg-label" htmlFor="sc-name">Scenario Name</label>
              <input id="sc-name" className="sg-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="District Solar + Transit Mode Shift" />
            </div>
            <div>
              <label className="sg-label" htmlFor="sc-city">Target City</label>
              <select id="sc-city" className="sg-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="sc-div">Primary Division</label>
              <select id="sc-div" className="sg-select" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)}>
                {DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sg-label" htmlFor="sc-sol">Solar Expansion (%) : {solarBoostPct}%</label>
              <input id="sc-sol" type="range" min={0} max={100} value={solarBoostPct} onChange={(e) => setSolarBoostPct(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="sg-label" htmlFor="sc-tr">Transit Mode Shift (%) : {transitShiftPct}%</label>
            <input id="sc-tr" type="range" min={0} max={100} value={transitShiftPct} onChange={(e) => setTransitShiftPct(Number(e.target.value))} />
          </div>
          <div>
            <label className="sg-label" htmlFor="sc-desc">Description</label>
            <input id="sc-desc" className="sg-input" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe scenario hypothesis..." />
          </div>
          <div>
            <label className="sg-label" htmlFor="sc-asm">Disclosed Assumptions</label>
            <input id="sc-asm" className="sg-input" required value={assumptions} onChange={(e) => setAssumptions(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Run Modeled Estimate</button>
            <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="sg-grid-2">
        {scenarios.map((s) => (
          <div key={s.id} className="sg-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
              <span className="sg-eyebrow">{s.baseline_label}</span>
              <StatusBadge status="SIMULATED" />
            </div>
            <h2 className="sg-h3" style={{ marginTop: "0.4rem" }}>{s.name}</h2>
            <p className="sg-muted" style={{ fontSize: "0.86rem" }}>{s.description}</p>
            <div className="sg-mono" style={{ fontSize: "0.78rem", background: "#0d0d0d", padding: "0.65rem", borderRadius: 6, marginBottom: "0.6rem" }}>
              <div>Params: {s.parameters_json}</div>
              <div style={{ color: "var(--sg-gold)" }}>Modeled Output: {s.results_json}</div>
            </div>
            <div className="sg-muted" style={{ fontSize: "0.78rem" }}>
              <strong>Assumptions:</strong> {s.assumptions}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
