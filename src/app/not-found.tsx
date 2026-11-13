import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="sg-container" style={{ padding: "6rem 1.25rem", textAlign: "center", maxWidth: "620px" }}>
      <div className="sg-eyebrow">HTTP 404</div>
      <h1 className="sg-h1">Route Not Found</h1>
      <p className="sg-muted" style={{ marginBottom: "1.75rem" }}>
        The requested SMART GRID page or record could not be located or you may not have permission
        to view it.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/" className="sg-btn sg-btn-primary">Return to Public Home</Link>
        <Link href="/app" className="sg-btn sg-btn-outline">Go to Enterprise Workspace</Link>
      </div>
    </div>
  );
}
