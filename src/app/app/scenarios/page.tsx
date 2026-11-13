import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { ScenariosClient } from "@/components/enterprise/ScenariosClient";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const scenarios = normalizeRows<{
    id: string;
    name: string;
    description: string;
    baseline_label: string;
    parameters_json: string;
    results_json: string;
    assumptions: string;
    status: string;
  }>(
    db
      .prepare("SELECT * FROM scenarios WHERE organization_id = ? ORDER BY created_at DESC")
      .all(ctx.organizationId)
  );

  const cities = normalizeRows<{ id: string; name: string }>(
    db
      .prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC")
      .all(ctx.organizationId)
  );

  return (
    <ScenariosClient
      initialScenarios={scenarios}
      cities={cities}
      canWrite={ctx.permissions.includes("operations:write")}
    />
  );
}
