"use client";

import { useState } from "react";
import { FolderOpen, Plus, FileText } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";

interface DocumentRow {
  id: string;
  title: string;
  folder: string;
  category: string;
  division_code: string | null;
  classification: string;
  version: number;
  content_text: string | null;
  updated_at: string;
}

export function DocumentsClient({
  initialDocs,
  cities,
  canWrite,
}: {
  initialDocs: DocumentRow[];
  cities: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [docs, setDocs] = useState<DocumentRow[]>(initialDocs);
  const [selectedId, setSelectedId] = useState<string>(initialDocs[0]?.id || "");
  const [folderFilter, setFolderFilter] = useState<string>("ALL");
  const [showAdd, setShowAdd] = useState(false);

  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("Governance");
  const [category, setCategory] = useState("Policy");
  const [cityId, setCityId] = useState(cities[0]?.id || "");
  const [divisionCode, setDivisionCode] = useState("01");
  const [contentText, setContentText] = useState("");
  const [error, setError] = useState("");

  const folders = Array.from(new Set(docs.map((d) => d.folder)));
  const filtered = folderFilter === "ALL" ? docs : docs.filter((d) => d.folder === folderFilter);
  const activeDoc = docs.find((d) => d.id === selectedId) || filtered[0] || null;

  async function refresh() {
    try {
      const res = await fetch("/api/v1/operations?type=documents");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "Failed to refresh documents.");
        return;
      }
      if (json.data) {
        setDocs(json.data);
      }
    } catch {
      setError("Network error while refreshing documents.");
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/v1/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "document",
          cityId: cityId || null,
          divisionCode: divisionCode || null,
          title,
          folder,
          category,
          contentText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "Failed to save document.");
        return;
      }
      setShowAdd(false);
      setTitle("");
      setContentText("");
      await refresh();
      if (json.data?.id) setSelectedId(json.data.id);
    } catch {
      setError("Network error while saving document.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <span className="sg-badge sg-badge-gold">Enterprise Knowledge & Records</span>
          <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Documents & Municipal Records</h1>
          <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
            Tenant-isolated SOPs, engineering specifications, emergency playbooks, and audit artifacts.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={16} /> New Record
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={onCreate} className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Create Document Record</h2>
          {error && <div className="sg-banner sg-banner-error" role="alert">{error}</div>}
          <div className="sg-grid sg-grid-3">
            <div>
              <label htmlFor="doc-title" className="sg-label">Title</label>
              <input id="doc-title" className="sg-input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Substation Inspection Protocol" />
            </div>
            <div>
              <label htmlFor="doc-folder" className="sg-label">Folder</label>
              <input id="doc-folder" className="sg-input" value={folder} onChange={(e) => setFolder(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="doc-category" className="sg-label">Category</label>
              <select id="doc-category" className="sg-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Policy">Policy</option>
                <option value="SOP">SOP</option>
                <option value="Specification">Specification</option>
                <option value="Compliance">Compliance</option>
                <option value="Record">Record</option>
              </select>
            </div>
            <div>
              <label htmlFor="doc-city" className="sg-label">City Context</label>
              <select id="doc-city" className="sg-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                <option value="">Organization-Wide</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="doc-division" className="sg-label">Division</label>
              <select id="doc-division" className="sg-select" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)}>
                <option value="">Cross-Division</option>
                {DIVISIONS.map((d) => (
                  <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="doc-content" className="sg-label">Document Content (Markdown / Plaintext)</label>
            <textarea id="doc-content" className="sg-textarea" rows={5} value={contentText} onChange={(e) => setContentText(e.target.value)} required />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Save Record</button>
            <button type="button" className="sg-btn sg-btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {!showAdd && error && (
        <div className="sg-banner sg-banner-error" role="alert">{error}</div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className={`sg-btn ${folderFilter === "ALL" ? "sg-btn-primary" : "sg-btn-secondary"}`} onClick={() => setFolderFilter("ALL")}>
          <FolderOpen size={14} /> All ({docs.length})
        </button>
        {folders.map((f) => (
          <button key={f} type="button" className={`sg-btn ${folderFilter === f ? "sg-btn-primary" : "sg-btn-secondary"}`} onClick={() => setFolderFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="sg-split-sidebar" style={{ alignItems: "start" }}>
        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.length === 0 ? (
            <div className="sg-muted" style={{ fontSize: "0.9rem" }}>No documents in this folder.</div>
          ) : (
            filtered.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                style={{
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: activeDoc?.id === doc.id ? "rgba(201,162,39,0.12)" : "var(--bg-elevated)",
                  border: `1px solid ${activeDoc?.id === doc.id ? "var(--sg-gold)" : "var(--border-subtle)"}`,
                  color: "var(--sg-white)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{doc.title}</span>
                  <span className="sg-badge sg-badge-grey">v{doc.version}</span>
                </div>
                <div className="sg-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  {doc.folder} · {doc.category} · {doc.classification}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="sg-card">
          {activeDoc ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FileText size={18} style={{ color: "var(--sg-gold)" }} />
                    <h2 style={{ fontSize: "1.25rem" }}>{activeDoc.title}</h2>
                  </div>
                  <div className="sg-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                    Folder: {activeDoc.folder} | Category: {activeDoc.category} | Division: {activeDoc.division_code || "Cross-Division"} | Updated: {activeDoc.updated_at.slice(0, 10)}
                  </div>
                </div>
                <span className="sg-badge sg-badge-gold">{activeDoc.classification}</span>
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.86rem",
                  lineHeight: 1.6,
                  padding: "1rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {activeDoc.content_text || "(Empty record body)"}
              </pre>
            </div>
          ) : (
            <div className="sg-muted">Select a record to inspect its contents.</div>
          )}
        </div>
      </div>
    </div>
  );
}
