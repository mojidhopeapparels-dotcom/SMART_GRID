import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { CitiesClient } from "@/components/enterprise/CitiesClient";

export const dynamic = "force-dynamic";

export default async function EnterpriseCitiesPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const cities = normalizeRows<{
    id: string;
    slug: string;
    name: string;
    country_code: string;
    country_name: string | null;
    region_name: string;
    population: number | null;
    readiness_score: number;
    data_status: string;
    is_public: number;
  }>(
    db
      .prepare(
        `SELECT c.*, co.name AS country_name
         FROM cities c
         LEFT JOIN countries co ON co.code = c.country_code
         WHERE c.organization_id = ? OR c.is_public = 1
         ORDER BY c.name ASC`
      )
      .all(orgId)
  );

  const countries = normalizeRows<{
    code: string;
    name: string;
    default_currency: string;
    default_timezone: string;
  }>(db.prepare("SELECT code, name, default_currency, default_timezone FROM countries ORDER BY name ASC").all());

  return (
    <CitiesClient
      initialCities={cities}
      countries={countries}
      canWrite={ctx.permissions.includes("cities:write")}
    />
  );
}
