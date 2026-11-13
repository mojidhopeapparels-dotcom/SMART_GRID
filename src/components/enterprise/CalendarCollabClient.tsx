"use client";

import { useState } from "react";
import { CalendarDays, MessageSquare, Send, Plus } from "lucide-react";
import { DIVISIONS } from "@/lib/domain/divisions";

interface CalendarRow {
  id: string;
  title: string;
  event_type: string;
  division_code: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
}

interface MessageRow {
  id: string;
  channel: string;
  author_name: string;
  body: string;
  created_at: string;
}

export function CalendarCollabClient({
  initialEvents,
  initialMessages,
  cities,
  canWrite,
}: {
  initialEvents: CalendarRow[];
  initialMessages: MessageRow[];
  cities: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [events, setEvents] = useState<CalendarRow[]>(initialEvents);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("INSPECTION");
  const [cityId, setCityId] = useState(cities[0]?.id || "");
  const [divisionCode, setDivisionCode] = useState("07");
  const [startAt, setStartAt] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [endAt, setEndAt] = useState(new Date(Date.now() + 90000000).toISOString().slice(0, 16));
  const [location, setLocation] = useState("");

  const [channel, setChannel] = useState("operations");
  const [msgBody, setMsgBody] = useState("");

  async function refresh() {
    try {
      const [eRes, mRes] = await Promise.all([
        fetch("/api/v1/operations?type=calendar").then((r) => r.json()),
        fetch("/api/v1/operations?type=collaboration").then((r) => r.json()),
      ]);
      if (eRes.data) setEvents(eRes.data);
      if (mRes.data) setMessages(mRes.data);
    } catch {
      // ignore background refresh failures; explicit error banner covers actions
    }
  }

  const [error, setError] = useState("");

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/v1/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "calendar_event",
          cityId: cityId || null,
          divisionCode: divisionCode || null,
          title,
          eventType,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          location: location || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error?.message || "Failed to create calendar event.");
        return;
      }
      setTitle("");
      setLocation("");
      await refresh();
    } catch {
      setError("Network error while creating calendar event.");
    }
  }

  async function postMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgBody.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/v1/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "team_message",
          cityId: cityId || null,
          channel,
          body: msgBody.trim(),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error?.message || "Failed to post team message.");
        return;
      }
      setMsgBody("");
      await refresh();
    } catch {
      setError("Network error while posting team message.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card">
        <span className="sg-badge sg-badge-gold">Scheduling & Municipal Coordination</span>
        <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Operations Calendar & Team Collaboration</h1>
        <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
          Shared inspection windows, maintenance cutovers, regulatory deadlines, and shift-handover channels.
        </p>
      </div>

      {error && <div className="sg-banner sg-banner-error" role="alert">{error}</div>}

      <div className="sg-grid sg-grid-2" style={{ alignItems: "start" }}>
        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CalendarDays size={18} style={{ color: "var(--sg-gold)" }} />
            <h2 style={{ fontSize: "1.15rem" }}>Scheduled Municipal Events ({events.length})</h2>
          </div>

          {canWrite && (
            <form onSubmit={addEvent} style={{ display: "flex", flexDirection: "column", gap: "0.65rem", padding: "0.85rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }}>
              <input className="sg-input" aria-label="Schedule event title" placeholder="Schedule title (e.g., Grid Relay Maintenance)" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <div className="sg-grid sg-grid-2">
                <select className="sg-select" aria-label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                  <option value="INSPECTION">INSPECTION</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="MEETING">MEETING</option>
                  <option value="DEADLINE">DEADLINE</option>
                  <option value="CITY_EVENT">CITY_EVENT</option>
                </select>
                <select className="sg-select" aria-label="Division code" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)}>
                  {DIVISIONS.map((d) => (
                    <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                  ))}
                </select>
                <input className="sg-input" type="datetime-local" aria-label="Event start time" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
                <input className="sg-input" type="datetime-local" aria-label="Event end time" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input className="sg-input" aria-label="Event location or sector" placeholder="Location / Sector" value={location} onChange={(e) => setLocation(e.target.value)} />
                <button type="submit" className="sg-btn sg-btn-primary">
                  <Plus size={14} /> Add
                </button>
              </div>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <strong>{ev.title}</strong>
                  <span className="sg-badge sg-badge-gold">{ev.event_type}</span>
                </div>
                <div className="sg-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {ev.start_at.replace("T", " ").slice(0, 16)} → {ev.end_at.replace("T", " ").slice(0, 16)}
                  {ev.location ? ` · ${ev.location}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <MessageSquare size={18} style={{ color: "var(--sg-gold)" }} />
            <h2 style={{ fontSize: "1.15rem" }}>Team Dispatch & Collaboration ({messages.length})</h2>
          </div>

          {canWrite && (
            <form onSubmit={postMessage} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <select className="sg-select" aria-label="Message channel" style={{ maxWidth: "160px" }} value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="operations">#operations</option>
                  <option value="energy-grid">#energy-grid</option>
                  <option value="incidents">#incidents</option>
                  <option value="planning">#planning</option>
                </select>
                <select className="sg-select" aria-label="Target city for dispatch message" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                  <option value="">All Cities</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input className="sg-input" aria-label="Team dispatch message" placeholder="Post shift update, field verification note, or dispatch handoff..." value={msgBody} onChange={(e) => setMsgBody(e.target.value)} />
                <button type="submit" className="sg-btn sg-btn-primary">
                  <Send size={14} /> Post
                </button>
              </div>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "460px", overflowY: "auto" }}>
            {messages.map((m) => (
              <div key={m.id} style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                  <span style={{ color: "var(--sg-gold)", fontWeight: 600 }}>#{m.channel} · {m.author_name}</span>
                  <span className="sg-muted">{m.created_at.replace("T", " ").slice(0, 16)}</span>
                </div>
                <p style={{ marginTop: "0.3rem", fontSize: "0.9rem" }}>{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
