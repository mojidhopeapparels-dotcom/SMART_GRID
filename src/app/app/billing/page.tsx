import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { BillingClient } from "@/components/enterprise/BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requirePageAuth();
  if (!ctx.permissions.includes("billing:manage")) {
    return (
      <div className="sg-card">
        <span className="sg-badge sg-badge-error">FORBIDDEN (403)</span>
        <h1 style={{ fontSize: "1.4rem", marginTop: "0.5rem" }}>Billing Access Restricted</h1>
        <p className="sg-muted" style={{ marginTop: "0.35rem" }}>
          Role <code>{ctx.roleCode}</code> requires <code>billing:manage</code> permission.
        </p>
      </div>
    );
  }

  const db = getDb();
  const orgId = ctx.organizationId;
  const sub = normalizeRow<{
    plan_code: string;
    status: string;
    seat_limit: number;
    storage_limit_mb: number;
    ai_monthly_quota: number;
    current_period_start: string;
    current_period_end: string;
  }>(db.prepare("SELECT * FROM subscriptions WHERE organization_id = ?").get(orgId));

  const usage = normalizeRows<{ metric_type: string; total: number }>(
    db.prepare("SELECT metric_type, SUM(quantity) AS total FROM usage_records WHERE organization_id = ? GROUP BY metric_type").all(orgId)
  );

  const memberCount = (
    db.prepare("SELECT COUNT(*) AS cnt FROM organization_memberships WHERE organization_id = ? AND status = 'ACTIVE'").get(orgId) as { cnt: number }
  ).cnt;

  return <BillingClient initialSub={sub} usage={usage} memberCount={memberCount} />;
}
