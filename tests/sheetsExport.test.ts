import test from "node:test";
import assert from "node:assert/strict";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { readSheet } from "read-excel-file/node";
import { evaluateSheet } from "../src/lib/sheets/formulaEngine";
import {
  isSafeCellRefKey,
  parseCsvToMatrix,
  parseJsonToMatrix,
  sanitizeForCsv,
  sanitizeSheetTabName,
  serializeMatrixToCsv,
  validateXlsxUploadBytes,
  WORKBOOK_LIMITS,
} from "../src/lib/sheets/exportHelpers";

test("XLSX and CSV export roundtrip preserves evaluated SMART GRID SHEETS values via write-excel-file & read-excel-file", async () => {
  const cells = {
    A1: { raw: "Division" },
    B1: { raw: "Load MW" },
    A2: { raw: "07 Energy" },
    B2: { raw: "420" },
    A3: { raw: "Total" },
    B3: { raw: "=SUM(B2:B2)" },
  };
  const evaluated = evaluateSheet(cells);
  assert.equal(evaluated.B3.value, 420);

  const sheetData: SheetData = [
    [{ value: "Division", fontWeight: "bold" }, { value: "Load MW", fontWeight: "bold" }],
    [{ value: "07 Energy" }, { value: evaluated.B2.value as number }],
    [{ value: "Total" }, { value: evaluated.B3.value as number }],
  ];

  const used = new Set<string>();
  const name1 = sanitizeSheetTabName("GridMetrics:2026/[Very Long Division Worksheet Name]", used);
  const name2 = sanitizeSheetTabName("GridMetrics:2026/[Very Long Division Worksheet Name]", used);
  assert.ok(name1.length <= 31 && !/[:\\/?*\[\]]/.test(name1));
  assert.ok(name2.length <= 31 && name2 !== name1);

  const fileObj = await writeXlsxFile([
    { sheet: name1, data: sheetData },
    { sheet: name2, data: [[{ value: "Second" }]] },
  ]);
  const buffer = await fileObj.toBuffer();
  assert.ok(buffer.byteLength > 100);

  // Validate OOXML ZIP container header
  const sigCheck = validateXlsxUploadBytes(new Uint8Array(buffer));
  assert.equal(sigCheck.ok, true);

  const rows = await readSheet(buffer, name1);
  assert.deepEqual(rows[0], ["Division", "Load MW"]);
  assert.deepEqual(rows[2], ["Total", 420]);

  const csv = serializeMatrixToCsv([
    ["Division", "Load MW"],
    ["07 Energy", evaluated.B2.value as number],
    ["Total", evaluated.B3.value as number],
  ]);
  assert.ok(csv.includes("Total,420"));
});

test("real sanitizeForCsv neutralizes CSV formula injection (CWE-1236) including leading whitespace", () => {
  const dangerousInputs = [
    "=cmd|' /C calc'!A0",
    "   =SUM(1,2)",
    "\n+1234567890",
    "+1234567890",
    "-2+3*[calc]",
    "@SUM(1,2)",
    "\tmalicious_tab",
    "\rmalicious_cr",
  ];

  for (const input of dangerousInputs) {
    const sanitized = sanitizeForCsv(input);
    assert.ok(sanitized.startsWith("'"), `Expected ${JSON.stringify(input)} to be neutralized`);
  }

  const safeInputs = ["Normal Text", "Division 07", "420", "City = Alpha"];
  for (const input of safeInputs) {
    assert.equal(sanitizeForCsv(input), input);
  }
});

test("formulaEngine rejects Infinity overflow literals with #NUM! and short-circuits =IF() untaken branch", () => {
  const res = evaluateSheet({
    A1: { raw: "1e999" },
    A2: { raw: "=1e999" },
    A3: { raw: "=1e308 * 1e308" },
    a4: { raw: "50" },
    A5: { raw: "=A4 + 10" },
    B1: { raw: "0" },
    B2: { raw: '=IF(B1=0, "SAFE_ZERO", 100/B1)' },
    B3: { raw: '=IF(B1>0, 100/B1, "FALLBACK")' },
  });
  assert.equal(res.A1.value, "1e999");
  assert.equal(res.A2.value, "#NUM!");
  assert.equal(res.A3.value, "#NUM!");
  assert.equal(res.A5.value, 60);
  assert.equal(res.B2.value, "SAFE_ZERO");
  assert.equal(res.B2.error, undefined);
  assert.equal(res.B3.value, "FALLBACK");
  assert.equal(res.B3.error, undefined);
});

test("CSV, JSON, and XLSX import validators enforce limits and block OLE2/prototype-pollution", () => {
  // 1. Legacy .xls (OLE2 magic D0 CF 11 E0) must be rejected
  const fakeXls = new Uint8Array(64);
  fakeXls.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  const xlsRes = validateXlsxUploadBytes(fakeXls);
  assert.equal(xlsRes.ok, false);
  if (!xlsRes.ok) assert.match(xlsRes.error, /Legacy binary \.xls/i);

  // 2. Oversized payload rejected
  const emptyCheck = validateXlsxUploadBytes(new Uint8Array(10));
  assert.equal(emptyCheck.ok, false);
  const tooBigCheck = validateXlsxUploadBytes(new Uint8Array(64), 32);
  assert.equal(tooBigCheck.ok, false);

  // 3. Prototype pollution keys filtered in parseJsonToMatrix
  const jsonText = JSON.stringify([
    { Division: "07", __proto__: "evil", constructor: "evil", prototype: "evil", Load: 120 },
  ]);
  const parsedJson = parseJsonToMatrix(jsonText);
  assert.deepEqual(parsedJson.matrix[0], ["Division", "Load"]);
  assert.deepEqual(parsedJson.matrix[1], ["07", "120"]);

  // 4. ReDoS-free RFC 4180 CSV parser reports exact truncation counts
  const csvSample = "\uFEFFHeaderA,HeaderB,HeaderC\r\n\"val,1\",val2,val3\r\nr2a,r2b,r2c\r\nr3a,r3b,r3c";
  const parsedCsv = parseCsvToMatrix(csvSample, 3, 2);
  assert.equal(parsedCsv.matrix.length, 3);
  assert.deepEqual(parsedCsv.matrix[1], ["val,1", "val2"]);
  assert.equal(parsedCsv.totalRows, 4);
  assert.equal(parsedCsv.truncatedRows, 1);
  assert.equal(parsedCsv.truncatedCols, 1);

  // 5. Safe cell ref validator blocks prototype keys
  assert.equal(isSafeCellRefKey("A1"), true);
  assert.equal(isSafeCellRefKey("AA250"), true);
  assert.equal(isSafeCellRefKey("__proto__"), false);
  assert.equal(isSafeCellRefKey("constructor"), false);
  assert.equal(WORKBOOK_LIMITS.MAX_CELLS, 10_000);
});
