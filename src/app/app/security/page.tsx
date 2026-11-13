import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { ShieldAlert, LockKeyhole } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SecurityAuditPage() {
  const ctx = await requirePageAuth();
  if (!ctx.permissions.includes("audit:read")) {
    return (
      <div className="sg-card">
        <span className="sg-badge sg-badge-error">FORBIDDEN (403)</span>
        <h1 style={{ fontSize: "1.4rem", marginTop: "0.5rem" }}>Security & Audit Clearance Required</h1>
        <p className="sg-muted" style={{ marginTop: "0.35rem" }}>
          Role <code>{ctx.roleCode}</code> requires <code>audit:read</code> permission to inspect security telemetry.
        </p>
      </div>
    );
  }

  const db = getDb();
  const orgId = ctx.organizationId;

  const logs = normalizeRows<{
    id: string;
    user_email: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    outcome: string;
    details_json: string;
    created_at: string;
  }>(
    db
      .prepare(
        `SELECT a.*, u.email AS user_email
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.organization_id = ?
         ORDER BY a.created_at DESC
         LIMIT 100`
      )
      .all(orgId)
  );

  const activeSessionsCount = (
    db
      .prepare("SELECT COUNT(*) AS cnt FROM sessions WHERE active_organization_id = ? AND expires_at > ?")
      .get(orgId, new Date().toISOString()) as { cnt: number }
  ).cnt;

  const mfaUsers = (
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = ? AND u.mfa_enabled = 1`
      )
      .get(orgId) as { cnt: number }
  ).cnt;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card">
        <span className="sg-badge sg-badge-gold">Zero-Trust Tenant Governance</span>
        <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Security & Audit Center</h1>
        <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
          Immutable tenant-scoped event ledger, active session telemetry, and authentication posture.
        </p>
      </div>

      <div className="sg-grid sg-grid-3">
        <div className="sg-card">
          <div className="sg-muted" style={{ fontSize: "0.8rem" }}>Active Tenant Sessions</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--sg-gold)", marginTop: "0.25rem" }}>{activeSessionsCount}</div>
        </div>
        <div className="sg-card">
          <div className="sg-muted" style={{ fontSize: "0.8rem" }}>MFA-Enrolled Members</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, marginTop: "0.25rem" }}>{mfaUsers}</div>
        </div>
        <div className="sg-card">
          <div className="sg-muted" style={{ fontSize: "0.8rem" }}>Audit Events Shown</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, marginTop: "0.25rem" }}>{logs.length}</div>
        </div>
      </div>

      <div className="sg-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
          <LockKeyhole size={18} style={{ color: "var(--sg-gold)" }} />
          <h2 style={{ fontSize: "1.15rem" }}>Tenant Audit Trail (Latest 100 Events)</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="sg-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sg-muted">No audit events recorded yet for this tenant.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="sg-muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {log.created_at.replace("T", " ").slice(0, 19)}
                    </td>
                    <td>{log.user_email || "System"}</td>
                    <td><code>{log.action}</code></td>
                    <td className="sg-muted">{log.resource_type} {log.resource_id ? `(${log.resource_id})` : ""}</td>
                    <td>
                      <span className={`sg-badge ${log.outcome === "SUCCESS" ? "sg-badge-gold" : "sg-badge-error"}`}>
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="sg-muted" style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.85rem", fontSize: "0.78rem" }}>
          <ShieldAlert size={14} /> Password hashes use scrypt per-user random salts; API keys store SHA-256 digests only.
        </div>
      </div>
    </div>
  );
}
