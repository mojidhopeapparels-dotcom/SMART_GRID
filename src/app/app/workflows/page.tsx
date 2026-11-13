import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { WorkflowsClient } from "@/components/enterprise/WorkflowsClient";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const workflows = normalizeRows<{
    id: string;
    name: string;
    description: string;
    trigger_type: string;
    steps_json: string;
    status: string;
  }>(db.prepare("SELECT * FROM workflows WHERE organization_id = ?").all(ctx.organizationId));

  const runs = normalizeRows<{
    id: string;
    workflow_id: string;
    target_entity_type: string;
    target_entity_id: string;
    current_step: number;
    status: string;
    decision_notes: string | null;
    updated_at: string;
  }>(
    db
      .prepare("SELECT * FROM workflow_runs WHERE organization_id = ? ORDER BY updated_at DESC")
      .all(ctx.organizationId)
  );

  return (
    <WorkflowsClient
      workflows={workflows}
      initialRuns={runs}
      canApprove={ctx.permissions.includes("workflows:approve")}
    />
  );
}
