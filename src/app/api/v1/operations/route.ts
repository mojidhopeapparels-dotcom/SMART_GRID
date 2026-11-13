import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import {
  requireAuth,
  assertMutationSecurity,
  assertPermittedCity,
  assertValidDivision,
  assertTenantAsset,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { hasPermission } from "@/lib/auth/rbac";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const CreateEntitySchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("asset"),
    cityId: z.string(),
    divisionCode: z.string(),
    assetTag: z.string().min(2).max(50),
    name: z.string().min(2).max(160),
    assetType: z.string().min(2).max(80),
    conditionStatus: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]).default("GOOD"),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    ownerDepartment: z.string().max(120).optional(),
  }),
  z.object({
    entity: z.literal("project"),
    cityId: z.string(),
    divisionCode: z.string(),
    title: z.string().min(2).max(160),
    description: z.string().min(4).max(1000),
    budgetAmount: z.number().nonnegative().default(0),
    currency: z.string().max(5).default("USD"),
    targetEndDate: z.string().optional(),
  }),
  z.object({
    entity: z.literal("work_order"),
    cityId: z.string(),
    divisionCode: z.string(),
    assetId: z.string().nullable().optional(),
    title: z.string().min(2).max(160),
    description: z.string().min(4).max(1000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    maintenanceType: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]).default("PREVENTIVE"),
    assignedTo: z.string().max(120).optional(),
    dueDate: z.string().optional(),
  }),
  z.object({
    entity: z.literal("incident"),
    cityId: z.string(),
    divisionCode: z.string(),
    title: z.string().min(2).max(160),
    description: z.string().min(4).max(1000),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  }),
  z.object({
    entity: z.literal("report"),
    cityId: z.string().nullable().optional(),
    divisionCode: z.string().nullable().optional(),
    title: z.string().min(2).max(180),
    reportType: z.enum(["EXECUTIVE", "DIVISION", "CITY", "DATA_QUALITY", "SUSTAINABILITY"]).default("DIVISION"),
    contentMarkdown: z.string().min(10).max(20000),
  }),
  z.object({
    entity: z.literal("scenario"),
    cityId: z.string(),
    divisionCode: z.string(),
    name: z.string().min(2).max(160),
    description: z.string().min(4).max(800),
    baselineLabel: z.string().min(2).max(120),
    assumptions: z.string().min(4).max(1000),
    solarBoostPct: z.number().min(0).max(100).default(15),
    transitShiftPct: z.number().min(0).max(100).default(10),
  }),
  z.object({
    entity: z.literal("document"),
    cityId: z.string().nullable().optional(),
    divisionCode: z.string().nullable().optional(),
    title: z.string().min(2).max(160),
    folder: z.string().max(80).default("General"),
    category: z.string().max(60).default("Record"),
    contentText: z.string().min(2).max(20000),
  }),
  z.object({
    entity: z.literal("calendar_event"),
    cityId: z.string().nullable().optional(),
    divisionCode: z.string().nullable().optional(),
    title: z.string().min(2).max(160),
    eventType: z.enum(["MAINTENANCE", "INSPECTION", "MEETING", "DEADLINE", "CITY_EVENT"]).default("MEETING"),
    startAt: z.string(),
    endAt: z.string(),
    location: z.string().max(160).optional(),
  }),
  z.object({
    entity: z.literal("team_message"),
    cityId: z.string().nullable().optional(),
    channel: z.string().min(2).max(60).default("operations"),
    body: z.string().min(1).max(2000),
  }),
  z.object({
    entity: z.literal("vendor"),
    name: z.string().min(2).max(160),
    category: z.string().min(2).max(100),
    contactEmail: z.string().email().optional(),
  }),
]);

const UpdateActionSchema = z.object({
  action: z.enum([
    "ALERT_ACK",
    "ALERT_RESOLVE",
    "WORK_ORDER_STATUS",
    "INCIDENT_STATUS",
    "WORKFLOW_DECISION",
    "REPORT_STATUS",
    "NOTIFICATION_READ",
  ]),
  id: z.string().min(1),
  status: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET(req: Request) {
  ensureSeeded();
  const auth = await requireAuth("operations:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "summary";
  const cityId = url.searchParams.get("cityId")?.trim() || null;
  const divisionCode = url.searchParams.get("divisionCode")?.trim() || null;
  const orgId = auth.ctx.organizationId;
  const db = getDb();

  if (cityId && !assertPermittedCity(db, cityId, orgId)) {
    return apiError(
      "FORBIDDEN",
      "The specified city does not exist or is not accessible to your organization.",
      403
    );
  }
  if (divisionCode && !assertValidDivision(divisionCode)) {
    return apiError("VALIDATION_ERROR", "Unknown division code.", 400);
  }

  switch (type) {
    case "assets":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM assets WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)));
    case "sensors":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM sensors WHERE organization_id = ? ORDER BY created_at DESC").all(orgId)));
    case "projects":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM projects WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)));
    case "work_orders":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM work_orders WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)));
    case "incidents":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM incidents WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)));
    case "alerts":
      return apiSuccess(
        normalizeRows(
          db
            .prepare(
              `SELECT * FROM alerts
               WHERE organization_id = ?
                 AND (? IS NULL OR city_id = ?)
                 AND (? IS NULL OR division_code = ?)
               ORDER BY created_at DESC`
            )
            .all(orgId, cityId, cityId, divisionCode, divisionCode)
        )
      );
    case "events":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM city_events WHERE organization_id = ? ORDER BY occurred_at DESC").all(orgId)));
    case "reports":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM reports WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)));
    case "scenarios":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM scenarios WHERE organization_id = ? ORDER BY created_at DESC").all(orgId)));
    case "documents":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM documents WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)));
    case "workflows":
      return apiSuccess({
        workflows: normalizeRows(db.prepare("SELECT * FROM workflows WHERE organization_id = ?").all(orgId)),
        runs: normalizeRows(db.prepare("SELECT * FROM workflow_runs WHERE organization_id = ? ORDER BY updated_at DESC").all(orgId)),
      });
    case "calendar":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM calendar_events WHERE organization_id = ? ORDER BY start_at ASC").all(orgId)));
    case "collaboration":
      return apiSuccess(normalizeRows(db.prepare("SELECT * FROM team_messages WHERE organization_id = ? ORDER BY created_at DESC LIMIT 60").all(orgId)));
    case "procurement":
      return apiSuccess({
        vendors: normalizeRows(db.prepare("SELECT * FROM vendors WHERE organization_id = ? ORDER BY name ASC").all(orgId)),
        contracts: normalizeRows(db.prepare("SELECT * FROM contracts WHERE organization_id = ? ORDER BY created_at DESC").all(orgId)),
      });
    case "notifications":
      return apiSuccess(
        normalizeRows(
          db
            .prepare("SELECT * FROM notifications WHERE organization_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 40")
            .all(orgId, auth.ctx.userId)
        )
      );
    default:
      return apiSuccess({
        assetsCount: (db.prepare("SELECT COUNT(*) AS c FROM assets WHERE organization_id = ?").get(orgId) as { c: number }).c,
        projectsCount: (db.prepare("SELECT COUNT(*) AS c FROM projects WHERE organization_id = ?").get(orgId) as { c: number }).c,
        openWorkOrders: (db.prepare("SELECT COUNT(*) AS c FROM work_orders WHERE organization_id = ? AND status != 'CLOSED'").get(orgId) as { c: number }).c,
        activeAlerts: (db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE organization_id = ? AND status = 'ACTIVE'").get(orgId) as { c: number }).c,
      });
  }
}

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("operations:write");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = CreateEntitySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid operational record fields.", 400, parsed.error.flatten());
  }

  const db = getDb();
  const orgId = auth.ctx.organizationId;
  const now = new Date().toISOString();
  const d = parsed.data;

  // Tenant Isolation & Foreign Key Validation
  if ("cityId" in d && d.cityId) {
    if (!assertPermittedCity(db, d.cityId, orgId)) {
      return apiError(
        "FORBIDDEN",
        "The specified city does not exist or is not accessible to your organization.",
        403
      );
    }
  }

  if ("divisionCode" in d && d.divisionCode) {
    if (!assertValidDivision(d.divisionCode)) {
      return apiError("VALIDATION_ERROR", "Unknown division code.", 400);
    }
  }

  if (d.entity === "work_order" && d.assetId) {
    if (!assertTenantAsset(db, d.assetId, orgId)) {
      return apiError(
        "FORBIDDEN",
        "The specified asset does not exist or does not belong to your organization.",
        403
      );
    }
  }

  const id = `${d.entity.slice(0, 3)}_${crypto.randomUUID().slice(0, 10)}`;

  if (d.entity === "asset") {
    db.prepare(
      `INSERT INTO assets (id, organization_id, city_id, division_code, asset_tag, name, asset_type, condition_status, operational_status, latitude, longitude, owner_department, data_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPERATIONAL', ?, ?, ?, 'HISTORICAL', ?, ?)`
    ).run(id, orgId, d.cityId, d.divisionCode, d.assetTag, d.name, d.assetType, d.conditionStatus, d.latitude ?? null, d.longitude ?? null, d.ownerDepartment ?? "Operations", now, now);
  } else if (d.entity === "project") {
    db.prepare(
      `INSERT INTO projects (id, organization_id, city_id, division_code, title, description, status, progress_pct, budget_amount, spent_amount, currency, owner_user_id, start_date, target_end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PLANNED', 0, ?, 0, ?, ?, ?, ?, ?, ?)`
    ).run(id, orgId, d.cityId, d.divisionCode, d.title, d.description, d.budgetAmount, d.currency, auth.ctx.userId, now.slice(0, 10), d.targetEndDate ?? null, now, now);
  } else if (d.entity === "work_order") {
    db.prepare(
      `INSERT INTO work_orders (id, organization_id, city_id, division_code, asset_id, title, description, priority, maintenance_type, status, assigned_to, due_date, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?)`
    ).run(id, orgId, d.cityId, d.divisionCode, d.assetId ?? null, d.title, d.description, d.priority, d.maintenanceType, d.assignedTo ?? "Unassigned", d.dueDate ?? null, auth.ctx.userId, now, now);
  } else if (d.entity === "incident") {
    db.prepare(
      `INSERT INTO incidents (id, organization_id, city_id, division_code, title, description, severity, status, reported_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`
    ).run(id, orgId, d.cityId, d.divisionCode, d.title, d.description, d.severity, auth.ctx.userId, now, now);
  } else if (d.entity === "report") {
    db.prepare(
      `INSERT INTO reports (id, organization_id, city_id, division_code, title, report_type, status, content_markdown, sources_json, is_public, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, '[]', 0, ?, ?, ?)`
    ).run(id, orgId, d.cityId ?? null, d.divisionCode ?? null, d.title, d.reportType, d.contentMarkdown, auth.ctx.userId, now, now);
  } else if (d.entity === "scenario") {
    const estPeakDrop = Math.round((d.solarBoostPct * 0.32 + d.transitShiftPct * 0.18) * 10) / 10;
    db.prepare(
      `INSERT INTO scenarios (id, organization_id, city_id, division_code, name, description, baseline_label, parameters_json, results_json, assumptions, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`
    ).run(
      id,
      orgId,
      d.cityId,
      d.divisionCode,
      d.name,
      d.description,
      d.baselineLabel,
      JSON.stringify({ solarBoostPct: d.solarBoostPct, transitShiftPct: d.transitShiftPct }),
      JSON.stringify({ modeledEstimate: true, estimatedPeakLoadReductionPct: estPeakDrop }),
      d.assumptions,
      auth.ctx.userId,
      now
    );
  } else if (d.entity === "document") {
    db.prepare(
      `INSERT INTO documents (id, organization_id, city_id, division_code, title, folder, category, mime_type, content_text, version, classification, uploaded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'text/markdown', ?, 1, 'INTERNAL', ?, ?, ?)`
    ).run(id, orgId, d.cityId ?? null, d.divisionCode ?? null, d.title, d.folder, d.category, d.contentText, auth.ctx.userId, now, now);
  } else if (d.entity === "calendar_event") {
    const startMs = Date.parse(d.startAt);
    const endMs = Date.parse(d.endAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      return apiError(
        "VALIDATION_ERROR",
        "Event start and end timestamps must be valid dates with end >= start.",
        400
      );
    }
    db.prepare(
      `INSERT INTO calendar_events (id, organization_id, city_id, division_code, title, event_type, start_at, end_at, location, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, orgId, d.cityId ?? null, d.divisionCode ?? null, d.title, d.eventType, d.startAt, d.endAt, d.location ?? null, auth.ctx.userId);
  } else if (d.entity === "team_message") {
    db.prepare(
      `INSERT INTO team_messages (id, organization_id, city_id, channel, author_id, author_name, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, orgId, d.cityId ?? null, d.channel, auth.ctx.userId, auth.ctx.fullName, d.body, now);
  } else if (d.entity === "vendor") {
    db.prepare(
      `INSERT INTO vendors (id, organization_id, name, category, compliance_status, contact_email, created_at)
       VALUES (?, ?, ?, ?, 'PENDING_REVIEW', ?, ?)`
    ).run(id, orgId, d.name, d.category, d.contactEmail ?? null, now);
  }

  writeAuditLog({
    organizationId: orgId,
    userId: auth.ctx.userId,
    action: `CREATE_${d.entity.toUpperCase()}`,
    resourceType: d.entity.toUpperCase(),
    resourceId: id,
  });

  return apiSuccess({ id, entity: d.entity }, undefined, 201);
}

export async function PATCH(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = UpdateActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid operational update payload.", 400);
  }

  const requiredPerm =
    parsed.data.action === "WORKFLOW_DECISION"
      ? "workflows:approve"
      : parsed.data.action === "REPORT_STATUS" && parsed.data.status === "PUBLISHED"
        ? "reports:publish"
        : parsed.data.action === "NOTIFICATION_READ"
          ? "operations:read"
          : "operations:write";

  const auth = await requireAuth(requiredPerm);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const orgId = auth.ctx.organizationId;
  const now = new Date().toISOString();

  if (parsed.data.action === "ALERT_ACK") {
    const r = db.prepare("UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_by = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(auth.ctx.userId, now, parsed.data.id, orgId);
    if (r.changes === 0) return apiError("NOT_FOUND", "Alert not found.", 404);
  } else if (parsed.data.action === "ALERT_RESOLVE") {
    const r = db.prepare("UPDATE alerts SET status = 'RESOLVED', updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(now, parsed.data.id, orgId);
    if (r.changes === 0) return apiError("NOT_FOUND", "Alert not found.", 404);
  } else if (parsed.data.action === "WORK_ORDER_STATUS") {
    const allowed = ["OPEN", "IN_PROGRESS", "REVIEW", "CLOSED"];
    if (!parsed.data.status || !allowed.includes(parsed.data.status)) {
      return apiError("VALIDATION_ERROR", "Invalid work order status.", 400);
    }
    const r = db.prepare("UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(parsed.data.status, now, parsed.data.id, orgId);
    if (r.changes === 0) return apiError("NOT_FOUND", "Work order not found.", 404);
  } else if (parsed.data.action === "INCIDENT_STATUS") {
    const allowed = ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"];
    if (!parsed.data.status || !allowed.includes(parsed.data.status)) {
      return apiError("VALIDATION_ERROR", "Invalid incident status.", 400);
    }
    const r = db.prepare("UPDATE incidents SET status = ?, resolution_notes = COALESCE(?, resolution_notes), updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(parsed.data.status, parsed.data.notes ?? null, now, parsed.data.id, orgId);
    if (r.changes === 0) return apiError("NOT_FOUND", "Incident not found.", 404);
  } else if (parsed.data.action === "WORKFLOW_DECISION") {
    if (!parsed.data.status || !["APPROVED", "REJECTED"].includes(parsed.data.status)) {
      return apiError("VALIDATION_ERROR", "Status must be APPROVED or REJECTED.", 400);
    }
    const r = db.prepare("UPDATE workflow_runs SET status = ?, decision_by = ?, decision_notes = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(parsed.data.status, auth.ctx.userId, parsed.data.notes ?? null, now, parsed.data.id, orgId);
    if (r.changes === 0) return apiError("NOT_FOUND", "Workflow run not found.", 404);
  } else if (parsed.data.action === "REPORT_STATUS") {
    const allowed = ["DRAFT", "UNDER_REVIEW", "APPROVED", "PUBLISHED"];
    if (!parsed.data.status || !allowed.includes(parsed.data.status)) {
      return apiError("VALIDATION_ERROR", "Invalid report status.", 400);
    }
    const existingReport = normalizeRow<{ status: string }>(
      db
        .prepare("SELECT status FROM reports WHERE id = ? AND organization_id = ?")
        .get(parsed.data.id, orgId)
    );
    if (!existingReport) return apiError("NOT_FOUND", "Report not found.", 404);
    if (
      (existingReport.status === "PUBLISHED" || parsed.data.status === "PUBLISHED") &&
      !hasPermission(auth.ctx.permissions, "reports:publish")
    ) {
      return apiError(
        "FORBIDDEN",
        "Publishing or unpublishing reports requires reports:publish permission.",
        403
      );
    }
    const isPub = parsed.data.status === "PUBLISHED" ? 1 : 0;
    const approver = ["APPROVED", "PUBLISHED"].includes(parsed.data.status) ? auth.ctx.userId : null;
    const r = db.prepare("UPDATE reports SET status = ?, is_public = ?, approved_by = COALESCE(?, approved_by), updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(parsed.data.status, isPub, approver, now, parsed.data.id, orgId);
    if (r.changes === 0) return apiError("NOT_FOUND", "Report not found.", 404);
  } else if (parsed.data.action === "NOTIFICATION_READ") {
    const r = db
      .prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND organization_id = ? AND user_id = ?")
      .run(parsed.data.id, orgId, auth.ctx.userId);
    if (r.changes === 0) return apiError("NOT_FOUND", "Notification not found.", 404);
  }

  writeAuditLog({
    organizationId: orgId,
    userId: auth.ctx.userId,
    action: parsed.data.action,
    resourceType: "OPERATION",
    resourceId: parsed.data.id,
    details: { status: parsed.data.status },
  });

  return apiSuccess({ updated: true });
}
