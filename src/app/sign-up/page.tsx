"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, ArrowRight } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("MUNICIPALITY");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          organizationName,
          organizationType,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Could not register organization.");
      } else {
        router.push("/app");
        router.refresh();
      }
    } catch {
      setError("Network error during registration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: "500px", display: "grid", gap: "1.25rem" }}>
        <div style={{ textAlign: "center" }}>
          <Link href="/" className="sg-brand-mark" style={{ justifyContent: "center" }}>
            <span className="sg-brand-emblem">SG</span>
            <span>SMART GRID</span>
          </Link>
          <h1 className="sg-h2" style={{ marginTop: "1rem", marginBottom: "0.25rem" }}>Create Organization Workspace</h1>
          <p className="sg-muted" style={{ fontSize: "0.88rem", margin: 0 }}>
            Provision an isolated tenant workspace with an Organization Owner account.
          </p>
        </div>

        <form onSubmit={onSubmit} className="sg-card" style={{ display: "grid", gap: "0.9rem" }}>
          {error && (
            <div className="sg-banner sg-banner-error" role="alert">
              {error}
            </div>
          )}

          <div>
            <label className="sg-label" htmlFor="su-org">Organization Name</label>
            <input
              id="su-org"
              required
              minLength={2}
              className="sg-input"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. City of Helsinki Urban Data Office"
            />
          </div>

          <div>
            <label className="sg-label" htmlFor="su-type">Organization Type</label>
            <select id="su-type" className="sg-select" value={organizationType} onChange={(e) => setOrganizationType(e.target.value)}>
              <option value="MUNICIPALITY">Municipality / City Authority</option>
              <option value="GOVERNMENT_AGENCY">Government Agency</option>
              <option value="UTILITY">Utility / Infrastructure Operator</option>
              <option value="RESEARCH_INSTITUTE">University / Research Institute</option>
              <option value="ENTERPRISE">Enterprise Organization</option>
            </select>
          </div>

          <div>
            <label className="sg-label" htmlFor="su-name">Full Name</label>
            <input
              id="su-name"
              required
              minLength={2}
              className="sg-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="sg-label" htmlFor="su-email">Work Email</label>
            <input
              id="su-email"
              type="email"
              required
              className="sg-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.org"
            />
          </div>

          <div>
            <label className="sg-label" htmlFor="su-pass">Password (minimum 10 characters)</label>
            <input
              id="su-pass"
              type="password"
              required
              minLength={10}
              className="sg-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
            />
          </div>

          <button type="submit" className="sg-btn sg-btn-primary" disabled={loading}>
            <Building2 size={15} />
            {loading ? "Provisioning Workspace..." : "Create Isolated Workspace"}
            <ArrowRight size={15} />
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }} className="sg-muted">
            <Link href="/sign-in" style={{ color: "var(--sg-gold)" }}>Already registered? Sign in</Link>
            <Link href="/">Public Website</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
