"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Clock, LogOut, Sparkles, Layers, Table2, LayoutDashboard, AlertTriangle } from "lucide-react";
import { CAREER_FEST_WARNING_THRESHOLD_SECONDS } from "@/lib/careerFest/constants";

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function CareerFestBanner({
  expiresAt,
  initialRemainingSeconds,
}: {
  expiresAt: string;
  initialRemainingSeconds: number;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number>(initialRemainingSeconds);
  const [exiting, setExiting] = useState(false);

  const verifyServerSession = useCallback(async () => {
    try {
      const res = await fetch("/api/career-fest/session/status", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      const data = json?.data;
      if (!data?.active) {
        router.replace("/career-fest?expired=1");
        router.refresh();
        return;
      }
      if (typeof data.remainingSeconds === "number") {
        setRemaining(data.remainingSeconds);
      }
    } catch {
      // Transient offline check; server guards enforce hard 30m limit on every route request
    }
  }, [router]);

  useEffect(() => {
    const expiryMs = Date.parse(expiresAt);

    const tick = () => {
      const secs = Number.isFinite(expiryMs)
        ? Math.max(0, Math.floor((expiryMs - Date.now()) / 1000))
        : 0;
      setRemaining(secs);
      if (secs <= 0) {
        void verifyServerSession();
      }
    };

    tick();
    const secTimer = window.setInterval(tick, 1000);
    const pollTimer = window.setInterval(() => {
      void verifyServerSession();
    }, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void verifyServerSession();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(secTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expiresAt, verifyServerSession]);

  async function handleExitDemo() {
    if (exiting) return;
    setExiting(true);
    try {
      await fetch("/api/career-fest/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      router.push("/career-fest?ended=1");
      router.refresh();
    }
  }

  const isWarning = remaining <= CAREER_FEST_WARNING_THRESHOLD_SECONDS;

  return (
    <section
      role="region"
      aria-label="Career Fest Visitor Session Status"
      style={{
        background: isWarning
          ? "linear-gradient(90deg, rgba(217,119,6,0.22) 0%, #111111 65%)"
          : "linear-gradient(90deg, rgba(201,162,39,0.18) 0%, #111111 70%)",
        borderBottom: `1px solid ${isWarning ? "rgba(217,119,6,0.65)" : "var(--sg-gold-border)"}`,
        padding: "0.7rem 1.25rem",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <span className="sg-badge sg-badge-gold">Career Fest Visitor · Visitor Access</span>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.25rem 0.6rem",
            borderRadius: "999px",
            border: `1px solid ${isWarning ? "#D97706" : "var(--sg-border)"}`,
            background: "#080808",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: isWarning ? "#FBBF24" : "var(--sg-white)",
          }}
          aria-live="polite"
        >
          {isWarning ? (
            <AlertTriangle size={14} aria-hidden="true" style={{ color: "#FBBF24" }} />
          ) : (
            <Clock size={14} aria-hidden="true" style={{ color: "var(--sg-gold)" }} />
          )}
          <span className="sg-mono">{formatCountdown(remaining)}</span>
          <span style={{ color: "var(--sg-grey-light)", fontWeight: 500 }}>remaining</span>
        </div>
        {isWarning && (
          <span style={{ fontSize: "0.78rem", color: "#FCD34D" }}>
            Under 5 minutes left — export any custom SHEETS workbooks before automatic reset.
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
        <Link href="/app" className="sg-btn sg-btn-ghost" style={{ padding: "0.38rem 0.68rem", fontSize: "0.76rem" }}>
          <LayoutDashboard size={13} aria-hidden="true" />
          Dashboard
        </Link>
        <Link href="/app/divisions" className="sg-btn sg-btn-ghost" style={{ padding: "0.38rem 0.68rem", fontSize: "0.76rem" }}>
          <Layers size={13} aria-hidden="true" />
          24 Divisions
        </Link>
        <Link href="/app/ai" className="sg-btn sg-btn-ghost" style={{ padding: "0.38rem 0.68rem", fontSize: "0.76rem" }}>
          <Sparkles size={13} aria-hidden="true" />
          SMART GRID AI
        </Link>
        <Link href="/app/sheets" className="sg-btn sg-btn-ghost" style={{ padding: "0.38rem 0.68rem", fontSize: "0.76rem" }}>
          <Table2 size={13} aria-hidden="true" />
          SHEETS
        </Link>
        <button
          type="button"
          onClick={handleExitDemo}
          disabled={exiting}
          className="sg-btn sg-btn-outline"
          style={{ padding: "0.42rem 0.85rem", fontSize: "0.78rem", borderColor: "var(--sg-gold)" }}
        >
          <LogOut size={13} aria-hidden="true" />
          {exiting ? "Ending..." : "Exit Demo"}
        </button>
      </div>
    </section>
  );
}
