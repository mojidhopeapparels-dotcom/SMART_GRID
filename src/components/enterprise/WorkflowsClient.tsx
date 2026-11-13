"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  steps_json: string;
  status: string;
}

interface WorkflowRun {
  id: string;
  workflow_id: string;
  target_entity_type: string;
  target_entity_id: string;
  current_step: number;
  status: string;
  decision_notes: string | null;
  updated_at: string;
}

export function WorkflowsClient({
  workflows,
  initialRuns,
  canApprove,
}: {
  workflows: WorkflowDef[];
  initialRuns: WorkflowRun[];
  canApprove: boolean;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setError("");
    try {
      const res = await fetch("/api/v1/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "WORKFLOW_DECISION",
          id,
          status,
          notes: notes || `${status} via Workflow Manager`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error?.message || "Failed to record workflow decision.");
        return;
      }
      const list = await fetch("/api/v1/operations?type=workflows").then((r) => r.json());
      if (list.data?.runs) setRuns(list.data.runs);
    } catch {
      setError("Network error while submitting workflow decision.");
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <div className="sg-eyebrow">Human-in-the-Loop Governance</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Workflow &amp; Approval Engine</h1>
        <p className="sg-muted" style={{ margin: 0 }}>
          Review pending operational approvals and audit decision records.
        </p>
      </div>

      {error && <div className="sg-banner sg-banner-error" role="alert">{error}</div>}

      <div className="sg-card">
        <h2 className="sg-h3">Approval Inbox ({runs.length})</h2>
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            type="text"
            className="sg-input"
            aria-label="Decision notes for workflow approval or rejection"
            placeholder="Optional decision notes for approval/rejection..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {runs.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.75rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <strong className="sg-mono">{r.target_entity_type} · {r.target_entity_id}</strong>
                  <span className="sg-badge sg-badge-gold">{r.status}</span>
                </div>
                <div className="sg-muted" style={{ fontSize: "0.82rem" }}>
                  Step {r.current_step} · {r.decision_notes || "Awaiting authorized reviewer"}
                </div>
              </div>
              {canApprove && r.status === "PENDING_APPROVAL" && (
                <div style={{ display: "flex", gap: "0.45rem" }}>
                  <button type="button" className="sg-btn sg-btn-primary" onClick={() => decide(r.id, "APPROVED")}>
                    <Check size={14} /> Approve
                  </button>
                  <button type="button" className="sg-btn sg-btn-ghost" onClick={() => decide(r.id, "REJECTED")}>
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="sg-card">
        <h2 className="sg-h3">Published Workflow Templates</h2>
        {workflows.map((w) => (
          <div key={w.id} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.6rem" }}>
            <div style={{ fontWeight: 700 }}>{w.name} <span className="sg-badge sg-badge-grey">{w.status}</span></div>
            <p className="sg-muted" style={{ fontSize: "0.84rem", margin: "0.2rem 0" }}>{w.description}</p>
            <code className="sg-mono sg-muted" style={{ fontSize: "0.75rem" }}>{w.steps_json}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
