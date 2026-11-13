"use client";

import { useState } from "react";
import { Shield, KeyRound, Activity, RefreshCw } from "lucide-react";

export function SettingsMfaClient({
  email,
  fullName,
  jobTitle,
  roleCode,
  organizationName,
  initialMfaEnabled,
  aiProviderSummary,
}: {
  email: string;
  fullName: string;
  jobTitle: string | null;
  roleCode: string;
  organizationName: string;
  initialMfaEnabled: boolean;
  aiProviderSummary: { configured: boolean; label: string; model: string | null };
}) {
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [currentPassword, setCurrentPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function startMfaSetup(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const res = await fetch("/api/v1/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setup", currentPassword }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message || "Could not start MFA enrollment.");
      return;
    }
    if (json.data) {
      setSecret(json.data.secret);
      setOtpauthUri(json.data.otpauthUri);
    }
  }

  async function enableMfa(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const res = await fetch("/api/v1/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", currentPassword, secret, code }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message || "Invalid verification code or password.");
      return;
    }
    setMfaEnabled(true);
    setSecret("");
    setOtpauthUri("");
    setCode("");
    setCurrentPassword("");
    setRecoveryCodes(json.data?.recoveryCodes || null);
    setMsg("Two-Factor Authentication (TOTP MFA) is now active. Save your single-use recovery backup codes below.");
  }

  async function regenerateRecoveryCodes() {
    setMsg("");
    setErr("");
    const res = await fetch("/api/v1/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate_recovery", currentPassword, code }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message || "Provide current password and 6-digit authenticator code to rotate backup codes.");
      return;
    }
    setCode("");
    setCurrentPassword("");
    setRecoveryCodes(json.data?.recoveryCodes || null);
    setMsg("Generated a new set of single-use MFA recovery codes. Previous backup codes are invalidated.");
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const res = await fetch("/api/v1/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable", currentPassword, code }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message || "Invalid password or verification code.");
      return;
    }
    setMfaEnabled(false);
    setCode("");
    setCurrentPassword("");
    setRecoveryCodes(null);
    setMsg("TOTP MFA has been disabled and all recovery backup codes were cleared.");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card">
        <span className="sg-badge sg-badge-gold">Profile, Security &amp; Platform Health</span>
        <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Account Settings &amp; System Configuration</h1>
      </div>

      {msg && <div className="sg-banner" role="status">{msg}</div>}
      {err && <div className="sg-banner sg-banner-error" role="alert">{err}</div>}

      {recoveryCodes && recoveryCodes.length > 0 && (
        <div className="sg-card-gold" role="region" aria-label="Single-use MFA recovery backup codes">
          <div className="sg-eyebrow" style={{ marginBottom: "0.4rem" }}>
            Single-Use MFA Recovery Codes — Shown Once
          </div>
          <p className="sg-muted" style={{ fontSize: "0.84rem", margin: "0 0 0.75rem" }}>
            Store these codes securely offline. Each code is hashed at rest and valid for a single emergency sign-in if your authenticator device is lost.
          </p>
          <div className="sg-grid sg-grid-4" style={{ gap: "0.5rem" }}>
            {recoveryCodes.map((rc) => (
              <code
                key={rc}
                className="sg-mono"
                style={{
                  padding: "0.45rem 0.65rem",
                  background: "var(--sg-black)",
                  border: "1px solid var(--sg-gold-border)",
                  borderRadius: "var(--sg-radius-sm)",
                  textAlign: "center",
                  fontSize: "0.85rem",
                }}
              >
                {rc}
              </code>
            ))}
          </div>
        </div>
      )}

      <div className="sg-grid sg-grid-2" style={{ alignItems: "start" }}>
        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={18} style={{ color: "var(--sg-gold)" }} />
            <h2 style={{ fontSize: "1.15rem" }}>Operator Identity</h2>
          </div>
          <div className="sg-muted" style={{ fontSize: "0.9rem" }}>Full Name: <strong style={{ color: "var(--sg-white)" }}>{fullName}</strong></div>
          <div className="sg-muted" style={{ fontSize: "0.9rem" }}>Email: <strong style={{ color: "var(--sg-white)" }}>{email}</strong></div>
          <div className="sg-muted" style={{ fontSize: "0.9rem" }}>Title: {jobTitle || "Operator"}</div>
          <div className="sg-muted" style={{ fontSize: "0.9rem" }}>Organization: <strong style={{ color: "var(--sg-white)" }}>{organizationName}</strong></div>
          <div className="sg-muted" style={{ fontSize: "0.9rem" }}>Active Role: <span className="sg-badge sg-badge-gold">{roleCode}</span></div>
        </div>

        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <KeyRound size={18} style={{ color: "var(--sg-gold)" }} />
              <h2 style={{ fontSize: "1.15rem" }}>Two-Factor Authentication (TOTP)</h2>
            </div>
            <span className={`sg-badge ${mfaEnabled ? "sg-badge-gold" : "sg-badge-grey"}`}>
              {mfaEnabled ? "ENABLED" : "NOT ENABLED"}
            </span>
          </div>

          {!mfaEnabled ? (
            !secret ? (
              <form onSubmit={startMfaSetup} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div>
                  <label className="sg-label" htmlFor="mfa-setup-pw">Confirm Current Password</label>
                  <input
                    id="mfa-setup-pw"
                    type="password"
                    className="sg-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current account password"
                    required
                  />
                </div>
                <button type="submit" className="sg-btn sg-btn-primary">
                  Generate TOTP Enrollment Secret
                </button>
              </form>
            ) : (
              <form onSubmit={enableMfa} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div className="sg-muted" style={{ fontSize: "0.82rem" }}>
                  Add this Base32 secret to any RFC 6238 authenticator app (server challenge valid 10 minutes):
                </div>
                <pre style={{ padding: "0.6rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem" }}>
                  {secret}
                </pre>
                <div className="sg-muted" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                  URI: <code>{otpauthUri}</code>
                </div>
                <div>
                  <label className="sg-label" htmlFor="mfa-enable-pw">Current Password</label>
                  <input
                    id="mfa-enable-pw"
                    type="password"
                    className="sg-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    id="mfa-enable-code"
                    aria-label="6-digit verification code"
                    className="sg-input sg-mono"
                    placeholder="6-digit verification code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                  <button type="submit" className="sg-btn sg-btn-primary">Verify &amp; Enable</button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={disableMfa} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <p className="sg-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                Verify your current password and active authenticator (or recovery code) to rotate backup codes or disable MFA.
              </p>
              <div>
                <label className="sg-label" htmlFor="mfa-manage-pw">Current Password</label>
                <input
                  id="mfa-manage-pw"
                  type="password"
                  className="sg-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="sg-label" htmlFor="mfa-manage-code">6-digit TOTP or Recovery Code</label>
                <input
                  id="mfa-manage-code"
                  className="sg-input sg-mono"
                  placeholder="6-digit code or XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={20}
                  required
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button type="button" className="sg-btn sg-btn-outline" onClick={regenerateRecoveryCodes}>
                  <RefreshCw size={14} /> Regenerate Backup Codes
                </button>
                <button type="submit" className="sg-btn sg-btn-secondary">Disable MFA</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="sg-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
          <Activity size={18} style={{ color: "var(--sg-gold)" }} />
          <h2 style={{ fontSize: "1.15rem" }}>AI &amp; Integration Runtime Posture</h2>
        </div>
        <div className="sg-muted" style={{ fontSize: "0.9rem" }}>
          SMART GRID AI Provider:{" "}
          <span className={`sg-badge ${aiProviderSummary.configured ? "sg-badge-gold" : "sg-badge-grey"}`}>
            {aiProviderSummary.label}
          </span>
          {aiProviderSummary.model && ` (${aiProviderSummary.model})`}
        </div>
        <p className="sg-muted" style={{ fontSize: "0.82rem", marginTop: "0.4rem" }}>
          Configure server environment variables (<code>GEMINI_API_KEY</code> or <code>OPENAI_API_KEY</code>) to enable live model inference without modifying source code.
        </p>
      </div>
    </div>
  );
}
