"use client";

import { useState } from "react";
import { Check, CheckCircle2, Bell } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface AlertRow {
  id: string;
  title: string;
  message: string;
  alert_type: string;
  priority: string;
  status: string;
  data_status: string;
  created_at: string;
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  category: string;
  is_read: number;
  created_at: string;
}

export function AlertsClient({
  initialAlerts,
  initialNotifications,
  canWrite,
}: {
  initialAlerts: AlertRow[];
  initialNotifications: NotificationRow[];
  canWrite: boolean;
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [aRes, nRes] = await Promise.all([
        fetch("/api/v1/operations?type=alerts"),
        fetch("/api/v1/operations?type=notifications"),
      ]);
      if (aRes.ok) setAlerts((await aRes.json()).data);
      if (nRes.ok) setNotifications((await nRes.json()).data);
      if (!aRes.ok || !nRes.ok) {
        setError("Failed to refresh alerts or notifications.");
      }
    } catch {
      setError("Network error while refreshing alerts.");
    }
  }

  async function act(action: "ALERT_ACK" | "ALERT_RESOLVE" | "NOTIFICATION_READ", id: string) {
    setError("");
    try {
      const res = await fetch("/api/v1/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error?.message || "Failed to update alert status.");
        return;
      }
      await refresh();
    } catch {
      setError("Network error updating alert.");
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <div className="sg-eyebrow">Monitoring &amp; Escalation</div>
        <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Alert &amp; Notification Center</h1>
        <p className="sg-muted" style={{ margin: 0 }}>
          Acknowledge and resolve data freshness, sensor, and threshold alerts with full audit logging.
        </p>
      </div>

      {error && <div className="sg-banner sg-banner-error" role="alert">{error}</div>}

      <div className="sg-card">
        <h2 className="sg-h3">Organization Alerts ({alerts.length})</h2>
        {alerts.length === 0 ? (
          <p className="sg-muted">No alerts recorded.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {alerts.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.75rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{a.title}</strong>
                    <span className="sg-badge sg-badge-grey">{a.priority}</span>
                    <span className="sg-badge sg-badge-white">{a.status}</span>
                    <StatusBadge status={a.data_status} />
                  </div>
                  <p className="sg-muted" style={{ margin: "0.3rem 0 0", fontSize: "0.84rem" }}>{a.message}</p>
                </div>
                {canWrite && a.status !== "RESOLVED" && (
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {a.status === "ACTIVE" && (
                      <button type="button" className="sg-btn sg-btn-outline" onClick={() => act("ALERT_ACK", a.id)}>
                        <Check size={14} /> Acknowledge
                      </button>
                    )}
                    <button type="button" className="sg-btn sg-btn-primary" onClick={() => act("ALERT_RESOLVE", a.id)}>
                      <CheckCircle2 size={14} /> Resolve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sg-card">
        <h2 className="sg-h3"><Bell size={16} style={{ display: "inline", marginRight: 6 }} />User Notifications ({notifications.length})</h2>
        {notifications.length === 0 ? (
          <p className="sg-muted">No notifications in your inbox.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {notifications.map((n) => (
              <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.5rem" }}>
                <div>
                  <div style={{ fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
                  <div className="sg-muted" style={{ fontSize: "0.82rem" }}>{n.body}</div>
                </div>
                {!n.is_read ? (
                  <button type="button" className="sg-btn sg-btn-ghost" onClick={() => act("NOTIFICATION_READ", n.id)}>
                    Mark Read
                  </button>
                ) : (
                  <span className="sg-muted" style={{ fontSize: "0.76rem" }}>Read</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
