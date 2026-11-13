"use client";

import Link from "next/link";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="sg-container" style={{ padding: "6rem 1.25rem", textAlign: "center", maxWidth: "620px" }}>
      <div className="sg-eyebrow">System Error Boundary</div>
      <h1 className="sg-h1">Something Went Wrong</h1>
      <p className="sg-muted" style={{ marginBottom: "1.75rem" }}>
        An unexpected rendering error occurred. Safe error reference:{" "}
        <code className="sg-mono">{error.digest || "local-session"}</code>
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
        <button type="button" className="sg-btn sg-btn-primary" onClick={() => reset()}>
          Try Again
        </button>
        <Link href="/" className="sg-btn sg-btn-outline">
          Public Home
        </Link>
      </div>
    </div>
  );
}
