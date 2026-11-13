"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";

export default function ResetPasswordClient({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Password reset failed.");
      } else {
        setStatus(
          json?.data?.message ||
            "Password reset complete and all active sessions revoked."
        );
        setNewPassword("");
        setConfirmPassword("");
        setToken("");
      }
    } catch {
      setError("Network error while confirming password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: "460px", display: "grid", gap: "1.25rem" }}>
        <div style={{ textAlign: "center" }}>
          <Link href="/" className="sg-brand-mark" style={{ justifyContent: "center" }}>
            <span className="sg-brand-emblem">SG</span>
            <span>SMART GRID</span>
          </Link>
          <h1 className="sg-h2" style={{ marginTop: "1rem", marginBottom: "0.25rem" }}>
            Set New Password
          </h1>
          <p className="sg-muted" style={{ fontSize: "0.88rem", margin: 0 }}>
            Tokens are valid once for 15 minutes. All existing sessions are terminated on completion.
          </p>
        </div>

        <form onSubmit={onSubmit} className="sg-card" style={{ display: "grid", gap: "1rem" }}>
          {error && (
            <div className="sg-banner sg-banner-error" role="alert">
              {error}
            </div>
          )}
          {status && (
            <div className="sg-banner" role="status">
              <CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: "0.35rem" }} />
              {status}
            </div>
          )}

          <div>
            <label className="sg-label" htmlFor="rp-token">Reset Token</label>
            <input
              id="rp-token"
              type="text"
              required
              className="sg-input sg-mono"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token from password reset email"
            />
          </div>

          <div>
            <label className="sg-label" htmlFor="rp-new">New Password (min 10 chars)</label>
            <input
              id="rp-new"
              type="password"
              required
              minLength={10}
              className="sg-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 10 characters"
            />
          </div>

          <div>
            <label className="sg-label" htmlFor="rp-confirm">Confirm New Password</label>
            <input
              id="rp-confirm"
              type="password"
              required
              minLength={10}
              className="sg-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>

          <button type="submit" className="sg-btn sg-btn-primary" disabled={loading}>
            <KeyRound size={15} />
            {loading ? "Updating..." : "Update Password"}
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }} className="sg-muted">
            <Link href="/sign-in" style={{ color: "var(--sg-gold)" }}>Proceed to Sign In</Link>
            <Link href="/forgot-password">Request another token</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
