"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";

export interface DemoPreset {
  label: string;
  email: string;
  password?: string;
}

export function SignInForm({
  allowDemoAccounts,
  demoPresets = [],
}: {
  allowDemoAccounts: boolean;
  demoPresets?: DemoPreset[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(mfaNeeded && !useRecovery && totpCode ? { totpCode } : {}),
          ...(mfaNeeded && useRecovery && recoveryCode ? { recoveryCode } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.error?.code === "MFA_REQUIRED") {
          setMfaNeeded(true);
          setError("Enter the 6-digit TOTP code or switch to a single-use backup recovery code.");
        } else {
          setError(json?.error?.message || "Authentication failed.");
        }
      } else {
        router.push("/app");
        router.refresh();
      }
    } catch {
      setError("Network error during sign-in.");
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFill(preset: DemoPreset) {
    setEmail(preset.email);
    if (preset.password) {
      setPassword(preset.password);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: "480px", display: "grid", gap: "1.25rem" }}>
        <div style={{ textAlign: "center" }}>
          <Link href="/" className="sg-brand-mark" style={{ justifyContent: "center" }}>
            <span className="sg-brand-emblem">SG</span>
            <span>SMART GRID</span>
          </Link>
          <h1 className="sg-h2" style={{ marginTop: "1rem", marginBottom: "0.25rem" }}>Enterprise Sign In</h1>
          <p className="sg-muted" style={{ fontSize: "0.88rem", margin: 0 }}>
            Access your organization&apos;s governed urban intelligence workspace.
          </p>
        </div>

        <form onSubmit={onSubmit} className="sg-card" style={{ display: "grid", gap: "1rem" }}>
          {error && (
            <div className="sg-banner sg-banner-error" role="alert">
              {error}
            </div>
          )}

          <div>
            <label className="sg-label" htmlFor="si-email">Work Email</label>
            <input
              id="si-email"
              type="email"
              required
              className="sg-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.org"
            />
          </div>

          <div>
            <label className="sg-label" htmlFor="si-pass">Password</label>
            <input
              id="si-pass"
              type="password"
              required
              className="sg-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          {mfaNeeded && (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {!useRecovery ? (
                <div>
                  <label className="sg-label" htmlFor="si-totp">Authenticator Code (6 digits)</label>
                  <input
                    id="si-totp"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    className="sg-input sg-mono"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                  />
                </div>
              ) : (
                <div>
                  <label className="sg-label" htmlFor="si-recovery">Single-Use Recovery Code</label>
                  <input
                    id="si-recovery"
                    type="text"
                    required
                    className="sg-input sg-mono"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX"
                  />
                </div>
              )}
              <button
                type="button"
                className="sg-btn sg-btn-ghost"
                style={{ justifyContent: "flex-start", padding: "0.2rem 0", fontSize: "0.78rem", color: "var(--sg-gold)" }}
                onClick={() => setUseRecovery((v) => !v)}
              >
                {useRecovery ? "Use 6-digit authenticator code instead" : "Lost authenticator? Use a backup recovery code"}
              </button>
            </div>
          )}

          <button type="submit" className="sg-btn sg-btn-primary" disabled={loading}>
            <Lock size={15} />
            {loading ? "Signing in..." : "Sign In to Enterprise App"}
            <ArrowRight size={15} />
          </button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-between", fontSize: "0.82rem" }} className="sg-muted">
            <Link href="/forgot-password" style={{ color: "var(--sg-gold)" }}>Forgot password?</Link>
            <Link href="/sign-up" style={{ color: "var(--sg-gold)" }}>Register organization</Link>
            <Link href="/">Public Site</Link>
          </div>
        </form>

        {allowDemoAccounts && demoPresets.length > 0 && (
          <div className="sg-card-gold">
            <div className="sg-eyebrow" style={{ marginBottom: "0.45rem" }}>Evaluation Accounts (Dev / Test Mode Only)</div>
            <p className="sg-muted" style={{ fontSize: "0.78rem", margin: "0 0 0.65rem" }}>
              Pre-seeded accounts for verifying RBAC roles and multi-tenant isolation in non-production environments.
            </p>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {demoPresets.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="sg-btn sg-btn-ghost"
                  style={{ justifyContent: "space-between", fontSize: "0.78rem", padding: "0.4rem 0.65rem" }}
                  onClick={() => handleQuickFill(acc)}
                >
                  <span>{acc.label}</span>
                  <span className="sg-mono" style={{ color: "var(--sg-gold)" }}>{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
