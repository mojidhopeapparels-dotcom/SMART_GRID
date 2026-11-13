import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/domain/statuses";
import {
  colIndexToLetter,
  evaluateSheet,
  parseCellRef,
  type CellMap,
} from "@/lib/sheets/formulaEngine";
import {
  sanitizeForCsv,
  sanitizeSheetTabName,
  serializeMatrixToCsv,
} from "@/lib/sheets/exportHelpers";
import { canVisitorAccessWorkbook } from "@/lib/careerFest/service";

const MAX_EXPORT_ROWS = 5000;
const MAX_EXPORT_COLS = 100;

function safeParseCells(raw: string | null | undefined): CellMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function cellsToMatrix(cells: CellMap, sanitizeCsv = false): (string | number | boolean | null)[][] {
  const evaluated = evaluateSheet(cells);
  let maxR = 0;
  let maxC = 0;
  for (const ref of Object.keys(evaluated)) {
    const pos = parseCellRef(ref);
    if (pos && pos.row < MAX_EXPORT_ROWS && pos.col < MAX_EXPORT_COLS) {
      maxR = Math.max(maxR, pos.row);
      maxC = Math.max(maxC, pos.col);
    }
  }
  const rows: (string | number | boolean | null)[][] = [];
  for (let r = 0; r <= maxR; r++) {
    const row: (string | number | boolean | null)[] = [];
    for (let c = 0; c <= maxC; c++) {
      const ref = `${colIndexToLetter(c)}${r + 1}`;
      let val: string | number | boolean | null = evaluated[ref]?.value ?? "";
      if (sanitizeCsv && typeof val === "string") {
        val = sanitizeForCsv(val);
      }
      row.push(val);
    }
    rows.push(row);
  }
  return rows;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  const auth = await requireAuth("data:export");
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();
  const sheetId = url.searchParams.get("sheetId");

  const db = getDb();
  const wb = normalizeRow<{ id: string; title: string; owner_session_id: string | null }>(
    db
      .prepare("SELECT id, title, owner_session_id FROM workbooks WHERE id = ? AND organization_id = ? AND is_archived = 0")
      .get(id, auth.ctx.organizationId)
  );
  if (!wb) {
    return apiError("NOT_FOUND", "Workbook not found.", 404);
  }
  const access = canVisitorAccessWorkbook(wb, auth.ctx, "read");
  if (!access.allowed) {
    return apiError(access.code, access.message, access.status);
  }

  const sheets = normalizeRows<{ id: string; name: string; cells_json: string }>(
    db
      .prepare("SELECT id, name, cells_json FROM workbook_sheets WHERE workbook_id = ? ORDER BY sheet_order ASC")
      .all(id)
  );

  if (sheets.length === 0) {
    return apiError("EMPTY_WORKBOOK", "Workbook has no sheets to export.", 400);
  }

  const safeTitle = wb.title.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 50) || "workbook";
  const targetSheet = (sheetId ? sheets.find((s) => s.id === sheetId) : sheets[0]) ?? sheets[0];

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "WORKBOOK_EXPORTED",
    resourceType: "WORKBOOK",
    resourceId: id,
    details: { format },
  });

  if (format === "json") {
    const matrix = cellsToMatrix(safeParseCells(targetSheet.cells_json), false);
    return new Response(
      JSON.stringify(
        {
          workbook: wb.title,
          sheet: targetSheet.name,
          exportedAt: new Date().toISOString(),
          rows: matrix,
        },
        null,
        2
      ),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeTitle}.json"`,
        },
      }
    );
  }

  if (format === "xlsx") {
    const usedSheetNames = new Set<string>();
    const xlsxSheets = sheets.map((s) => {
      const matrix = cellsToMatrix(safeParseCells(s.cells_json), false);
      const data: SheetData =
        matrix.length > 0
          ? matrix.map((row) =>
              row.map((cell) => {
                if (cell === null || cell === undefined) return "";
                if (
                  typeof cell === "string" ||
                  typeof cell === "number" ||
                  typeof cell === "boolean"
                ) {
                  return cell;
                }
                return String(cell);
              })
            )
          : [[""]];
      return {
        sheet: sanitizeSheetTabName(s.name, usedSheetNames),
        data,
      };
    });

    const exporter = await writeXlsxFile(xlsxSheets);
    const buf = await exporter.toBuffer();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeTitle}.xlsx"`,
      },
    });
  }

  const matrix = cellsToMatrix(safeParseCells(targetSheet.cells_json), true);
  const csv = serializeMatrixToCsv(matrix, false);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}.csv"`,
    },
  });
}
