import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRows, withTransaction } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import {
  requireAuth,
  assertMutationSecurity,
  assertPermittedCity,
  assertValidDivision,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const IngestDatasetSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().min(4).max(1000),
  cityId: z.string().min(1),
  divisionCode: z.string().min(2).max(2),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).default("INTERNAL"),
  dataStatus: z.enum(["HISTORICAL", "SIMULATED", "LIVE"]).default("HISTORICAL"),
  unitSystem: z.string().max(40).default("METRIC"),
  limitations: z.string().max(600).default("Organization-uploaded archive."),
  records: z
    .array(
      z.object({
        metricName: z.string().min(1).max(120),
        metricValue: z.number(),
        unit: z.string().min(1).max(30),
        observedAt: z.string().optional(),
      })
    )
    .min(1)
    .max(500),
});

const PublishToggleSchema = z.object({
  datasetId: z.string().min(1),
  isPublicPublished: z.boolean(),
});

export async function GET(req: Request) {
  ensureSeeded();
  const auth = await requireAuth("data:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const divisionCode = url.searchParams.get("divisionCode");
  const cityId = url.searchParams.get("cityId");

  const db = getDb();
  const datasets = normalizeRows(
    db
      .prepare(
        `SELECT d.*, c.name AS city_name, s.name AS source_name, s.status AS source_status
         FROM datasets d
         LEFT JOIN cities c ON c.id = d.city_id
         LEFT JOIN data_sources s ON s.id = d.source_id
         WHERE d.organization_id = ?
           AND (? IS NULL OR d.division_code = ?)
           AND (? IS NULL OR d.city_id = ?)
         ORDER BY d.updated_at DESC`
      )
      .all(
        auth.ctx.organizationId,
        divisionCode,
        divisionCode,
        cityId,
        cityId
      )
  );

  return apiSuccess(datasets);
}

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("data:write");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = IngestDatasetSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid dataset ingestion payload.", 400, parsed.error.flatten());
  }

  const db = getDb();
  if (
    parsed.data.cityId &&
    !assertPermittedCity(db, parsed.data.cityId, auth.ctx.organizationId)
  ) {
    return apiError(
      "FORBIDDEN",
      "The specified city does not exist or is not accessible to your organization.",
      403
    );
  }

  if (
    parsed.data.divisionCode &&
    !assertValidDivision(parsed.data.divisionCode)
  ) {
    return apiError("VALIDATION_ERROR", "Unknown division code.", 400);
  }
  const now = new Date().toISOString();
  const dsId = `ds_${crypto.randomUUID().slice(0, 12)}`;
  const validRows = parsed.data.records.filter((r) => Number.isFinite(r.metricValue));
  const qualityScore = Math.round((validRows.length / parsed.data.records.length) * 1000) / 10;

  withTransaction((tx) => {
    tx.prepare(
      `INSERT INTO datasets (
        id, organization_id, city_id, division_code, source_id, name, description,
        classification, data_status, schema_json, row_count, quality_score,
        unit_system, limitations, is_public_published, last_validated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(
      dsId,
      auth.ctx.organizationId,
      parsed.data.cityId,
      parsed.data.divisionCode,
      parsed.data.name.trim(),
      parsed.data.description.trim(),
      parsed.data.classification,
      parsed.data.dataStatus,
      JSON.stringify([
        { name: "metricName", type: "string" },
        { name: "metricValue", type: "number" },
        { name: "unit", type: "string" },
        { name: "observedAt", type: "datetime" },
      ]),
      validRows.length,
      qualityScore,
      parsed.data.unitSystem,
      parsed.data.limitations,
      now,
      now,
      now
    );

    const insObs = tx.prepare(
      `INSERT INTO observations (
        id, organization_id, city_id, division_code, dataset_id, metric_name,
        metric_value, unit, data_status, observed_at, source_name, quality_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID')`
    );

    for (const r of validRows) {
      insObs.run(
        `obs_${crypto.randomUUID().slice(0, 12)}`,
        auth.ctx.organizationId,
        parsed.data.cityId,
        parsed.data.divisionCode,
        dsId,
        r.metricName,
        r.metricValue,
        r.unit,
        parsed.data.dataStatus,
        r.observedAt || now,
        parsed.data.name.trim()
      );
    }
  });

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "DATASET_INGESTED",
    resourceType: "DATASET",
    resourceId: dsId,
    details: { rowCount: validRows.length, qualityScore },
  });

  return apiSuccess({ id: dsId, rowCount: validRows.length, qualityScore }, undefined, 201);
}

export async function PATCH(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("reports:publish");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = PublishToggleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid publish payload.", 400);
  }

  const db = getDb();
  const res = db
    .prepare(
      "UPDATE datasets SET is_public_published = ?, classification = CASE WHEN ? = 1 THEN 'PUBLIC' ELSE classification END, updated_at = ? WHERE id = ? AND organization_id = ?"
    )
    .run(
      parsed.data.isPublicPublished ? 1 : 0,
      parsed.data.isPublicPublished ? 1 : 0,
      new Date().toISOString(),
      parsed.data.datasetId,
      auth.ctx.organizationId
    );

  if (res.changes === 0) {
    return apiError("NOT_FOUND", "Dataset not found in your organization.", 404);
  }

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: parsed.data.isPublicPublished ? "DATASET_PUBLISHED_PUBLIC" : "DATASET_UNPUBLISHED",
    resourceType: "DATASET",
    resourceId: parsed.data.datasetId,
  });

  return apiSuccess({ updated: true });
}
