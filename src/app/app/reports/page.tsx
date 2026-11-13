import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { ReportsClient } from "@/components/enterprise/ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const reports = normalizeRows<{
    id: string;
    title: string;
    report_type: string;
    division_code: string | null;
    status: string;
    content_markdown: string;
    is_public: number;
    updated_at: string;
  }>(
    db
      .prepare("SELECT * FROM reports WHERE organization_id = ? ORDER BY updated_at DESC")
      .all(ctx.organizationId)
  );

  const cities = normalizeRows<{ id: string; name: string }>(
    db
      .prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC")
      .all(ctx.organizationId)
  );

  return (
    <ReportsClient
      initialReports={reports}
      cities={cities}
      canWrite={ctx.permissions.includes("operations:write")}
      canPublish={ctx.permissions.includes("reports:publish")}
    />
  );
}
