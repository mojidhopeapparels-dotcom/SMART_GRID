import test from "node:test";
import assert from "node:assert/strict";
import {
  colIndexToLetter,
  colLetterToIndex,
  evaluateSheet,
  expandRange,
  parseCellRef,
} from "../src/lib/sheets/formulaEngine";

test("column letter and reference helpers roundtrip", () => {
  assert.equal(colIndexToLetter(0), "A");
  assert.equal(colIndexToLetter(25), "Z");
  assert.equal(colIndexToLetter(26), "AA");
  assert.equal(colLetterToIndex("A"), 0);
  assert.equal(colLetterToIndex("AA"), 26);
  assert.deepEqual(parseCellRef("C12"), { col: 2, row: 11 });
  assert.deepEqual(expandRange("A1", "B2"), ["A1", "B1", "A2", "B2"]);
});

test("evaluates arithmetic, precedence, and aggregate formulas", () => {
  const result = evaluateSheet({
    A1: { raw: "10" },
    A2: { raw: "20" },
    A3: { raw: "30" },
    A4: { raw: "40" },
    B1: { raw: "=A1 + A2 * 2" },
    B2: { raw: "=SUM(A1:A4)" },
    B3: { raw: "=AVERAGE(A1:A4)" },
    B4: { raw: "=MIN(A1:A4)" },
    B5: { raw: "=MAX(A1:A4)" },
    B6: { raw: "=COUNT(A1:A4)" },
    B7: { raw: "=ROUND(12.3456, 2)" },
  });

  assert.equal(result.B1.value, 50);
  assert.equal(result.B2.value, 100);
  assert.equal(result.B3.value, 25);
  assert.equal(result.B4.value, 10);
  assert.equal(result.B5.value, 40);
  assert.equal(result.B6.value, 4);
  assert.equal(result.B7.value, 12.35);
});

test("evaluates logical, text, COUNTA, and VLOOKUP formulas", () => {
  const result = evaluateSheet({
    A1: { raw: "Grid-North" },
    B1: { raw: "92" },
    A2: { raw: "Grid-South" },
    B2: { raw: "68" },
    C1: { raw: '=IF(AND(B1>80, B2<80), "PASS", "FAIL")' },
    C2: { raw: '=IF(OR(B2>90, B1>90), "ALERT", "OK")' },
    C3: { raw: '=CONCAT("Sector: ", LEFT(A1, 4), "-", MID(A1, 6, 5), " / ", RIGHT(A2, 5))' },
    C4: { raw: "=COUNTA(A1:B2)" },
    C5: { raw: '=VLOOKUP("Grid-South", A1:B2, 2, FALSE)' },
  });

  assert.equal(result.C1.value, "PASS");
  assert.equal(result.C2.value, "ALERT");
  assert.equal(result.C3.value, "Sector: Grid-North / South");
  assert.equal(result.C4.value, 4);
  assert.equal(result.C5.value, 68);
});

test("evaluates TODAY and DATE functions", () => {
  const result = evaluateSheet({
    A1: { raw: "=DATE(2026, 3, 5)" },
    A2: { raw: "=TODAY()" },
  });
  assert.equal(result.A1.value, "2026-03-05");
  assert.match(String(result.A2.value), /^\d{4}-\d{2}-\d{2}$/);
});

test("flags division by zero, circular references, and unknown functions", () => {
  const result = evaluateSheet({
    A1: { raw: "=10/0" },
    B1: { raw: "=C1+1" },
    C1: { raw: "=B1+1" },
    D1: { raw: "=NO_SUCH_FN(1)" },
  });

  assert.equal(result.A1.error, "#DIV/0!");
  assert.equal(result.B1.error, "#CIRC!");
  assert.equal(result.C1.error, "#CIRC!");
  assert.equal(result.D1.error, "#NAME?");
});

test("supports scientific notation and power operations", () => {
  const result = evaluateSheet({
    A1: { raw: "=1e3" },
    A2: { raw: "=2.5e2" },
    A3: { raw: "=4^0.5" },
    A4: { raw: "=2^3" },
    A5: { raw: "=10^1000" }, // overflow guard
  });

  assert.equal(result.A1.value, 1000);
  assert.equal(result.A2.value, 250);
  assert.equal(result.A3.value, 2);
  assert.equal(result.A4.value, 8);
  assert.equal(result.A5.error, "#NUM!");
});

test("enforces range expansion cell limits to prevent DoS", () => {
  const result = evaluateSheet({
    A1: { raw: "=SUM(A1:Z1000)" }, // 26 * 1000 = 26,000 cells > 10,000 threshold
  });
  assert.equal(result.A1.error, "#LIMIT!");
});

test("VLOOKUP performs case-insensitive key lookup across ranges", () => {
  const result = evaluateSheet({
    A1: { raw: "alpha" },
    B1: { raw: "100" },
    A2: { raw: "BETA" },
    B2: { raw: "200" },
    C1: { raw: '=VLOOKUP("ALPHA", A1:B2, 2, FALSE)' },
    C2: { raw: '=VLOOKUP("beta", A1:B2, 2, FALSE)' },
  });

  assert.equal(result.C1.value, 100);
  assert.equal(result.C2.value, 200);
});
