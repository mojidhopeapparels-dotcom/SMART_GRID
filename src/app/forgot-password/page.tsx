"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Unable to submit password reset request.");
      } else {
        setStatus(
          json?.data?.message ||
            "If an active account matches that email, reset instructions were queued."
        );
      }
    } catch {
      setError("Network error while requesting password reset.");
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
            Reset Enterprise Password
          </h1>
          <p className="sg-muted" style={{ fontSize: "0.88rem", margin: 0 }}>
            Request a single-use, 15-minute password recovery link. Completing a reset revokes all active sessions.
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
              {status}
            </div>
          )}

          <div>
            <label className="sg-label" htmlFor="fp-email">Work Email</label>
            <input
              id="fp-email"
              type="email"
              required
              className="sg-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.org"
            />
          </div>

          <button type="submit" className="sg-btn sg-btn-primary" disabled={loading}>
            <Mail size={15} />
            {loading ? "Submitting..." : "Send Password Reset Link"}
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }} className="sg-muted">
            <Link href="/sign-in" style={{ color: "var(--sg-gold)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <ArrowLeft size={13} /> Back to Sign In
            </Link>
            <Link href="/reset-password">Have a reset token?</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
