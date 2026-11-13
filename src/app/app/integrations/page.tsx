import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { IntegrationsClient } from "@/components/enterprise/IntegrationsClient";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const sources = normalizeRows<{
    id: string;
    name: string;
    provider: string;
    division_code: string;
    connection_type: string;
    endpoint_ref: string | null;
    status: string;
    last_sync_at: string | null;
    last_error: string | null;
  }>(
    db
      .prepare("SELECT * FROM data_sources WHERE organization_id = ? ORDER BY updated_at DESC")
      .all(ctx.organizationId)
  );

  const runs = normalizeRows<{
    id: string;
    source_name: string;
    status: string;
    message: string | null;
    started_at: string;
  }>(
    db
      .prepare(
        "SELECT r.*, s.name AS source_name FROM integration_runs r JOIN data_sources s ON s.id = r.source_id WHERE r.organization_id = ? ORDER BY r.started_at DESC LIMIT 20"
      )
      .all(ctx.organizationId)
  );

  const cities = normalizeRows<{ id: string; name: string }>(
    db
      .prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC")
      .all(ctx.organizationId)
  );

  return (
    <IntegrationsClient
      initialSources={sources}
      initialRuns={runs}
      cities={cities}
      canManage={ctx.permissions.includes("integrations:manage")}
    />
  );
}
