"use client";

import { useEffect, useState } from "react";
import { Bot, Send, AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";
import { StatusBadge } from "@/components/ui/StatusBadge";

function safeParseCitations(raw?: string): { id: string; title: string; dataStatus: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface AiSessionRow {
  id: string;
  title: string;
  division_code: string | null;
  updated_at: string;
}

interface AiMessageRow {
  id: string;
  role: string;
  content: string;
  provider?: string | null;
  model?: string | null;
  citations_json?: string;
}

export function AiWorkspaceClient({
  providerStatus,
  initialSessions,
  cities,
}: {
  providerStatus: { configured: boolean; provider: string | null; model: string | null; reason?: string };
  initialSessions: AiSessionRow[];
  cities: { id: string; name: string }[];
}) {
  const [sessions, setSessions] = useState<AiSessionRow[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessions[0]?.id || null);
  const [messages, setMessages] = useState<AiMessageRow[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [divisionCode, setDivisionCode] = useState<string>("");
  const [mode, setMode] = useState<"WORKSPACE" | "REPORT_DRAFT">("WORKSPACE");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBox, setErrorBox] = useState<string | null>(null);

  async function selectSession(id: string) {
    setActiveSessionId(id);
    setErrorBox(null);
    const res = await fetch(`/api/v1/ai/sessions?sessionId=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (res.ok) {
      setMessages(json.data.messages || []);
    } else {
      setErrorBox(json?.error?.message || "Failed to load AI session messages.");
    }
  }

  async function deleteSession(id: string) {
    setErrorBox(null);
    const res = await fetch(`/api/v1/ai/sessions?sessionId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } else {
      const json = await res.json().catch(() => null);
      setErrorBox(json?.error?.message || "Failed to delete AI session.");
    }
  }

  useEffect(() => {
    const firstId = initialSessions[0]?.id;
    if (firstId) {
      void selectSession(firstId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setErrorBox(null);
    setLoading(true);
    const currentPrompt = prompt;
    setMessages((prev) => [...prev, { id: `tmp_${Date.now()}`, role: "user", content: currentPrompt }]);

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId || undefined,
          cityId: cityId || null,
          divisionCode: divisionCode || null,
          mode,
          prompt: currentPrompt,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorBox(`${json?.error?.code || "UNAVAILABLE"}: ${json?.error?.message}`);
        if (json?.error?.details?.sessionId && !activeSessionId) {
          setActiveSessionId(json.error.details.sessionId);
        }
      } else {
        setPrompt("");
        setActiveSessionId(json.data.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            id: json.data.messageId,
            role: "assistant",
            content: json.data.reply,
            provider: json.data.provider,
            model: json.data.model,
            citations_json: JSON.stringify(json.data.citations || []),
          },
        ]);
        const listRes = await fetch("/api/v1/ai/chat");
        const listJson = await listRes.json();
        if (listRes.ok) setSessions(listJson.data.sessions || []);
      }
    } catch {
      setErrorBox("Network error contacting SMART GRID AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Governed Intelligence Workspace</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>SMART GRID AI Workspace</h1>
          <p className="sg-muted" style={{ margin: 0 }}>
            Permission-aware urban intelligence, cross-division analysis, and cited report drafting.
          </p>
        </div>
        <StatusBadge status={providerStatus.configured ? "LIVE" : "INTEGRATION_REQUIRED"} />
      </div>

      {!providerStatus.configured && (
        <div className="sg-banner">
          <strong>AI Provider Configuration Required:</strong> {providerStatus.reason} Set{" "}
          <code>GEMINI_API_KEY</code> or <code>OPENAI_API_KEY</code> in server environment variables
          to activate live model completions. SMART GRID never simulates fake AI answers.
        </div>
      )}

      <div className="sg-split-sidebar">
        {/* Saved Sessions */}
        <div className="sg-card" style={{ display: "grid", gap: "0.65rem" }}>
          <button
            type="button"
            className="sg-btn sg-btn-primary"
            onClick={() => {
              setActiveSessionId(null);
              setMessages([]);
              setErrorBox(null);
            }}
          >
            <Plus size={14} /> New AI Session
          </button>
          <div className="sg-eyebrow" style={{ marginTop: "0.35rem" }}>Saved Sessions</div>
          {sessions.length === 0 ? (
            <p className="sg-muted" style={{ fontSize: "0.82rem", margin: 0 }}>No saved AI sessions yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.35rem" }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ display: "flex", gap: "0.25rem", alignItems: "stretch" }}>
                  <button
                    type="button"
                    onClick={() => selectSession(s.id)}
                    className={`sg-nav-item ${s.id === activeSessionId ? "sg-nav-item-active" : ""}`}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", background: s.id === activeSessionId ? undefined : "transparent", border: "1px solid var(--sg-border)", cursor: "pointer" }}
                  >
                    <Bot size={14} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                  </button>
                  <button
                    type="button"
                    className="sg-btn sg-btn-ghost"
                    style={{ padding: "0.35rem 0.5rem" }}
                    onClick={() => deleteSession(s.id)}
                    aria-label={`Delete session ${s.title}`}
                    title="Delete session"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Canvas */}
        <div className="sg-card" style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.75rem" }}>
            <select className="sg-select" style={{ width: "auto" }} value={cityId} onChange={(e) => setCityId(e.target.value)} aria-label="AI city context">
              <option value="">All Permitted Cities</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="sg-select" style={{ width: "auto" }} value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} aria-label="AI division context">
              <option value="">All 24 Divisions</option>
              {DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
            </select>
            <button
              type="button"
              className={`sg-btn ${mode === "REPORT_DRAFT" ? "sg-btn-primary" : "sg-btn-ghost"}`}
              onClick={() => setMode((m) => (m === "WORKSPACE" ? "REPORT_DRAFT" : "WORKSPACE"))}
            >
              <FileText size={14} /> {mode === "REPORT_DRAFT" ? "Report Draft Mode ON" : "Standard Q&A"}
            </button>
          </div>

          <div style={{ minHeight: "300px", maxHeight: "460px", overflowY: "auto", display: "grid", gap: "0.75rem", alignContent: "start" }}>
            {messages.length === 0 && (
              <p className="sg-muted" style={{ fontSize: "0.88rem" }}>
                Select a city or division context above and ask a question, or switch to Report Draft
                Mode to generate a structured division draft with source citations.
              </p>
            )}
            {messages.map((m) => {
              const citations = safeParseCitations(m.citations_json);
              return (
                <div
                  key={m.id}
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: 8,
                    background: m.role === "user" ? "var(--sg-gold-soft)" : "#141414",
                    border: "1px solid var(--sg-border)",
                  }}
                >
                  <div className="sg-eyebrow" style={{ marginBottom: "0.25rem" }}>
                    {m.role === "user" ? "Authorized User" : `SMART GRID AI (${m.provider || "model"} · ${m.model || ""})`}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>{m.content}</div>
                  {citations.length > 0 && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.76rem" }} className="sg-muted">
                      Sources: {citations.map((c) => `${c.title} [${c.dataStatus}]`).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
            {errorBox && (
              <div className="sg-banner sg-banner-error" role="alert">
                <AlertTriangle size={15} style={{ display: "inline", marginRight: 6 }} />
                {errorBox}
              </div>
            )}
          </div>

          <form onSubmit={sendPrompt} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              className="sg-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about city KPIs, alerts, or draft a division report..."
              aria-label="AI workspace prompt"
            />
            <button type="submit" className="sg-btn sg-btn-primary" disabled={loading}>
              <Send size={15} /> {loading ? "Querying..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
