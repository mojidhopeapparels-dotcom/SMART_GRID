import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { DataCatalogClient } from "@/components/enterprise/DataCatalogClient";

export const dynamic = "force-dynamic";

export default async function DataCatalogPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const datasets = normalizeRows<{
    id: string;
    name: string;
    description: string;
    city_name: string | null;
    division_code: string;
    classification: string;
    data_status: string;
    row_count: number;
    quality_score: number;
    is_public_published: number;
    limitations: string | null;
    updated_at: string;
  }>(
    db
      .prepare(
        `SELECT d.*, c.name AS city_name
         FROM datasets d
         LEFT JOIN cities c ON c.id = d.city_id
         WHERE d.organization_id = ?
         ORDER BY d.updated_at DESC`
      )
      .all(ctx.organizationId)
  );

  const cities = normalizeRows<{ id: string; name: string }>(
    db
      .prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC")
      .all(ctx.organizationId)
  );

  return (
    <DataCatalogClient
      initialDatasets={datasets}
      cities={cities}
      canWrite={ctx.permissions.includes("data:write")}
      canPublish={ctx.permissions.includes("reports:publish")}
    />
  );
}
