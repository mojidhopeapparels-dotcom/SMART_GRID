"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X, AlertTriangle } from "lucide-react";

export function FloatingAiAssistant({ activeCityId }: { activeCityId: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant" | "error"; text: string; citations?: { id: string; title: string; dataStatus: string }[] }[]
  >([]);

  async function send() {
    const q = prompt.trim();
    if (!q || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          cityId: activeCityId,
          mode: "ASSISTANT",
          extraContext: `Current route: ${pathname}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            text: `${json?.error?.code || "UNAVAILABLE"}: ${json?.error?.message || "AI provider unavailable."}`,
            citations: json?.error?.details?.citations,
          },
        ]);
      } else {
        setPrompt("");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: json.data.reply, citations: json.data.citations },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "Network error contacting SMART GRID AI endpoint." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="sg-btn sg-btn-primary"
        aria-label="Toggle SMART GRID AI Assistant"
        style={{
          position: "fixed",
          right: "1.25rem",
          bottom: "1.25rem",
          zIndex: 50,
          borderRadius: "999px",
          padding: "0.75rem 1.15rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.65)",
        }}
      >
        <Bot size={18} />
        SMART GRID AI
      </button>

      {open && (
        <aside
          aria-label="SMART GRID AI Floating Assistant"
          style={{
            position: "fixed",
            right: "1.25rem",
            bottom: "4.75rem",
            width: "min(400px, calc(100vw - 2rem))",
            maxHeight: "70vh",
            background: "var(--sg-black-elevated)",
            border: "1px solid var(--sg-gold-border)",
            borderRadius: "var(--sg-radius)",
            zIndex: 55,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 18px 50px rgba(0,0,0,0.8)",
          }}
        >
          <div
            style={{
              padding: "0.85rem 1rem",
              borderBottom: "1px solid var(--sg-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div className="sg-eyebrow">Contextual Assistant</div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>SMART GRID AI</div>
            </div>
            <button type="button" className="sg-btn sg-btn-ghost" style={{ padding: "0.3rem" }} onClick={() => setOpen(false)} aria-label="Close AI assistant">
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem", display: "grid", gap: "0.65rem" }}>
            {messages.length === 0 && (
              <p className="sg-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                Ask about permitted city datasets, active alerts, or KPI definitions on{" "}
                <code className="sg-mono">{pathname}</code>. If no external LLM key is configured,
                the truthful unavailable state will be reported.
              </p>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: "0.65rem 0.75rem",
                  borderRadius: 8,
                  fontSize: "0.83rem",
                  background:
                    m.role === "user"
                      ? "var(--sg-gold-soft)"
                      : m.role === "error"
                        ? "rgba(239,68,68,0.12)"
                        : "#181818",
                  border:
                    m.role === "error"
                      ? "1px solid rgba(239,68,68,0.4)"
                      : "1px solid var(--sg-border)",
                }}
              >
                {m.role === "error" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#f87171", fontWeight: 700, marginBottom: "0.25rem" }}>
                    <AlertTriangle size={14} /> AI Provider Unavailable
                  </div>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                {m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: "0.45rem", fontSize: "0.74rem" }} className="sg-muted">
                    Permitted context checked: {m.citations.map((c) => `${c.title} [${c.dataStatus}]`).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: "0.75rem", borderTop: "1px solid var(--sg-border)", display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              className="sg-input"
              placeholder="Ask SMART GRID AI..."
              aria-label="Prompt SMART GRID AI"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button type="button" className="sg-btn sg-btn-primary" onClick={send} disabled={loading} aria-label="Send prompt">
              <Send size={15} />
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
