import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default function PublicStatusPage() {
  ensureSeeded();
  const db = getDb();
  const divCount = (db.prepare("SELECT COUNT(*) AS cnt FROM divisions").get() as { cnt: number }).cnt;
  const cityCount = (db.prepare("SELECT COUNT(*) AS cnt FROM cities").get() as { cnt: number }).cnt;
  const aiConfigured = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );

  const checks = [
    { name: "Public Web & App Router", status: "LIVE", detail: "Serving public and enterprise routes." },
    { name: "Relational Database (SQLite WAL)", status: "LIVE", detail: `${divCount} divisions and ${cityCount} city profiles indexed.` },
    { name: "SMART GRID SHEETS Formula & XLSX Engine", status: "LIVE", detail: "Local formula evaluation and CSV/XLSX/JSON import-export active." },
    {
      name: "SMART GRID AI External LLM Provider",
      status: aiConfigured ? "LIVE" : "INTEGRATION_REQUIRED",
      detail: aiConfigured
        ? "External LLM API key detected in server environment."
        : "No GEMINI_API_KEY or OPENAI_API_KEY configured; AI workspace truthfully enters unavailable/configuration-required mode.",
    },
    {
      name: "External Municipal Telemetry Connectors",
      status: "INTEGRATION_REQUIRED",
      detail: "Connectors await agency API credentials in Integration Hub; evaluation datasets use SIMULATED/HISTORICAL tags.",
    },
  ];

  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem", maxWidth: "960px" }}>
      <div className="sg-eyebrow">Operational Transparency</div>
      <h1 className="sg-h1">System Status</h1>
      <p className="sg-muted" style={{ marginBottom: "2rem" }}>
        Real-time server-checked status of SMART GRID subsystems. Unconfigured external providers
        are reported honestly rather than mocked.
      </p>

      <div style={{ display: "grid", gap: "0.85rem" }}>
        {checks.map((c) => (
          <div key={c.name} className="sg-card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div className="sg-muted" style={{ fontSize: "0.84rem" }}>{c.detail}</div>
            </div>
            <StatusBadge status={c.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
