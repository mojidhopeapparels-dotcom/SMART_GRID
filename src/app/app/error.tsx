"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function EnterpriseErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Enterprise route boundary caught an error:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div style={{ padding: "2rem 0", maxWidth: 680 }}>
      <div className="sg-card" role="alert" style={{ display: "grid", gap: "1rem", borderColor: "var(--sg-danger)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <AlertTriangle size={20} style={{ color: "var(--sg-danger)" }} aria-hidden="true" />
          <h1 className="sg-h2" style={{ margin: 0, fontSize: "1.35rem" }}>
            Unable to Render Enterprise View
          </h1>
        </div>
        <p className="sg-muted" style={{ margin: 0, fontSize: "0.92rem" }}>
          An unexpected error interrupted this workspace view. No database changes were forced by this screen.
          {error.digest ? ` Reference digest: ${error.digest}.` : ""}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => reset()}>
            <RefreshCw size={15} aria-hidden="true" /> Retry View
          </button>
          <Link href="/app" className="sg-btn sg-btn-outline">
            Return to Executive Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
