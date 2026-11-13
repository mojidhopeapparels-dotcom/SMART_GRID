import { notFound } from "next/navigation";
import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { getDivisionBySlug } from "@/lib/domain/divisions";
import { DivisionWorkspaceClient } from "@/components/enterprise/DivisionWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function EnterpriseDivisionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const ctx = await requirePageAuth();
  const { slug } = await params;
  const division = getDivisionBySlug(slug);
  if (!division) notFound();

  const db = getDb();
  const orgId = ctx.organizationId;
  const cityId = ctx.activeCityId;

  const cityRow = cityId
    ? normalizeRow<{ name: string }>(
        db
          .prepare("SELECT name FROM cities WHERE id = ? AND (organization_id = ? OR is_public = 1)")
          .get(cityId, orgId)
      )
    : null;

  const datasets = normalizeRows(
    db
      .prepare("SELECT * FROM datasets WHERE organization_id = ? AND division_code = ? AND (? IS NULL OR city_id = ?)")
      .all(orgId, division.code, cityId, cityId)
  );
  const sources = normalizeRows(
    db
      .prepare("SELECT * FROM data_sources WHERE organization_id = ? AND division_code = ? AND (? IS NULL OR city_id = ?)")
      .all(orgId, division.code, cityId, cityId)
  );
  const observations = normalizeRows(
    db
      .prepare("SELECT * FROM observations WHERE organization_id = ? AND division_code = ? AND (? IS NULL OR city_id = ?) ORDER BY observed_at DESC LIMIT 30")
      .all(orgId, division.code, cityId, cityId)
  );
  const assets = normalizeRows(
    db
      .prepare("SELECT * FROM assets WHERE organization_id = ? AND division_code = ? AND (? IS NULL OR city_id = ?)")
      .all(orgId, division.code, cityId, cityId)
  );
  const sensors = normalizeRows(
    db
      .prepare("SELECT * FROM sensors WHERE organization_id = ? AND division_code = ? AND (? IS NULL OR city_id = ?)")
      .all(orgId, division.code, cityId, cityId)
  );
  const alerts = normalizeRows(
    db
      .prepare("SELECT * FROM alerts WHERE organization_id = ? AND division_code = ? AND (? IS NULL OR city_id = ?) ORDER BY created_at DESC")
      .all(orgId, division.code, cityId, cityId)
  );
  const reports = normalizeRows(
    db
      .prepare("SELECT * FROM reports WHERE organization_id = ? AND division_code = ?")
      .all(orgId, division.code)
  );

  return (
    <DivisionWorkspaceClient
      division={division}
      datasets={datasets}
      sources={sources}
      observations={observations}
      assets={assets}
      sensors={sensors}
      alerts={alerts}
      reports={reports}
      cityName={cityRow?.name || "All Permitted Cities"}
    />
  );
}
