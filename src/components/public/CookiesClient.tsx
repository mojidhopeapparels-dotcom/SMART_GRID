"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function CookiesClient() {
  const [analytics, setAnalytics] = useState(false);
  const [preferences, setPreferences] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sg_cookie_prefs");
      if (raw) {
        const parsed = JSON.parse(raw);
        setAnalytics(Boolean(parsed.analytics));
        setPreferences(Boolean(parsed.preferences));
      }
    } catch {
      // ignore
    }
  }, []);

  function save() {
    localStorage.setItem(
      "sg_cookie_prefs",
      JSON.stringify({ essential: true, preferences, analytics, updatedAt: new Date().toISOString() })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="sg-card" style={{ display: "grid", gap: "1rem" }}>
      <div style={{ borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.75rem" }}>
        <div style={{ fontWeight: 700 }}>Essential Authentication &amp; Security Cookies (Always Active)</div>
        <p className="sg-muted" style={{ fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          Required for HTTP-only signed session management (<code>sg_session</code>) and CSRF protection.
        </p>
      </div>

      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Workspace Preferences</div>
          <div className="sg-muted" style={{ fontSize: "0.85rem" }}>Remembers table density, sidebar state, and selected city view.</div>
        </div>
        <input type="checkbox" checked={preferences} onChange={(e) => setPreferences(e.target.checked)} />
      </label>

      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Product Telemetry (Optional)</div>
          <div className="sg-muted" style={{ fontSize: "0.85rem" }}>Disabled by default; no third-party ad trackers are loaded.</div>
        </div>
        <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button type="button" className="sg-btn sg-btn-primary" onClick={save}>
          Save Cookie Preferences
        </button>
        {saved && (
          <span role="status" style={{ color: "var(--sg-gold)", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <CheckCircle2 size={15} /> Saved locally
          </span>
        )}
      </div>
    </div>
  );
}
