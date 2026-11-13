import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { OperationsClient } from "@/components/enterprise/OperationsClient";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const assets = normalizeRows(db.prepare("SELECT * FROM assets WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId));
  const projects = normalizeRows(db.prepare("SELECT * FROM projects WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId));
  const workOrders = normalizeRows(db.prepare("SELECT * FROM work_orders WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId));
  const incidents = normalizeRows(db.prepare("SELECT * FROM incidents WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId));
  const cities = normalizeRows<{ id: string; name: string }>(
    db.prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC").all(orgId)
  );

  return (
    <OperationsClient
      initialAssets={assets}
      initialProjects={projects}
      initialWorkOrders={workOrders}
      initialIncidents={incidents}
      cities={cities}
      canWrite={ctx.permissions.includes("operations:write")}
    />
  );
}
