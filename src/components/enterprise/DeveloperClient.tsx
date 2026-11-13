"use client";

import { useState } from "react";
import { KeyRound, Webhook, Trash2, Plus } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes_json: string;
  rate_limit_per_min: number;
  status: string;
  created_at: string;
}

interface WebhookRow {
  id: string;
  name: string;
  target_url: string;
  event_types_json: string;
  status: string;
  created_at: string;
}

export function DeveloperClient({
  initialKeys,
  initialWebhooks,
}: {
  initialKeys: ApiKeyRow[];
  initialWebhooks: WebhookRow[];
}) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>(initialWebhooks);
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/v1/admin?scope=developer").then((r) => r.json());
    if (res.data) {
      setKeys(res.data.keys || []);
      setWebhooks(res.data.webhooks || []);
    }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRevealedKey("");
    const res = await fetch("/api/v1/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_API_KEY",
        name: keyName,
        scopes: ["read:cities", "read:divisions", "read:datasets"],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message || "Failed to generate API key.");
      return;
    }
    setRevealedKey(json.data.plaintextKeyOnce);
    setKeyName("");
    await refresh();
  }

  async function revokeKey(keyId: string) {
    setError("");
    try {
      const res = await fetch("/api/v1/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVOKE_API_KEY", keyId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error?.message || "Failed to revoke API key.");
        return;
      }
      await refresh();
    } catch {
      setError("Network error while revoking API key.");
    }
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/v1/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_WEBHOOK",
          name: whName,
          targetUrl: whUrl,
          eventTypes: ["alert.created", "incident.created", "workflow.completed"],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "Failed to register webhook.");
        return;
      }
      setWhName("");
      setWhUrl("");
      await refresh();
    } catch {
      setError("Network error while registering webhook.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card">
        <span className="sg-badge sg-badge-gold">Developer & API Management</span>
        <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Enterprise Developer Portal</h1>
        <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
          Issue scoped API credentials (hashed SHA-256 at rest) and manage HTTPS event webhooks.
        </p>
      </div>

      {error && <div className="sg-banner sg-banner-error" role="alert">{error}</div>}
      {revealedKey && (
        <div className="sg-card" style={{ borderColor: "var(--sg-gold)" }}>
          <strong style={{ color: "var(--sg-gold)" }}>One-Time API Key Generated — Copy Now</strong>
          <p className="sg-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Plaintext secrets are never stored or displayed again after this response:
          </p>
          <pre style={{ marginTop: "0.5rem", padding: "0.75rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }}>
            {revealedKey}
          </pre>
        </div>
      )}

      <div className="sg-grid sg-grid-2" style={{ alignItems: "start" }}>
        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <KeyRound size={18} style={{ color: "var(--sg-gold)" }} />
            <h2 style={{ fontSize: "1.15rem" }}>Tenant API Keys ({keys.length})</h2>
          </div>
          <form onSubmit={createKey} style={{ display: "flex", gap: "0.5rem" }}>
            <input className="sg-input" aria-label="New API key label" placeholder="Key label (e.g. SCADA Read Sync)" value={keyName} onChange={(e) => setKeyName(e.target.value)} required />
            <button type="submit" className="sg-btn sg-btn-primary">
              <Plus size={14} /> Issue
            </button>
          </form>
          <table className="sg-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Prefix</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td><strong>{k.name}</strong></td>
                  <td><code>{k.key_prefix}…</code></td>
                  <td><span className={`sg-badge ${k.status === "ACTIVE" ? "sg-badge-gold" : "sg-badge-grey"}`}>{k.status}</span></td>
                  <td>
                    {k.status === "ACTIVE" && (
                      <button type="button" className="sg-btn sg-btn-secondary" style={{ padding: "0.3rem 0.55rem" }} onClick={() => revokeKey(k.id)} title="Revoke API key" aria-label={`Revoke API key ${k.name}`}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Webhook size={18} style={{ color: "var(--sg-gold)" }} />
            <h2 style={{ fontSize: "1.15rem" }}>HTTPS Event Webhooks ({webhooks.length})</h2>
          </div>
          <form onSubmit={createWebhook} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input className="sg-input" aria-label="Webhook name" placeholder="Webhook name (e.g. Dispatch SIEM)" value={whName} onChange={(e) => setWhName(e.target.value)} required />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="sg-input" type="url" aria-label="Webhook HTTPS URL" placeholder="https://receiver.city.example/hooks/smart-grid" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} required />
              <button type="submit" className="sg-btn sg-btn-primary">
                <Plus size={14} /> Add
              </button>
            </div>
          </form>
          <table className="sg-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Endpoint</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="sg-muted">No webhooks registered yet.</td>
                </tr>
              ) : (
                webhooks.map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong></td>
                    <td className="sg-muted" style={{ fontSize: "0.8rem" }}>{w.target_url}</td>
                    <td><span className="sg-badge sg-badge-gold">{w.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
