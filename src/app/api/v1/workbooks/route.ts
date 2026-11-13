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
import { isSafeCellRefKey, WORKBOOK_LIMITS } from "@/lib/sheets/exportHelpers";
import { CAREER_FEST_MAX_WORKBOOKS_PER_SESSION } from "@/lib/careerFest/constants";
import { isCareerFestWorkbookQuotaReached } from "@/lib/careerFest/service";

const BoundedCellsSchema = z
  .record(z.string(), z.object({ raw: z.string().max(4000) }))
  .refine((rec) => Object.keys(rec).length <= WORKBOOK_LIMITS.MAX_CELLS, {
    message: `Workbook sheet cannot exceed ${WORKBOOK_LIMITS.MAX_CELLS} populated cells.`,
  })
  .refine((rec) => Object.keys(rec).every((k) => isSafeCellRefKey(k)), {
    message: "Invalid or unsafe cell coordinate key.",
  });

const CreateWorkbookSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(600).optional(),
  cityId: z.string().nullable().optional(),
  divisionCode: z.string().nullable().optional(),
  initialSheetName: z.string().min(1).max(60).default("Sheet 1"),
  initialCells: BoundedCellsSchema.optional(),
});

export async function GET() {
  ensureSeeded();
  const auth = await requireAuth("sheets:read");
  if (!auth.ok) return auth.response;

  const db = getDb();
  const rows = auth.ctx.isCareerFestVisitor
    ? normalizeRows(
        db
          .prepare(
            `SELECT w.*, u.full_name AS owner_name,
                    (SELECT COUNT(*) FROM workbook_sheets ws WHERE ws.workbook_id = w.id) AS sheet_count
             FROM workbooks w
             LEFT JOIN users u ON u.id = w.owner_user_id
             WHERE w.organization_id = ? AND w.is_archived = 0
               AND (w.owner_session_id IS NULL OR w.owner_session_id = ?)
             ORDER BY w.updated_at DESC`
          )
          .all(auth.ctx.organizationId, auth.ctx.sessionId)
      )
    : normalizeRows(
        db
          .prepare(
            `SELECT w.*, u.full_name AS owner_name,
                    (SELECT COUNT(*) FROM workbook_sheets ws WHERE ws.workbook_id = w.id) AS sheet_count
             FROM workbooks w
             LEFT JOIN users u ON u.id = w.owner_user_id
             WHERE w.organization_id = ? AND w.is_archived = 0
             ORDER BY w.updated_at DESC`
          )
          .all(auth.ctx.organizationId)
      );

  return apiSuccess(rows);
}

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("sheets:write");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = CreateWorkbookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Workbook title is required.", 400);
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

  if (
    auth.ctx.isCareerFestVisitor &&
    isCareerFestWorkbookQuotaReached(db, auth.ctx.organizationId, auth.ctx.sessionId)
  ) {
    return apiError(
      "VISITOR_WORKBOOK_LIMIT",
      `Career Fest visitor sessions can create up to ${CAREER_FEST_MAX_WORKBOOKS_PER_SESSION} workbooks per session.`,
      429
    );
  }

  const now = new Date().toISOString();
  const wbId = `wb_${crypto.randomUUID().slice(0, 12)}`;
  const shId = `sh_${crypto.randomUUID().slice(0, 12)}`;
  const cells = parsed.data.initialCells ?? {
    A1: { raw: "Category" },
    B1: { raw: "Value" },
    C1: { raw: "Status" },
    A2: { raw: "Sample Metric" },
    B2: { raw: "100" },
    C2: { raw: '=IF(B2>=100,"TARGET","BELOW")' },
    A3: { raw: "Total" },
    B3: { raw: "=SUM(B2:B2)" },
  };

  withTransaction((tx) => {
    tx.prepare(
      `INSERT INTO workbooks (id, organization_id, city_id, division_code, owner_user_id, owner_session_id, title, description, folder, data_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'My Files', 'HISTORICAL', ?, ?)`
    ).run(
      wbId,
      auth.ctx.organizationId,
      parsed.data.cityId ?? null,
      parsed.data.divisionCode ?? null,
      auth.ctx.userId,
      auth.ctx.isCareerFestVisitor ? auth.ctx.sessionId : null,
      parsed.data.title.trim(),
      parsed.data.description ?? "SMART GRID SHEETS workbook",
      now,
      now
    );

    tx.prepare(
      `INSERT INTO workbook_sheets (id, workbook_id, name, sheet_order, cells_json, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`
    ).run(shId, wbId, parsed.data.initialSheetName, JSON.stringify(cells), now);

    tx.prepare(
      `INSERT INTO workbook_versions (id, workbook_id, version_number, snapshot_json, created_by, note, created_at)
       VALUES (?, ?, 1, ?, ?, 'Initial workbook creation', ?)`
    ).run(
      `wbv_${crypto.randomUUID().slice(0, 12)}`,
      wbId,
      JSON.stringify([{ name: parsed.data.initialSheetName, cells }]),
      auth.ctx.userId,
      now
    );
  });

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "WORKBOOK_CREATED",
    resourceType: "WORKBOOK",
    resourceId: wbId,
  });

  return apiSuccess({ id: wbId, sheetId: shId }, undefined, 201);
}
