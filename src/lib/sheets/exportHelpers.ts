/**
 * Export & import helpers for SMART GRID SHEETS:
 * - CWE-1236 CSV formula neutralization
 * - OOXML worksheet tab-name compliance
 * - ReDoS-free RFC 4180 CSV parser & serializer
 * - Prototype-pollution-safe JSON / OOXML ZIP boundary validators
 */

export const WORKBOOK_LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024, // 5 MB max client import payload
  MAX_SHEETS: 25,
  MAX_ROWS: 500,
  MAX_COLS: 52,
  MAX_CELLS: 10_000,
} as const;

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Neutralizes spreadsheet formula injection in CSV string cells, including leading whitespace/control chars
 * before formula trigger characters (=, +, -, @, tab, CR).
 */
export function sanitizeForCsv(val: string): string {
  if (/^[\s]*[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

/**
 * Normalizes an Excel worksheet tab name:
 * - Strips characters forbidden by OOXML (: \ / ? * [ ])
 * - Enforces <= 31 characters
 * - Guarantees uniqueness across sheets in the same workbook (case-insensitive)
 */
export function sanitizeSheetTabName(rawName: string, usedLowerNames: Set<string>): string {
  const cleaned =
    rawName
      .replace(/[:\\/?*\[\]]/g, "_")
      .replace(/[\r\n\t]+/g, " ")
      .trim() || "Sheet";

  const base = cleaned.slice(0, 31).trim() || "Sheet";
  let candidate = base;
  let counter = 2;

  while (usedLowerNames.has(candidate.toLowerCase())) {
    const suffix = `_${counter}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    counter++;
  }

  usedLowerNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * RFC 4180 compliant CSV serializer without third-party dependencies.
 */
export function serializeMatrixToCsv(
  matrix: (string | number | boolean | null | undefined)[][],
  sanitizeFormulas = true
): string {
  const escapeField = (raw: string | number | boolean | null | undefined): string => {
    if (raw === null || raw === undefined) return "";
    let str = typeof raw === "string" ? raw : String(raw);
    if (sanitizeFormulas && typeof raw === "string") {
      str = sanitizeForCsv(str);
    }
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return matrix.map((row) => row.map(escapeField).join(",")).join("\r\n");
}

/**
 * Linear-time RFC 4180 CSV parser (ReDoS-immune) with explicit row/column caps.
 */
export function parseCsvToMatrix(
  csvText: string,
  maxRows: number = WORKBOOK_LIMITS.MAX_ROWS,
  maxCols: number = WORKBOOK_LIMITS.MAX_COLS
): { matrix: string[][]; totalRows: number; truncatedRows: number; truncatedCols: number } {
  const clean = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let totalRows = 0;
  let truncatedCols = 0;

  const pushRow = () => {
    if (row.length === 1 && row[0] === "" && rows.length > 0 && inQuotes === false) {
      row = [];
      return;
    }
    totalRows++;
    if (rows.length < maxRows) {
      if (row.length > maxCols) {
        truncatedCols = Math.max(truncatedCols, row.length - maxCols);
        rows.push(row.slice(0, maxCols));
      } else {
        rows.push(row);
      }
    }
    row = [];
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      if (field === "") {
        inQuotes = true;
      } else {
        field += ch;
      }
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      pushRow();
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      pushRow();
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    pushRow();
  }

  return {
    matrix: rows,
    totalRows,
    truncatedRows: Math.max(0, totalRows - maxRows),
    truncatedCols,
  };
}

/**
 * Parses uploaded JSON workbook payloads safely, rejecting prototype pollution keys
 * (__proto__, constructor, prototype) and bounding rows/columns.
 */
export function parseJsonToMatrix(
  jsonText: string,
  maxRows: number = WORKBOOK_LIMITS.MAX_ROWS,
  maxCols: number = WORKBOOK_LIMITS.MAX_COLS
): { matrix: string[][]; totalRows: number; truncatedRows: number; truncatedCols: number } {
  const parsed = JSON.parse(jsonText) as unknown;
  const rawRows: unknown[] = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { rows?: unknown }).rows)
      ? ((parsed as { rows: unknown[] }).rows)
      : [];

  if (rawRows.length === 0) {
    return { matrix: [], totalRows: 0, truncatedRows: 0, truncatedCols: 0 };
  }

  let truncatedCols = 0;
  const matrix: string[][] = [];

  if (typeof rawRows[0] === "object" && rawRows[0] !== null && !Array.isArray(rawRows[0])) {
    const firstObj = rawRows[0] as Record<string, unknown>;
    const allKeys = Object.keys(firstObj).filter((k) => !FORBIDDEN_OBJECT_KEYS.has(k));
    if (allKeys.length > maxCols) {
      truncatedCols = allKeys.length - maxCols;
    }
    const keys = allKeys.slice(0, maxCols);
    matrix.push(keys);
    const dataLimit = Math.max(0, maxRows - 1);
    for (const item of rawRows.slice(0, dataLimit)) {
      const obj = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      matrix.push(
        keys.map((k) => {
          const v = Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : "";
          return v === null || v === undefined ? "" : String(v);
        })
      );
    }
    const totalRows = rawRows.length + 1;
    return {
      matrix,
      totalRows,
      truncatedRows: Math.max(0, totalRows - maxRows),
      truncatedCols,
    };
  }

  for (const r of rawRows.slice(0, maxRows)) {
    if (!Array.isArray(r)) continue;
    if (r.length > maxCols) {
      truncatedCols = Math.max(truncatedCols, r.length - maxCols);
    }
    matrix.push(r.slice(0, maxCols).map((v) => (v === null || v === undefined ? "" : String(v))));
  }

  return {
    matrix,
    totalRows: rawRows.length,
    truncatedRows: Math.max(0, rawRows.length - maxRows),
    truncatedCols,
  };
}

/**
 * Validates OOXML .xlsx byte headers cleanly before ZIP parsing:
 * - Rejects empty/oversized payloads
 * - Rejects legacy binary .xls (OLE2 magic D0 CF 11 E0)
 * - Enforces OOXML ZIP local file header magic (PK\x03\x04)
 */
export function validateXlsxUploadBytes(
  bytes: Uint8Array,
  maxBytes: number = WORKBOOK_LIMITS.MAX_FILE_BYTES
): { ok: true } | { ok: false; error: string } {
  if (!bytes || bytes.byteLength < 30) {
    return { ok: false, error: "Uploaded file is empty or too small to be a valid XLSX workbook." };
  }
  if (bytes.byteLength > maxBytes) {
    return {
      ok: false,
      error: `Workbook file exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB upload limit.`,
    };
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return {
      ok: false,
      error: "Legacy binary .xls workbooks are disabled for security. Export or save as .xlsx, .csv, or .json.",
    };
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return {
      ok: false,
      error: "Malformed XLSX container: missing OOXML ZIP signature.",
    };
  }
  return { ok: true };
}

/**
 * Validates persisted/API cell keys to prevent prototype pollution or oversized sheets.
 */
export function isSafeCellRefKey(key: string): boolean {
  if (FORBIDDEN_OBJECT_KEYS.has(key)) return false;
  return /^[A-Za-z]{1,3}[1-9][0-9]{0,3}$/.test(key);
}
