import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import {
  requireAuth,
  assertMutationSecurity,
  assertPermittedCity,
  assertValidDivision,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";
import { isSafeExternalHttpsUrl } from "@/lib/security/sanitize";

const CreateSourceSchema = z.object({
  name: z.string().min(2).max(160),
  provider: z.string().min(2).max(120),
  cityId: z.string().nullable().optional(),
  divisionCode: z.string().min(2).max(2),
  connectionType: z.enum(["REST_API", "WEBHOOK", "CSV_UPLOAD", "JSON_UPLOAD", "GEOJSON", "IOT_TELEMETRY"]),
  endpointRef: z.string().max(400).optional(),
  authType: z.enum(["NONE", "API_KEY", "BEARER", "OAUTH2"]).default("API_KEY"),
  updateFrequency: z.enum(["REALTIME", "HOURLY", "DAILY", "WEEKLY", "MANUAL"]).default("DAILY"),
  license: z.string().max(160).default("Organization License"),
});

const SourceActionSchema = z.object({
  sourceId: z.string().min(1),
  action: z.enum(["TEST_CONNECTION", "DISABLE", "ENABLE"]),
});

export async function GET() {
  ensureSeeded();
  const auth = await requireAuth("data:read");
  if (!auth.ok) return auth.response;

  const db = getDb();
  const sources = normalizeRows(
    db
      .prepare(
        `SELECT s.*, c.name AS city_name
         FROM data_sources s
         LEFT JOIN cities c ON c.id = s.city_id
         WHERE s.organization_id = ?
         ORDER BY s.updated_at DESC`
      )
      .all(auth.ctx.organizationId)
  );

  const runs = normalizeRows(
    db
      .prepare(
        `SELECT r.*, s.name AS source_name
         FROM integration_runs r
         JOIN data_sources s ON s.id = r.source_id
         WHERE r.organization_id = ?
         ORDER BY r.started_at DESC LIMIT 20`
      )
      .all(auth.ctx.organizationId)
  );

  return apiSuccess({ sources, runs });
}

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("integrations:manage");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = CreateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid data source fields.", 400, parsed.error.flatten());
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

  if (parsed.data.endpointRef && !isSafeExternalHttpsUrl(parsed.data.endpointRef)) {
    return apiError(
      "UNSAFE_ENDPOINT_URL",
      "External endpoints must use public HTTPS URLs (private/loopback networks are blocked).",
      400
    );
  }

  const now = new Date().toISOString();
  const id = `src_${crypto.randomUUID().slice(0, 12)}`;
  const needsCreds = parsed.data.authType !== "NONE";
  const initialStatus = needsCreds || parsed.data.connectionType === "REST_API"
    ? "INTEGRATION_REQUIRED"
    : "HISTORICAL";

  db.prepare(
    `INSERT INTO data_sources (
      id, organization_id, city_id, division_code, name, provider, category,
      connection_type, endpoint_ref, auth_type, has_credentials, data_format,
      update_frequency, license, status, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'URBAN_DATA', ?, ?, ?, 0, 'JSON', ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    auth.ctx.organizationId,
    parsed.data.cityId ?? null,
    parsed.data.divisionCode,
    parsed.data.name.trim(),
    parsed.data.provider.trim(),
    parsed.data.connectionType,
    parsed.data.endpointRef ?? null,
    parsed.data.authType,
    parsed.data.updateFrequency,
    parsed.data.license,
    initialStatus,
    needsCreds ? "Awaiting authorized provider credentials in secret store." : null,
    now,
    now
  );

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "DATA_SOURCE_REGISTERED",
    resourceType: "DATA_SOURCE",
    resourceId: id,
  });

  return apiSuccess({ id, status: initialStatus }, undefined, 201);
}

export async function PATCH(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("integrations:manage");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = SourceActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid source action.", 400);
  }

  const db = getDb();
  const src = normalizeRow<{
    id: string;
    endpoint_ref: string | null;
    auth_type: string;
    has_credentials: number;
    connection_type: string;
  }>(
    db
      .prepare("SELECT * FROM data_sources WHERE id = ? AND organization_id = ?")
      .get(parsed.data.sourceId, auth.ctx.organizationId)
  );

  if (!src) {
    return apiError("NOT_FOUND", "Data source not found.", 404);
  }

  const now = new Date().toISOString();

  if (parsed.data.action === "DISABLE") {
    db.prepare("UPDATE data_sources SET status = 'DISABLED', updated_at = ? WHERE id = ?").run(now, src.id);
    return apiSuccess({ status: "DISABLED" });
  }

  if (parsed.data.action === "ENABLE") {
    const next = src.auth_type !== "NONE" && !src.has_credentials ? "INTEGRATION_REQUIRED" : "HISTORICAL";
    db.prepare("UPDATE data_sources SET status = ?, updated_at = ? WHERE id = ?").run(next, now, src.id);
    return apiSuccess({ status: next });
  }

  // TEST_CONNECTION: Truthful check — never fake LIVE when credentials or public HTTPS endpoint are missing
  let runStatus = "FAILED";
  let nextSourceStatus = "INTEGRATION_REQUIRED";
  let msg = "No public HTTPS endpoint or authorized credentials configured.";

  if (src.endpoint_ref && isSafeExternalHttpsUrl(src.endpoint_ref) && (src.auth_type === "NONE" || src.has_credentials)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(src.endpoint_ref, {
        method: "HEAD",
        redirect: "error",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        runStatus = "SUCCESS";
        nextSourceStatus = "LIVE";
        msg = `HTTP ${res.status} verified from external endpoint.`;
      } else {
        nextSourceStatus = "ERROR";
        msg = `External endpoint returned HTTP ${res.status}.`;
      }
    } catch {
      nextSourceStatus = "UNAVAILABLE";
      msg = "External endpoint unreachable or timed out.";
    }
  }

  db.prepare(
    "INSERT INTO integration_runs (id, organization_id, source_id, status, records_ingested, records_rejected, message, started_at, finished_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)"
  ).run(`run_${crypto.randomUUID().slice(0, 12)}`, auth.ctx.organizationId, src.id, runStatus, msg, now, new Date().toISOString());

  db.prepare(
    "UPDATE data_sources SET status = ?, last_sync_at = ?, last_error = ?, updated_at = ? WHERE id = ?"
  ).run(nextSourceStatus, runStatus === "SUCCESS" ? now : null, runStatus === "SUCCESS" ? null : msg, now, src.id);

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "DATA_SOURCE_TESTED",
    resourceType: "DATA_SOURCE",
    resourceId: src.id,
    outcome: runStatus === "SUCCESS" ? "SUCCESS" : "ERROR",
    details: { msg },
  });

  return apiSuccess({ runStatus, sourceStatus: nextSourceStatus, message: msg });
}
