import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { DocumentsClient } from "@/components/enterprise/DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const docs = normalizeRows<{
    id: string;
    title: string;
    folder: string;
    category: string;
    division_code: string | null;
    classification: string;
    version: number;
    content_text: string | null;
    updated_at: string;
  }>(db.prepare("SELECT * FROM documents WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId));

  const cities = normalizeRows<{ id: string; name: string }>(
    db.prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC").all(orgId)
  );

  return <DocumentsClient initialDocs={docs} cities={cities} canWrite={ctx.permissions.includes("operations:write")} />;
}
