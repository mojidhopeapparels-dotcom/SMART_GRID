"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Globe2,
  Layers,
  LogOut,
  ShieldCheck,
  Table2,
  Users,
  AlertCircle,
} from "lucide-react";

function formatTimer(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CareerFestLandingClient({
  activeSession,
  statusNotice,
}: {
  activeSession: {
    expiresAt: string;
    remainingSeconds: number;
  } | null;
  statusNotice: "expired" | "ended" | null;
}) {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const [ending, setEnding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(activeSession?.remainingSeconds ?? 0);

  useEffect(() => {
    if (!activeSession) return;
    const expiryMs = Date.parse(activeSession.expiresAt);
    const update = () => {
      if (Number.isFinite(expiryMs)) {
        setRemaining(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
      }
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  async function handleExploreClick() {
    setErrorMsg(null);
    setEntering(true);
    try {
      const res = await fetch("/api/career-fest/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json?.error?.message || "Unable to start visitor session right now.");
        setEntering(false);
        return;
      }
      router.push(json?.data?.redirectTo || "/app");
      router.refresh();
    } catch {
      setErrorMsg("Network error while initializing your 30-minute showcase session.");
      setEntering(false);
    }
  }

  async function handleExitDemo() {
    setEnding(true);
    try {
      await fetch("/api/career-fest/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      router.push("/career-fest?ended=1");
      router.refresh();
    } finally {
      setEnding(false);
    }
  }

  const hasLiveSession = Boolean(activeSession && remaining > 0);

  return (
    <div>
      {/* Hero Section — Black #080808 + Gold #C9A227 + White #FFFFFF */}
      <section
        style={{
          padding: "3.5rem 0 3.25rem",
          borderBottom: "1px solid var(--sg-border)",
          background:
            "radial-gradient(circle at 80% 18%, rgba(201,162,39,0.18) 0%, rgba(8,8,8,0) 58%)",
        }}
      >
        <div className="sg-container">
          {statusNotice === "expired" && (
            <div
              role="status"
              style={{
                marginBottom: "1.5rem",
                padding: "0.95rem 1.15rem",
                borderRadius: "var(--sg-radius)",
                border: "1px solid rgba(217,119,6,0.65)",
                background: "rgba(217,119,6,0.14)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.65rem",
              }}
            >
              <Clock size={18} style={{ color: "#FBBF24", flexShrink: 0, marginTop: "0.15rem" }} aria-hidden="true" />
              <div>
                <div style={{ fontWeight: 700, color: "#FCD34D" }}>30-Minute Career Fest Session Expired</div>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.9rem", color: "var(--sg-white)" }}>
                  Your interactive showcase session reached its 30-minute limit. Tap{" "}
                  <strong>EXPLORE SMART GRID</strong> below anytime to launch a fresh isolated visitor session.
                </p>
              </div>
            </div>
          )}

          {statusNotice === "ended" && (
            <div
              role="status"
              style={{
                marginBottom: "1.5rem",
                padding: "0.95rem 1.15rem",
                borderRadius: "var(--sg-radius)",
                border: "1px solid var(--sg-gold-border)",
                background: "var(--sg-gold-soft)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.65rem",
              }}
            >
              <CheckCircle2 size={18} style={{ color: "var(--sg-gold)", flexShrink: 0, marginTop: "0.15rem" }} aria-hidden="true" />
              <div>
                <div style={{ fontWeight: 700, color: "var(--sg-gold)" }}>Visitor Session Ended</div>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.9rem", color: "var(--sg-white)" }}>
                  Thank you for exploring SMART GRID at Career Fest 2026. Your temporary session has been closed.
                </p>
              </div>
            </div>
          )}

          <div style={{ maxWidth: "820px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.9rem" }}>
              <span className="sg-badge sg-badge-gold">Career Fest 2026 Showcase</span>
              <span className="sg-badge" style={{ border: "1px solid var(--sg-border)", color: "var(--sg-white)" }}>
                30-Minute Full Approved Access
              </span>
              {hasLiveSession && (
                <span className="sg-badge sg-badge-gold sg-mono">
                  Active Session · {formatTimer(remaining)} left
                </span>
              )}
            </div>

            <div className="sg-eyebrow">Global Smart City Intelligence &amp; Management Ecosystem</div>
            <h1 className="sg-h1" style={{ marginBottom: "0.65rem" }}>
              WELCOME TO SMART GRID
              <span
                style={{
                  display: "block",
                  color: "var(--sg-gold)",
                  fontSize: "clamp(1.25rem, 3.2vw, 2rem)",
                  marginTop: "0.35rem",
                }}
              >
                The Intelligence Behind Tomorrow&apos;s Cities.
              </span>
            </h1>

            <p
              style={{
                fontSize: "1.06rem",
                color: "#E5E5E5",
                maxWidth: "700px",
                marginBottom: "1.75rem",
                lineHeight: 1.65,
              }}
            >
              Discover the world&apos;s first Global Smart City Intelligence Ecosystem connecting
              urban infrastructure, city governance, AI-powered analytics, geospatial intelligence,
              and sustainability management into one unified platform.
            </p>

            {errorMsg && (
              <div
                role="alert"
                style={{
                  marginBottom: "1rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--sg-radius-sm)",
                  border: "1px solid var(--sg-danger)",
                  background: "rgba(239,68,68,0.12)",
                  color: "#FCA5A5",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.9rem",
                }}
              >
                <AlertCircle size={16} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleExploreClick}
                disabled={entering}
                className="sg-btn sg-btn-primary"
                style={{
                  minHeight: "48px",
                  padding: "0.8rem 1.55rem",
                  fontSize: "0.96rem",
                  letterSpacing: "0.02em",
                }}
              >
                {entering ? "Starting 30-Minute Session..." : "EXPLORE SMART GRID"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>

              {hasLiveSession ? (
                <button
                  type="button"
                  onClick={handleExitDemo}
                  disabled={ending}
                  className="sg-btn sg-btn-outline"
                  style={{ minHeight: "48px", padding: "0.8rem 1.2rem" }}
                >
                  <LogOut size={16} aria-hidden="true" />
                  {ending ? "Ending..." : "Exit Demo"}
                </button>
              ) : (
                <Link
                  href="/divisions"
                  className="sg-btn sg-btn-outline"
                  style={{ minHeight: "48px", padding: "0.8rem 1.2rem" }}
                >
                  Preview 24 Divisions
                </Link>
              )}
            </div>

            <p style={{ marginTop: "0.85rem", fontSize: "0.84rem", color: "#A3A3A3" }}>
              No sign-up required. Selecting <strong>EXPLORE SMART GRID</strong> opens a private,
              isolated 30-minute Career Fest visitor session with access to all 24 Intelligence
              Divisions, City Intelligence, Digital Twin GIS, SMART GRID AI, and SMART GRID SHEETS.
            </p>
          </div>
        </div>
      </section>

      {/* Capabilities Strip — Crisp White Contrast Surface */}
      <section style={{ background: "var(--sg-white)", color: "var(--sg-black)", padding: "3.25rem 0" }}>
        <div className="sg-container">
          <div className="sg-eyebrow" style={{ color: "#8c6d11" }}>
            What You Can Explore Live
          </div>
          <h2 className="sg-h2" style={{ color: "var(--sg-black)", marginBottom: "0.5rem" }}>
            Inside Your 30-Minute Career Fest Sandbox
          </h2>
          <p style={{ color: "#525252", maxWidth: "700px", marginBottom: "1.75rem" }}>
            Every module uses truthful provenance tags—distinguishing{" "}
            <strong>SIMULATED</strong>, <strong>HISTORICAL</strong>, and{" "}
            <strong>INTEGRATION_REQUIRED</strong> sources without fabricating live municipal feeds.
          </p>

          <div className="sg-grid-4">
            {[
              {
                icon: Layers,
                title: "24 Intelligence Divisions",
                desc: "Navigate all 24 structured urban intelligence domains from Governance and Mobility to Energy, Water, Resilience, and Food Systems.",
              },
              {
                icon: Globe2,
                title: "City Intelligence & Digital Twin",
                desc: "Inspect sample global city profiles, spatial GeoJSON infrastructure nodes, scenarios, and readiness benchmarks.",
              },
              {
                icon: Bot,
                title: "SMART GRID AI",
                desc: "Context-grounded urban analyst citing permitted workspace records while disclosing when external AI provider keys are unconfigured.",
              },
              {
                icon: Table2,
                title: "SMART GRID SHEETS",
                desc: "Interactive multi-sheet analytics engine supporting live formulas (=SUM, =AVERAGE, =IF, =ROUND) and CSV/XLSX export isolated per session.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  style={{
                    background: "#FAFAFA",
                    border: "1px solid var(--sg-border-light)",
                    borderRadius: "var(--sg-radius)",
                    padding: "1.25rem",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "8px",
                      background: "var(--sg-black)",
                      color: "var(--sg-gold)",
                      display: "grid",
                      placeItems: "center",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem", color: "var(--sg-black)" }}>
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.86rem", color: "#525252" }}>{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interdisciplinary Engineering Team + Security Disclosure */}
      <section style={{ padding: "3.25rem 0", borderTop: "1px solid var(--sg-border)" }}>
        <div className="sg-container">
          <div className="sg-grid-2" style={{ alignItems: "start" }}>
            <div className="sg-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.5rem" }}>
                <Users size={18} style={{ color: "var(--sg-gold)" }} aria-hidden="true" />
                <div className="sg-eyebrow" style={{ margin: 0 }}>Project Engineering Team</div>
              </div>
              <h2 className="sg-h3" style={{ fontSize: "1.25rem" }}>
                Built by a Six-Member Interdisciplinary Team
              </h2>
              <p style={{ color: "#D4D4D4", fontSize: "0.9rem", marginBottom: "0.9rem" }}>
                SMART GRID is engineered collaboratively by a six-member interdisciplinary team
                combining expertise across urban systems and software architecture:
              </p>
              <div className="sg-grid-2" style={{ gap: "0.6rem" }}>
                {[
                  "Urban Systems & Division Architecture",
                  "Full-Stack Platform & Database Engineering",
                  "Applied AI & Provenance Retrieval",
                  "Geospatial & Digital Twin Visualization",
                  "SMART GRID SHEETS Formula & Export Engine",
                  "Application Security, RBAC & Reliability",
                ].map((track) => (
                  <div
                    key={track}
                    style={{
                      padding: "0.55rem 0.7rem",
                      borderRadius: "var(--sg-radius-sm)",
                      border: "1px solid var(--sg-border)",
                      background: "var(--sg-black)",
                      fontSize: "0.82rem",
                      color: "var(--sg-white)",
                    }}
                  >
                    {track}
                  </div>
                ))}
              </div>
            </div>

            <div className="sg-card-gold">
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.5rem" }}>
                <ShieldCheck size={18} style={{ color: "var(--sg-gold)" }} aria-hidden="true" />
                <div className="sg-eyebrow" style={{ margin: 0 }}>Visitor Isolation &amp; Privacy</div>
              </div>
              <h2 className="sg-h3" style={{ fontSize: "1.25rem" }}>
                Strict Sandbox Governance
              </h2>
              <ul
                style={{
                  margin: "0.5rem 0 0",
                  paddingLeft: "1.15rem",
                  display: "grid",
                  gap: "0.45rem",
                  fontSize: "0.88rem",
                  color: "#E5E5E5",
                }}
              >
                <li>Hard server-enforced 30-minute session lifetime with explicit Exit Demo control.</li>
                <li>Cross-visitor workbook and AI conversation isolation (other visitors cannot view your work).</li>
                <li>Administrative panels, MFA settings, billing, API keys, and enterprise tenants remain strictly unreachable (HTTP 403).</li>
                <li>No personal login, visitor email, or behavioral PII is required or persisted.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
