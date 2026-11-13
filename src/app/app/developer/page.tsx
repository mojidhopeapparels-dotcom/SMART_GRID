import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { DeveloperClient } from "@/components/enterprise/DeveloperClient";

export const dynamic = "force-dynamic";

export default async function DeveloperPortalEnterprisePage() {
  const ctx = await requirePageAuth();
  if (!ctx.permissions.includes("developer:manage")) {
    return (
      <div className="sg-card">
        <span className="sg-badge sg-badge-error">FORBIDDEN (403)</span>
        <h1 style={{ fontSize: "1.4rem", marginTop: "0.5rem" }}>Developer Permissions Required</h1>
        <p className="sg-muted" style={{ marginTop: "0.35rem" }}>
          Role <code>{ctx.roleCode}</code> requires <code>developer:manage</code> permission to manage API keys and webhooks.
        </p>
      </div>
    );
  }

  const db = getDb();
  const orgId = ctx.organizationId;

  const keys = normalizeRows<{
    id: string;
    name: string;
    key_prefix: string;
    scopes_json: string;
    rate_limit_per_min: number;
    status: string;
    created_at: string;
  }>(
    db
      .prepare("SELECT id, name, key_prefix, scopes_json, rate_limit_per_min, status, created_at FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC")
      .all(orgId)
  );

  const webhooks = normalizeRows<{
    id: string;
    name: string;
    target_url: string;
    event_types_json: string;
    status: string;
    created_at: string;
  }>(db.prepare("SELECT * FROM webhooks WHERE organization_id = ? ORDER BY created_at DESC").all(orgId));

  return <DeveloperClient initialKeys={keys} initialWebhooks={webhooks} />;
}
