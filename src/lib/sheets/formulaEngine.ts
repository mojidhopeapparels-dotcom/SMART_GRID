export interface CellData {
  raw: string;
  format?: "text" | "number" | "currency" | "percent" | "date";
  bold?: boolean;
  note?: string;
}

export type CellMap = Record<string, CellData>;

export interface EvaluatedCell {
  raw: string;
  value: string | number | boolean | null;
  display: string;
  error?: string;
}

export function colIndexToLetter(index: number): string {
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function colLetterToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase());
  if (!match) return null;
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  if (row < 0 || col < 0) return null;
  return { col, row };
}

export function expandRange(startRef: string, endRef: string): string[] {
  const a = parseCellRef(startRef);
  const b = parseCellRef(endRef);
  if (!a || !b) return [];
  const minC = Math.min(a.col, b.col);
  const maxC = Math.max(a.col, b.col);
  const minR = Math.min(a.row, b.row);
  const maxR = Math.max(a.row, b.row);
  const refs: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      refs.push(`${colIndexToLetter(c)}${r + 1}`);
    }
  }
  return refs;
}

type Token =
  | { type: "NUM"; value: number }
  | { type: "STR"; value: string }
  | { type: "BOOL"; value: boolean }
  | { type: "ID"; value: string }
  | { type: "OP"; value: string }
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "COMMA" }
  | { type: "COLON" };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "COMMA" });
      i++;
      continue;
    }
    if (ch === ":") {
      tokens.push({ type: "COLON" });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = "";
      while (i < expr.length && expr[i] !== quote) {
        str += expr[i++];
      }
      if (expr[i] !== quote) throw new Error("#VALUE!");
      i++;
      tokens.push({ type: "STR", value: str });
      continue;
    }
    const twoChar = expr.slice(i, i + 2);
    if (["<=", ">=", "<>", "!="].includes(twoChar)) {
      tokens.push({ type: "OP", value: twoChar });
      i += 2;
      continue;
    }
    if (["+", "-", "*", "/", "^", "=", "<", ">"].includes(ch)) {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i++];
      }
      if (i < expr.length && (expr[i] === "e" || expr[i] === "E")) {
        const nextChar = expr[i + 1];
        if (nextChar === "+" || nextChar === "-" || /[0-9]/.test(nextChar)) {
          numStr += expr[i++];
          if (expr[i] === "+" || expr[i] === "-") {
            numStr += expr[i++];
          }
          while (i < expr.length && /[0-9]/.test(expr[i])) {
            numStr += expr[i++];
          }
        }
      }
      const num = Number(numStr);
      if (!Number.isFinite(num)) throw new Error("#NUM!");
      tokens.push({ type: "NUM", value: num });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let id = "";
      while (i < expr.length && /[A-Za-z0-9_.$]/.test(expr[i])) {
        id += expr[i++];
      }
      const upper = id.toUpperCase().replace(/\$/g, "");
      if (upper === "TRUE") tokens.push({ type: "BOOL", value: true });
      else if (upper === "FALSE") tokens.push({ type: "BOOL", value: false });
      else tokens.push({ type: "ID", value: upper });
      continue;
    }
    throw new Error("#ERROR!");
  }
  return tokens;
}

type EvalArg = string | number | boolean | null | (string | number | boolean | null)[][];

function flattenNumbers(args: EvalArg[]): number[] {
  const nums: number[] = [];
  const pushVal = (v: string | number | boolean | null) => {
    if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
    else if (typeof v === "string" && v.trim() !== "") {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) nums.push(parsed);
    }
  };
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const row of a) {
        for (const v of row) pushVal(v);
      }
    } else {
      pushVal(a);
    }
  }
  return nums;
}

function flattenScalars(args: EvalArg[]): (string | number | boolean | null)[] {
  const out: (string | number | boolean | null)[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const row of a) {
        for (const v of row) out.push(v);
      }
    } else {
      out.push(a);
    }
  }
  return out;
}

function toNumber(v: EvalArg): number {
  if (Array.isArray(v)) throw new Error("#VALUE!");
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === "") return 0;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error("#VALUE!");
  return n;
}

function toScalar(v: EvalArg): string | number | boolean | null {
  if (Array.isArray(v)) return v[0]?.[0] ?? null;
  return v;
}

export function evaluateSheet(cells: CellMap): Record<string, EvaluatedCell> {
  const cache = new Map<string, EvaluatedCell>();
  const visiting = new Set<string>();

  function evalCell(refKey: string): EvaluatedCell {
    const key = refKey.toUpperCase();
    const cached = cache.get(key);
    if (cached) return cached;

    if (visiting.has(key)) {
      return { raw: cells[key]?.raw ?? "", value: "#CIRC!", display: "#CIRC!", error: "Circular reference" };
    }

    const cell = cells[key] ?? cells[refKey];
    const raw = cell?.raw ?? "";
    if (raw === "") {
      const empty: EvaluatedCell = { raw: "", value: null, display: "" };
      cache.set(key, empty);
      return empty;
    }

    if (!raw.startsWith("=")) {
      const trimmed = raw.trim();
      const parsedNum = trimmed !== "" ? Number(trimmed) : NaN;
      const num = Number.isFinite(parsedNum) ? parsedNum : null;
      const val = num !== null ? num : raw;
      const res: EvaluatedCell = {
        raw,
        value: val,
        display: formatDisplay(val, cell?.format),
      };
      cache.set(key, res);
      return res;
    }

    visiting.add(key);
    try {
      const tokens = tokenize(raw.slice(1));
      let pos = 0;

      const peek = () => tokens[pos];
      const consume = () => tokens[pos++];

      function parseComparison(evaluate = true): EvalArg {
        let left = parseAddSub(evaluate);
        while (
          peek()?.type === "OP" &&
          ["=", "<>", "!=", "<", "<=", ">", ">="].includes((peek() as { type: "OP"; value: string }).value)
        ) {
          const op = (consume() as { type: "OP"; value: string }).value;
          const right = parseAddSub(evaluate);
          if (!evaluate) {
            left = false;
            continue;
          }
          const l = toScalar(left);
          const r = toScalar(right);
          if (op === "=") left = l === r;
          else if (op === "<>" || op === "!=") left = l !== r;
          else if (op === "<") left = toNumber(l) < toNumber(r);
          else if (op === "<=") left = toNumber(l) <= toNumber(r);
          else if (op === ">") left = toNumber(l) > toNumber(r);
          else if (op === ">=") left = toNumber(l) >= toNumber(r);
        }
        return left;
      }

      function parseAddSub(evaluate = true): EvalArg {
        let left = parseMulDiv(evaluate);
        while (peek()?.type === "OP" && ["+", "-"].includes((peek() as { type: "OP"; value: string }).value)) {
          const op = (consume() as { type: "OP"; value: string }).value;
          const right = parseMulDiv(evaluate);
          if (!evaluate) {
            left = 0;
            continue;
          }
          const res = op === "+" ? toNumber(left) + toNumber(right) : toNumber(left) - toNumber(right);
          if (!Number.isFinite(res)) throw new Error("#NUM!");
          left = res;
        }
        return left;
      }

      function parseMulDiv(evaluate = true): EvalArg {
        let left = parsePower(evaluate);
        while (peek()?.type === "OP" && ["*", "/"].includes((peek() as { type: "OP"; value: string }).value)) {
          const op = (consume() as { type: "OP"; value: string }).value;
          const right = parsePower(evaluate);
          if (!evaluate) {
            left = 0;
            continue;
          }
          if (op === "*") {
            const res = toNumber(left) * toNumber(right);
            if (!Number.isFinite(res)) throw new Error("#NUM!");
            left = res;
          } else {
            const denom = toNumber(right);
            if (denom === 0) throw new Error("#DIV/0!");
            const res = toNumber(left) / denom;
            if (!Number.isFinite(res)) throw new Error("#NUM!");
            left = res;
          }
        }
        return left;
      }

      function parsePower(evaluate = true): EvalArg {
        let left = parseUnary(evaluate);
        while (peek()?.type === "OP" && (peek() as { type: "OP"; value: string }).value === "^") {
          consume();
          const right = parseUnary(evaluate);
          if (!evaluate) {
            left = 0;
            continue;
          }
          const res = Math.pow(toNumber(left), toNumber(right));
          if (!Number.isFinite(res)) throw new Error("#NUM!");
          left = res;
        }
        return left;
      }

      function parseUnary(evaluate = true): EvalArg {
        if (peek()?.type === "OP" && (peek() as { type: "OP"; value: string }).value === "-") {
          consume();
          const v = parseUnary(evaluate);
          return evaluate ? -toNumber(v) : 0;
        }
        if (peek()?.type === "OP" && (peek() as { type: "OP"; value: string }).value === "+") {
          consume();
          const v = parseUnary(evaluate);
          return evaluate ? toNumber(v) : 0;
        }
        return parsePrimary(evaluate);
      }

      function parsePrimary(evaluate = true): EvalArg {
        const tok = peek();
        if (!tok) throw new Error("#ERROR!");
        if (tok.type === "NUM" || tok.type === "STR" || tok.type === "BOOL") {
          consume();
          return tok.value;
        }
        if (tok.type === "LPAREN") {
          consume();
          const val = parseComparison(evaluate);
          if (peek()?.type !== "RPAREN") throw new Error("#ERROR!");
          consume();
          return val;
        }
        if (tok.type === "ID") {
          consume();
          if (peek()?.type === "LPAREN") {
            consume();
            if (tok.value === "IF") {
              if (peek()?.type === "RPAREN") throw new Error("#ERROR!");
              const condVal = parseComparison(evaluate);
              const truthy = evaluate ? Boolean(toScalar(condVal)) : false;
              let trueBranch: EvalArg = true;
              let falseBranch: EvalArg = false;
              if (peek()?.type === "COMMA") {
                consume();
                trueBranch = parseComparison(evaluate && truthy);
              }
              if (peek()?.type === "COMMA") {
                consume();
                falseBranch = parseComparison(evaluate && !truthy);
              }
              while (peek()?.type === "COMMA") {
                consume();
                parseComparison(false);
              }
              if (peek()?.type !== "RPAREN") throw new Error("#ERROR!");
              consume();
              if (!evaluate) return null;
              return truthy ? toScalar(trueBranch) : toScalar(falseBranch);
            }

            const args: EvalArg[] = [];
            if (peek()?.type !== "RPAREN") {
              args.push(parseComparison(evaluate));
              while (peek()?.type === "COMMA") {
                consume();
                args.push(parseComparison(evaluate));
              }
            }
            if (peek()?.type !== "RPAREN") throw new Error("#ERROR!");
            consume();
            return evaluate ? callFunction(tok.value, args) : null;
          }
          if (peek()?.type === "COLON") {
            consume();
            const endTok = consume();
            if (!endTok || endTok.type !== "ID") throw new Error("#REF!");
            const start = parseCellRef(tok.value);
            const end = parseCellRef(endTok.value);
            if (!start || !end) throw new Error("#REF!");
            const minR = Math.min(start.row, end.row);
            const maxR = Math.max(start.row, end.row);
            const minC = Math.min(start.col, end.col);
            const maxC = Math.max(start.col, end.col);
            const totalCells = (maxR - minR + 1) * (maxC - minC + 1);
            if (totalCells > 10_000) throw new Error("#LIMIT!");
            if (!evaluate) return [[null]];
            const matrix: (string | number | boolean | null)[][] = [];
            for (let r = minR; r <= maxR; r++) {
              const rowArr: (string | number | boolean | null)[] = [];
              for (let c = minC; c <= maxC; c++) {
                const ref = `${colIndexToLetter(c)}${r + 1}`;
                const ev = evalCell(ref);
                if (ev.error) throw new Error(String(ev.value));
                rowArr.push(ev.value);
              }
              matrix.push(rowArr);
            }
            return matrix;
          }
          if (!parseCellRef(tok.value)) throw new Error("#NAME?");
          if (!evaluate) return null;
          const ev = evalCell(tok.value);
          if (ev.error) throw new Error(String(ev.value));
          return ev.value;
        }
        throw new Error("#ERROR!");
      }

      const rawResult = parseComparison();
      if (pos < tokens.length) throw new Error("#ERROR!");
      const scalar = toScalar(rawResult);
      if (typeof scalar === "number" && !Number.isFinite(scalar)) {
        throw new Error("#NUM!");
      }
      const finalVal =
        typeof scalar === "number" ? Math.round(scalar * 1e10) / 1e10 : scalar;
      const evaluated: EvaluatedCell = {
        raw,
        value: finalVal,
        display: formatDisplay(finalVal, cell?.format),
      };
      cache.set(key, evaluated);
      return evaluated;
    } catch (err) {
      const code = err instanceof Error && err.message.startsWith("#") ? err.message : "#ERROR!";
      const evaluated: EvaluatedCell = {
        raw,
        value: code,
        display: code,
        error: code,
      };
      cache.set(key, evaluated);
      return evaluated;
    } finally {
      visiting.delete(key);
    }
  }

  for (const key of Object.keys(cells)) {
    evalCell(key);
  }
  const out: Record<string, EvaluatedCell> = {};
  for (const [k, v] of cache.entries()) {
    out[k] = v;
  }
  return out;
}

function callFunction(name: string, args: EvalArg[]): string | number | boolean | null {
  switch (name) {
    case "SUM":
      return flattenNumbers(args).reduce((a, b) => a + b, 0);
    case "AVERAGE":
    case "AVG": {
      const nums = flattenNumbers(args);
      if (nums.length === 0) throw new Error("#DIV/0!");
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    case "MIN": {
      const nums = flattenNumbers(args);
      return nums.length === 0 ? 0 : Math.min(...nums);
    }
    case "MAX": {
      const nums = flattenNumbers(args);
      return nums.length === 0 ? 0 : Math.max(...nums);
    }
    case "MEDIAN": {
      const nums = flattenNumbers(args).sort((a, b) => a - b);
      if (nums.length === 0) throw new Error("#NUM!");
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
    }
    case "COUNT":
      return flattenNumbers(args).length;
    case "COUNTA":
      return flattenScalars(args).filter((v) => v !== null && String(v).trim() !== "").length;
    case "ABS":
      return Math.abs(toNumber(args[0] ?? 0));
    case "ROUND": {
      const val = toNumber(args[0] ?? 0);
      const digits = Math.trunc(toNumber(args[1] ?? 0));
      const factor = Math.pow(10, digits);
      return Math.round(val * factor) / factor;
    }
    case "IF": {
      const cond = Boolean(toScalar(args[0] ?? false));
      return cond ? toScalar(args[1] ?? true) : toScalar(args[2] ?? false);
    }
    case "AND":
      return flattenScalars(args).every((v) => Boolean(v));
    case "OR":
      return flattenScalars(args).some((v) => Boolean(v));
    case "NOT":
      return !Boolean(toScalar(args[0] ?? false));
    case "CONCAT":
      return flattenScalars(args)
        .map((v) => (v === null ? "" : String(v)))
        .join("");
    case "LEFT": {
      const s = String(toScalar(args[0] ?? "") ?? "");
      const n = Math.max(0, Math.trunc(toNumber(args[1] ?? 1)));
      return s.slice(0, n);
    }
    case "RIGHT": {
      const s = String(toScalar(args[0] ?? "") ?? "");
      const n = Math.max(0, Math.trunc(toNumber(args[1] ?? 1)));
      return n === 0 ? "" : s.slice(-n);
    }
    case "MID": {
      const s = String(toScalar(args[0] ?? "") ?? "");
      const start = Math.max(1, Math.trunc(toNumber(args[1] ?? 1))) - 1;
      const len = Math.max(0, Math.trunc(toNumber(args[2] ?? 0)));
      return s.slice(start, start + len);
    }
    case "TODAY":
      return new Date().toISOString().slice(0, 10);
    case "DATE": {
      const y = Math.trunc(toNumber(args[0] ?? 2026));
      const m = Math.trunc(toNumber(args[1] ?? 1));
      const d = Math.trunc(toNumber(args[2] ?? 1));
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toISOString().slice(0, 10);
    }
    case "VLOOKUP": {
      const needle = toScalar(args[0] ?? null);
      const table = args[1];
      const colIdx = Math.trunc(toNumber(args[2] ?? 1));
      if (!Array.isArray(table) || colIdx < 1) throw new Error("#VALUE!");
      const needleStr = needle === null || needle === undefined ? "" : String(needle).toLowerCase();
      for (const row of table) {
        if (!Array.isArray(row)) continue;
        const cellVal = row[0];
        const cellStr = cellVal === null || cellVal === undefined ? "" : String(cellVal).toLowerCase();
        if (cellStr === needleStr) {
          if (colIdx > row.length) throw new Error("#REF!");
          return row[colIdx - 1] ?? null;
        }
      }
      throw new Error("#N/A");
    }
    default:
      throw new Error("#NAME?");
  }
}

function formatDisplay(
  value: string | number | boolean | null,
  format?: CellData["format"]
): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    }
    if (format === "percent") {
      return `${(value * 100).toFixed(1)}%`;
    }
    return String(value);
  }
  return String(value);
}
