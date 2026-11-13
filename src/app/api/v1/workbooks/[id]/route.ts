import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRow, normalizeRows, withTransaction } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { requireAuth, assertMutationSecurity } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";
import { isSafeCellRefKey, WORKBOOK_LIMITS } from "@/lib/sheets/exportHelpers";
import { canVisitorAccessWorkbook } from "@/lib/careerFest/service";

const SaveWorkbookSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  isStarred: z.boolean().optional(),
  sheetId: z.string().optional(),
  cells: z
    .record(
      z.string(),
      z.object({
        raw: z.string().max(4000),
        format: z.enum(["text", "number", "currency", "percent", "date"]).optional(),
        bold: z.boolean().optional(),
        note: z.string().max(500).optional(),
      })
    )
    .refine((rec) => Object.keys(rec).length <= WORKBOOK_LIMITS.MAX_CELLS, {
      message: `Sheet cannot exceed ${WORKBOOK_LIMITS.MAX_CELLS} cells.`,
    })
    .refine((rec) => Object.keys(rec).every((k) => isSafeCellRefKey(k)), {
      message: "Invalid or unsafe cell coordinate key.",
    })
    .optional(),
  addSheetName: z.string().min(1).max(60).optional(),
  renameSheet: z.object({ sheetId: z.string(), name: z.string().min(1).max(60) }).optional(),
  saveVersionNote: z.string().max(200).optional(),
  restoreVersionId: z.string().optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  const auth = await requireAuth("sheets:read");
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = getDb();
  const wb = normalizeRow<Record<string, unknown>>(
    db
      .prepare("SELECT * FROM workbooks WHERE id = ? AND organization_id = ? AND is_archived = 0")
      .get(id, auth.ctx.organizationId)
  );
  if (!wb) {
    return apiError("NOT_FOUND", "Workbook not found in your organization.", 404);
  }
  const access = canVisitorAccessWorkbook(
    wb as { owner_session_id?: string | null },
    auth.ctx,
    "read"
  );
  if (!access.allowed) {
    return apiError(access.code, access.message, access.status);
  }

  const sheets = normalizeRows(
    db
      .prepare("SELECT * FROM workbook_sheets WHERE workbook_id = ? ORDER BY sheet_order ASC")
      .all(id)
  );

  const versions = normalizeRows(
    db
      .prepare(
        "SELECT id, version_number, note, created_by, created_at FROM workbook_versions WHERE workbook_id = ? ORDER BY version_number DESC LIMIT 20"
      )
      .all(id)
  );

  return apiSuccess({ workbook: wb, sheets, versions });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("sheets:write");
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = getDb();
  const wb = normalizeRow<{ id: string; owner_session_id: string | null }>(
    db
      .prepare("SELECT id, owner_session_id FROM workbooks WHERE id = ? AND organization_id = ? AND is_archived = 0")
      .get(id, auth.ctx.organizationId)
  );
  if (!wb) {
    return apiError("NOT_FOUND", "Workbook not found in your organization.", 404);
  }
  const access = canVisitorAccessWorkbook(wb, auth.ctx, "write");
  if (!access.allowed) {
    return apiError(access.code, access.message, access.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = SaveWorkbookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid workbook update payload.", 400);
  }

  const now = new Date().toISOString();

  if (parsed.data.sheetId) {
    const targetSheet = normalizeRow<{ id: string }>(
      db
        .prepare("SELECT id FROM workbook_sheets WHERE id = ? AND workbook_id = ?")
        .get(parsed.data.sheetId, id)
    );
    if (!targetSheet) {
      return apiError("NOT_FOUND", "Target worksheet not found in this workbook.", 404);
    }
  }

  if (parsed.data.addSheetName) {
    const countRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM workbook_sheets WHERE workbook_id = ?")
      .get(id) as { cnt: number };
    if (countRow.cnt >= WORKBOOK_LIMITS.MAX_SHEETS) {
      return apiError(
        "WORKBOOK_SHEET_LIMIT",
        `Workbook cannot exceed ${WORKBOOK_LIMITS.MAX_SHEETS} worksheet tabs.`,
        400
      );
    }
  }

  withTransaction((tx) => {
    if (parsed.data.title) {
      tx.prepare("UPDATE workbooks SET title = ?, updated_at = ? WHERE id = ?").run(
        parsed.data.title.trim(),
        now,
        id
      );
    }
    if (parsed.data.isStarred !== undefined) {
      tx.prepare("UPDATE workbooks SET is_starred = ?, updated_at = ? WHERE id = ?").run(
        parsed.data.isStarred ? 1 : 0,
        now,
        id
      );
    }
    if (parsed.data.sheetId && parsed.data.cells) {
      tx.prepare(
        "UPDATE workbook_sheets SET cells_json = ?, updated_at = ? WHERE id = ? AND workbook_id = ?"
      ).run(JSON.stringify(parsed.data.cells), now, parsed.data.sheetId, id);
      tx.prepare("UPDATE workbooks SET updated_at = ? WHERE id = ?").run(now, id);
    }
    if (parsed.data.addSheetName) {
      const countRow = tx
        .prepare("SELECT COUNT(*) AS cnt FROM workbook_sheets WHERE workbook_id = ?")
        .get(id) as { cnt: number };
      tx.prepare(
        "INSERT INTO workbook_sheets (id, workbook_id, name, sheet_order, cells_json, updated_at) VALUES (?, ?, ?, ?, '{}', ?)"
      ).run(
        `sh_${crypto.randomUUID().slice(0, 12)}`,
        id,
        parsed.data.addSheetName.trim(),
        countRow.cnt,
        now
      );
    }
    if (parsed.data.renameSheet) {
      tx.prepare(
        "UPDATE workbook_sheets SET name = ?, updated_at = ? WHERE id = ? AND workbook_id = ?"
      ).run(parsed.data.renameSheet.name.trim(), now, parsed.data.renameSheet.sheetId, id);
    }
    if (parsed.data.saveVersionNote) {
      const sheets = normalizeRows<{ name: string; cells_json: string }>(
        tx
          .prepare("SELECT name, cells_json FROM workbook_sheets WHERE workbook_id = ? ORDER BY sheet_order ASC")
          .all(id)
      );
      const maxRow = tx
        .prepare("SELECT COALESCE(MAX(version_number), 0) AS mx FROM workbook_versions WHERE workbook_id = ?")
        .get(id) as { mx: number };
      const safeSnap = sheets.map((s) => {
        try {
          return { name: s.name, cells: JSON.parse(s.cells_json || "{}") };
        } catch {
          return { name: s.name, cells: {} };
        }
      });
      tx.prepare(
        "INSERT INTO workbook_versions (id, workbook_id, version_number, snapshot_json, created_by, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        `wbv_${crypto.randomUUID().slice(0, 12)}`,
        id,
        maxRow.mx + 1,
        JSON.stringify(safeSnap),
        auth.ctx.userId,
        parsed.data.saveVersionNote,
        now
      );
    }
    if (parsed.data.restoreVersionId) {
      const ver = normalizeRow<{ snapshot_json: string }>(
        tx
          .prepare("SELECT snapshot_json FROM workbook_versions WHERE id = ? AND workbook_id = ?")
          .get(parsed.data.restoreVersionId, id)
      );
      if (ver) {
        let snap: { name: string; cells: Record<string, unknown> }[] = [];
        try {
          snap = JSON.parse(ver.snapshot_json || "[]");
        } catch {
          snap = [];
        }
        if (Array.isArray(snap)) {
          tx.prepare("DELETE FROM workbook_sheets WHERE workbook_id = ?").run(id);
          snap.forEach((s, idx) => {
            tx.prepare(
              "INSERT INTO workbook_sheets (id, workbook_id, name, sheet_order, cells_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).run(
              `sh_${crypto.randomUUID().slice(0, 12)}`,
              id,
              s.name,
              idx,
              JSON.stringify(s.cells || {}),
              now
            );
          });
        }
      }
    }
  });

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "WORKBOOK_UPDATED",
    resourceType: "WORKBOOK",
    resourceId: id,
  });

  return apiSuccess({ updated: true, updatedAt: now });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("sheets:write");
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = getDb();
  const wb = normalizeRow<{ id: string; owner_session_id: string | null }>(
    db
      .prepare("SELECT id, owner_session_id FROM workbooks WHERE id = ? AND organization_id = ? AND is_archived = 0")
      .get(id, auth.ctx.organizationId)
  );
  if (!wb) {
    return apiError("NOT_FOUND", "Workbook not found.", 404);
  }
  const access = canVisitorAccessWorkbook(wb, auth.ctx, "write");
  if (!access.allowed) {
    return apiError(access.code, access.message, access.status);
  }
  const res = db
    .prepare("UPDATE workbooks SET is_archived = 1, updated_at = ? WHERE id = ? AND organization_id = ? AND is_archived = 0")
    .run(new Date().toISOString(), id, auth.ctx.organizationId);

  if (res.changes === 0) {
    return apiError("NOT_FOUND", "Workbook not found.", 404);
  }
  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "WORKBOOK_ARCHIVED",
    resourceType: "WORKBOOK",
    resourceId: id,
  });
  return apiSuccess({ archived: true });
}
