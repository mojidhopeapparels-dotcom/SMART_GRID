import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { SheetsWorkspaceClient } from "@/components/enterprise/SheetsWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function EnterpriseSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const ctx = await requirePageAuth();
  const sp = await searchParams;
  const db = getDb();

  const workbooks = ctx.isCareerFestVisitor
    ? normalizeRows<{
        id: string;
        title: string;
        data_status: string;
        updated_at: string;
      }>(
        db
          .prepare(
            "SELECT id, title, data_status, updated_at FROM workbooks WHERE organization_id = ? AND is_archived = 0 AND (owner_session_id IS NULL OR owner_session_id = ?) ORDER BY updated_at DESC"
          )
          .all(ctx.organizationId, ctx.sessionId)
      )
    : normalizeRows<{
        id: string;
        title: string;
        data_status: string;
        updated_at: string;
      }>(
        db
          .prepare("SELECT id, title, data_status, updated_at FROM workbooks WHERE organization_id = ? AND is_archived = 0 ORDER BY updated_at DESC")
          .all(ctx.organizationId)
      );

  return (
    <SheetsWorkspaceClient
      initialWorkbooks={workbooks}
      canWrite={ctx.permissions.includes("sheets:write")}
      canExport={ctx.permissions.includes("data:export")}
      canUseAi={ctx.permissions.includes("ai:use")}
      initialSelectedId={sp.id}
    />
  );
}
