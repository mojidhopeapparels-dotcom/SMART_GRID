"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Undo2,
  Redo2,
  Upload,
  Download,
  History,
  Sparkles,
  BarChart2,
  Trash2,
  Search,
} from "lucide-react";
import {
  colIndexToLetter,
  evaluateSheet,
  parseCellRef,
  type CellMap,
} from "@/lib/sheets/formulaEngine";
import {
  parseCsvToMatrix,
  parseJsonToMatrix,
  validateXlsxUploadBytes,
  WORKBOOK_LIMITS,
} from "@/lib/sheets/exportHelpers";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface WorkbookMeta {
  id: string;
  title: string;
  data_status: string;
  sheet_count?: number;
  updated_at: string;
}

interface SheetRecord {
  id: string;
  name: string;
  sheet_order: number;
  cells_json: string;
}

interface VersionRecord {
  id: string;
  version_number: number;
  note: string | null;
  created_at: string;
}

const DEFAULT_ROWS = 20;
const DEFAULT_COLS = 10;

export function SheetsWorkspaceClient({
  initialWorkbooks,
  canWrite,
  canExport,
  canUseAi,
  initialSelectedId,
}: {
  initialWorkbooks: WorkbookMeta[];
  canWrite: boolean;
  canExport: boolean;
  canUseAi: boolean;
  initialSelectedId?: string;
}) {
  const [workbooks, setWorkbooks] = useState<WorkbookMeta[]>(initialWorkbooks);
  const [activeId, setActiveId] = useState<string | null>(
    initialSelectedId || initialWorkbooks[0]?.id || null
  );
  const [sheets, setSheets] = useState<SheetRecord[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [cells, setCells] = useState<CellMap>({});
  const [undoStack, setUndoStack] = useState<CellMap[]>([]);
  const [redoStack, setRedoStack] = useState<CellMap[]>([]);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [selectedRef, setSelectedRef] = useState<string>("A1");
  const [formulaInput, setFormulaInput] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [extraRows, setExtraRows] = useState(0);
  const [extraCols, setExtraCols] = useState(0);
  const [newWbTitle, setNewWbTitle] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [chartCol, setChartCol] = useState("B");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const loadWorkbook = useCallback(async (id: string) => {
    setErrorMsg(null);
    setImportWarning(null);
    try {
      const res = await fetch(`/api/v1/workbooks/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json?.error?.message || "Could not load workbook.");
        return;
      }
      const loadedSheets: SheetRecord[] = json.data.sheets || [];
      setSheets(loadedSheets);
      setVersions(json.data.versions || []);
      const first = loadedSheets[0];
      if (first) {
        setActiveSheetId(first.id);
        let parsed: CellMap = {};
        try {
          parsed = JSON.parse(first.cells_json || "{}") as CellMap;
        } catch {
          parsed = {};
        }
        setCells(parsed);
        setUndoStack([]);
        setRedoStack([]);
        setHasUnsavedChanges(false);
        setExtraRows(0);
        setExtraCols(0);
        setSelectedRef("A1");
        setFormulaInput(parsed["A1"]?.raw || "");
      }
    } catch {
      setErrorMsg("Network error loading workbook.");
    }
  }, []);

  useEffect(() => {
    if (activeId) {
      loadWorkbook(activeId);
    }
  }, [activeId, loadWorkbook]);

  const evaluated = useMemo(() => evaluateSheet(cells), [cells]);

  const { rowCount, colCount } = useMemo(() => {
    let maxRow = DEFAULT_ROWS;
    let maxCol = DEFAULT_COLS;
    for (const ref of Object.keys(cells)) {
      const parsed = parseCellRef(ref);
      if (parsed) {
        maxRow = Math.max(maxRow, parsed.row + 3);
        maxCol = Math.max(maxCol, parsed.col + 2);
      }
    }
    return {
      rowCount: Math.min(maxRow + extraRows, WORKBOOK_LIMITS.MAX_ROWS),
      colCount: Math.min(maxCol + extraCols, WORKBOOK_LIMITS.MAX_COLS),
    };
  }, [cells, extraRows, extraCols]);

  const commitCells = useCallback(
    (next: CellMap) => {
      if (Object.keys(next).length > WORKBOOK_LIMITS.MAX_CELLS) {
        setErrorMsg(
          `Workbook sheet limit reached: maximum ${WORKBOOK_LIMITS.MAX_CELLS} populated cells per sheet.`
        );
        return;
      }
      setUndoStack((prev) => [...prev.slice(-25), cells]);
      setRedoStack([]);
      setCells(next);
      setHasUnsavedChanges(true);
    },
    [cells]
  );

  function selectCell(ref: string) {
    setSelectedRef(ref);
    setFormulaInput(cells[ref]?.raw || "");
  }

  function applyCellValue(ref: string, raw: string) {
    if (!canWrite) return;
    const next = { ...cells };
    if (raw === "") delete next[ref];
    else next[ref] = { ...(next[ref] || {}), raw };
    commitCells(next);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, cells]);
    setUndoStack((u) => u.slice(0, -1));
    setCells(prev);
    setHasUnsavedChanges(true);
    setFormulaInput(prev[selectedRef]?.raw || "");
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, cells]);
    setRedoStack((r) => r.slice(0, -1));
    setCells(next);
    setHasUnsavedChanges(true);
    setFormulaInput(next[selectedRef]?.raw || "");
  }

  async function saveSheet(versionNote?: string) {
    if (!activeId || !activeSheetId || !canWrite) return;
    setStatusMsg("Saving...");
    setErrorMsg(null);
    const res = await fetch(`/api/v1/workbooks/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetId: activeSheetId,
        cells,
        ...(versionNote ? { saveVersionNote: versionNote } : {}),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json?.error?.message || "Failed to save sheet.");
      setStatusMsg(null);
    } else {
      setSheets((prev) =>
        prev.map((s) =>
          s.id === activeSheetId ? { ...s, cells_json: JSON.stringify(cells) } : s
        )
      );
      setHasUnsavedChanges(false);
      setStatusMsg(versionNote ? "Saved & version snapshot created." : "Saved.");
      if (versionNote) loadWorkbook(activeId);
      setTimeout(() => setStatusMsg(null), 2500);
    }
  }

  async function createWorkbook() {
    if (!newWbTitle.trim() || !canWrite) return;
    const res = await fetch("/api/v1/workbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newWbTitle.trim() }),
    });
    const json = await res.json();
    if (res.ok) {
      setNewWbTitle("");
      const listRes = await fetch("/api/v1/workbooks");
      const listJson = await listRes.json();
      if (listRes.ok) setWorkbooks(listJson.data);
      setActiveId(json.data.id);
    } else {
      setErrorMsg(json?.error?.message || "Could not create workbook.");
    }
  }

  async function addSheetTab() {
    if (!activeId || !canWrite) return;
    if (sheets.length >= WORKBOOK_LIMITS.MAX_SHEETS) {
      setErrorMsg(`Workbook cannot exceed ${WORKBOOK_LIMITS.MAX_SHEETS} worksheet tabs.`);
      return;
    }
    setErrorMsg(null);
    const name = `Sheet ${sheets.length + 1}`;
    try {
      const res = await fetch(`/api/v1/workbooks/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addSheetName: name }),
      });
      if (res.ok) {
        await loadWorkbook(activeId);
      } else {
        const json = await res.json().catch(() => null);
        setErrorMsg(json?.error?.message || "Could not add worksheet tab.");
      }
    } catch {
      setErrorMsg("Network error adding worksheet tab.");
    }
  }

  async function restoreVersion(versionId: string) {
    if (!activeId || !canWrite) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/workbooks/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreVersionId: versionId }),
      });
      if (res.ok) {
        setShowVersions(false);
        await loadWorkbook(activeId);
        setStatusMsg("Version restored.");
      } else {
        const json = await res.json().catch(() => null);
        setErrorMsg(json?.error?.message || "Could not restore worksheet version.");
      }
    } catch {
      setErrorMsg("Network error restoring worksheet version.");
    }
  }

  async function archiveWorkbook() {
    if (!activeId || !canWrite) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/workbooks/${activeId}`, { method: "DELETE" });
      if (res.ok) {
        const remaining = workbooks.filter((w) => w.id !== activeId);
        setWorkbooks(remaining);
        setActiveId(remaining[0]?.id || null);
        setSheets([]);
        setCells({});
      } else {
        const json = await res.json().catch(() => null);
        setErrorMsg(json?.error?.message || "Could not archive workbook.");
      }
    } catch {
      setErrorMsg("Network error archiving workbook.");
    }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canWrite) return;
    setErrorMsg(null);
    setImportWarning(null);
    try {
      if (file.size > WORKBOOK_LIMITS.MAX_FILE_BYTES) {
        setErrorMsg(
          `File "${file.name}" exceeds the ${Math.round(WORKBOOK_LIMITS.MAX_FILE_BYTES / (1024 * 1024))} MB upload limit.`
        );
        e.target.value = "";
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      let matrix: string[][] = [];
      let truncatedRows = 0;
      let truncatedCols = 0;
      let totalRows = 0;

      if (ext === "json") {
        const parsed = parseJsonToMatrix(
          await file.text(),
          WORKBOOK_LIMITS.MAX_ROWS,
          WORKBOOK_LIMITS.MAX_COLS
        );
        matrix = parsed.matrix;
        truncatedRows = parsed.truncatedRows;
        truncatedCols = parsed.truncatedCols;
        totalRows = parsed.totalRows;
      } else if (ext === "csv") {
        const parsed = parseCsvToMatrix(
          await file.text(),
          WORKBOOK_LIMITS.MAX_ROWS,
          WORKBOOK_LIMITS.MAX_COLS
        );
        matrix = parsed.matrix;
        truncatedRows = parsed.truncatedRows;
        truncatedCols = parsed.truncatedCols;
        totalRows = parsed.totalRows;
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const check = validateXlsxUploadBytes(new Uint8Array(buf), WORKBOOK_LIMITS.MAX_FILE_BYTES);
        if (!check.ok) {
          setErrorMsg(check.error);
          e.target.value = "";
          return;
        }
        const { readSheet } = await import("read-excel-file/browser");
        const rawRows = await readSheet(buf);
        totalRows = rawRows.length;
        truncatedRows = Math.max(0, rawRows.length - WORKBOOK_LIMITS.MAX_ROWS);
        for (const row of rawRows.slice(0, WORKBOOK_LIMITS.MAX_ROWS)) {
          if (row.length > WORKBOOK_LIMITS.MAX_COLS) {
            truncatedCols = Math.max(truncatedCols, row.length - WORKBOOK_LIMITS.MAX_COLS);
          }
          matrix.push(
            row.slice(0, WORKBOOK_LIMITS.MAX_COLS).map((cellVal) => {
              if (cellVal === null || cellVal === undefined) return "";
              if (cellVal instanceof Date) return cellVal.toISOString().slice(0, 10);
              return String(cellVal);
            })
          );
        }
      } else {
        setErrorMsg("Unsupported file format. Supported formats: CSV, XLSX, JSON.");
        e.target.value = "";
        return;
      }

      const nextCells: CellMap = {};
      let cellLimitHit = false;
      for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        for (let c = 0; c < row.length; c++) {
          const val = row[c];
          if (val !== undefined && val !== null && String(val) !== "") {
            if (Object.keys(nextCells).length >= WORKBOOK_LIMITS.MAX_CELLS) {
              cellLimitHit = true;
              break;
            }
            nextCells[`${colIndexToLetter(c)}${r + 1}`] = { raw: String(val) };
          }
        }
        if (cellLimitHit) break;
      }

      commitCells(nextCells);
      const warnings: string[] = [];
      if (truncatedRows > 0) {
        warnings.push(`${truncatedRows} of ${totalRows} rows omitted (limit ${WORKBOOK_LIMITS.MAX_ROWS} rows)`);
      }
      if (truncatedCols > 0) {
        warnings.push(`${truncatedCols} extra column(s) omitted (limit ${WORKBOOK_LIMITS.MAX_COLS} columns)`);
      }
      if (cellLimitHit) {
        warnings.push(`sheet capped at ${WORKBOOK_LIMITS.MAX_CELLS} populated cells`);
      }
      if (warnings.length > 0) {
        setImportWarning(`Import partially truncated for "${file.name}": ${warnings.join("; ")}.`);
      }
      setStatusMsg(
        `Imported ${Object.keys(nextCells).length} cells from ${file.name}. Click Save to persist.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to parse file. Supported formats: CSV, XLSX, JSON."
      );
    }
    e.target.value = "";
  }

  function cleanTrimAndDeduplicate() {
    if (!canWrite) return;
    const seenRows = new Set<string>();
    const next: CellMap = {};
    let writeRow = 1;
    for (let r = 1; r <= rowCount; r++) {
      const vals: string[] = [];
      let hasAny = false;
      for (let c = 0; c < colCount; c++) {
        const ref = `${colIndexToLetter(c)}${r}`;
        const raw = (cells[ref]?.raw || "").trim().replace(/\s+/g, " ");
        if (raw) hasAny = true;
        vals.push(raw);
      }
      if (!hasAny) continue;
      const sig = vals.join("|").toLowerCase();
      if (r > 1 && seenRows.has(sig)) continue;
      seenRows.add(sig);
      vals.forEach((v, c) => {
        if (v !== "") next[`${colIndexToLetter(c)}${writeRow}`] = { raw: v };
      });
      writeRow++;
    }
    commitCells(next);
    setStatusMsg("Normalized whitespace & removed duplicate rows.");
  }

  function runFindReplace() {
    if (!findText || !canWrite) return;
    const next: CellMap = { ...cells };
    let count = 0;
    for (const [ref, cell] of Object.entries(next)) {
      if (cell.raw.includes(findText)) {
        next[ref] = { ...cell, raw: cell.raw.split(findText).join(replaceText) };
        count++;
      }
    }
    commitCells(next);
    setStatusMsg(`Replaced ${count} cell(s).`);
  }

  async function askCopilot() {
    if (!copilotPrompt.trim() || !canUseAi) return;
    setCopilotLoading(true);
    setCopilotReply(null);
    const sampleRows: string[] = [];
    for (let r = 1; r <= 10; r++) {
      const rowVals = Array.from({ length: 6 }, (_, c) => {
        const ref = `${colIndexToLetter(c)}${r}`;
        return `${ref}=${evaluated[ref]?.display || ""}`;
      }).join(", ");
      sampleRows.push(rowVals);
    }
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: copilotPrompt,
          mode: "SHEETS_COPILOT",
          extraContext: `Selected cell ${selectedRef} (${cells[selectedRef]?.raw || "empty"}). Preview:\n${sampleRows.join("\n")}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCopilotReply(`${json?.error?.code || "UNAVAILABLE"}: ${json?.error?.message}`);
      } else {
        setCopilotReply(json.data.reply);
      }
    } catch {
      setCopilotReply("Network error contacting SHEETS Copilot.");
    } finally {
      setCopilotLoading(false);
    }
  }

  const chartSeries = useMemo(() => {
    const pts: { label: string; value: number }[] = [];
    for (let r = 2; r <= rowCount; r++) {
      const label = evaluated[`A${r}`]?.display || `Row ${r}`;
      const val = evaluated[`${chartCol}${r}`]?.value;
      if (typeof val === "number" && Number.isFinite(val)) {
        pts.push({ label, value: val });
      }
    }
    return pts;
  }, [evaluated, chartCol, rowCount]);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Universal Spreadsheet &amp; Data Workspace</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>SMART GRID SHEETS</h1>
          <p className="sg-muted" style={{ margin: 0, fontSize: "0.86rem" }}>
            Multi-sheet formula engine (=SUM, =AVERAGE, =MIN, =MAX, =COUNT, =IF, =ROUND, =VLOOKUP), CSV/XLSX/JSON import &amp; export, data cleaning, and version snapshots.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {hasUnsavedChanges && (
            <span className="sg-badge sg-badge-warn" role="status">Unsaved changes</span>
          )}
          {statusMsg && <span className="sg-badge sg-badge-gold" role="status">{statusMsg}</span>}
        </div>
      </div>

      {importWarning && (
        <div className="sg-banner sg-banner-warn" role="status">{importWarning}</div>
      )}
      {errorMsg && <div className="sg-banner sg-banner-error" role="alert">{errorMsg}</div>}

      <div className="sg-split-sidebar">
        {/* Workbook Manager */}
        <div className="sg-card" style={{ display: "grid", gap: "0.75rem" }}>
          <div className="sg-eyebrow">Workbook Manager</div>
          {canWrite && (
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <input
                type="text"
                className="sg-input"
                placeholder="New workbook title..."
                aria-label="New workbook title"
                value={newWbTitle}
                onChange={(e) => setNewWbTitle(e.target.value)}
              />
              <button type="button" className="sg-btn sg-btn-primary" style={{ padding: "0.45rem 0.65rem" }} onClick={createWorkbook} aria-label="Create workbook">
                <Plus size={15} />
              </button>
            </div>
          )}

          <div style={{ display: "grid", gap: "0.35rem" }}>
            {workbooks.length === 0 ? (
              <p className="sg-muted" style={{ fontSize: "0.82rem" }}>No workbooks yet.</p>
            ) : (
              workbooks.map((wb) => (
                <button
                  key={wb.id}
                  type="button"
                  onClick={() => {
                    if (wb.id === activeId) return;
                    if (
                      hasUnsavedChanges &&
                      !window.confirm("You have unsaved edits on this sheet. Switch workbook and discard unsaved edits?")
                    ) {
                      return;
                    }
                    setActiveId(wb.id);
                  }}
                  className={`sg-nav-item ${wb.id === activeId ? "sg-nav-item-active" : ""}`}
                  style={{ width: "100%", textAlign: "left", background: wb.id === activeId ? undefined : "transparent", border: wb.id === activeId ? undefined : "1px solid var(--sg-border)", cursor: "pointer", justifyContent: "space-between" }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wb.title}</span>
                  <StatusBadge status={wb.data_status} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Editor */}
        <div style={{ display: "grid", gap: "0.85rem", minWidth: 0 }}>
          {/* Toolbar */}
          <div className="sg-card" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", padding: "0.75rem" }}>
            <button type="button" className="sg-btn sg-btn-primary" disabled={!canWrite || !activeId} onClick={() => saveSheet()}>
              <Save size={14} /> Save
            </button>
            <button type="button" className="sg-btn sg-btn-outline" disabled={!canWrite || !activeId} onClick={() => saveSheet(`Snapshot ${new Date().toLocaleTimeString()}`)}>
              <History size={14} /> Save Version
            </button>
            <button type="button" className="sg-btn sg-btn-ghost" disabled={undoStack.length === 0} onClick={undo} aria-label="Undo">
              <Undo2 size={14} />
            </button>
            <button type="button" className="sg-btn sg-btn-ghost" disabled={redoStack.length === 0} onClick={redo} aria-label="Redo">
              <Redo2 size={14} />
            </button>

            {canWrite && (
              <label className="sg-btn sg-btn-outline" style={{ cursor: "pointer" }}>
                <Upload size={14} /> Import CSV/XLSX/JSON
                <input type="file" accept=".csv,.xlsx,.xls,.json" hidden onChange={handleFileImport} />
              </label>
            )}

            <button type="button" className="sg-btn sg-btn-ghost" disabled={!canWrite} onClick={cleanTrimAndDeduplicate}>
              Clean &amp; Deduplicate
            </button>
            <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setShowChart((v) => !v)}>
              <BarChart2 size={14} /> {showChart ? "Hide Chart" : "Chart"}
            </button>
            <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setShowVersions((v) => !v)}>
              Versions ({versions.length})
            </button>

            {canExport && activeId && (
              <div style={{ display: "flex", gap: "0.35rem", marginLeft: "auto" }}>
                <a className="sg-btn sg-btn-outline" href={`/api/v1/workbooks/${activeId}/export?format=csv&sheetId=${activeSheetId || ""}`}>
                  <Download size={13} /> CSV
                </a>
                <a className="sg-btn sg-btn-outline" href={`/api/v1/workbooks/${activeId}/export?format=xlsx`}>
                  <Download size={13} /> XLSX
                </a>
                <a className="sg-btn sg-btn-outline" href={`/api/v1/workbooks/${activeId}/export?format=json&sheetId=${activeSheetId || ""}`}>
                  <Download size={13} /> JSON
                </a>
                {canWrite && (
                  <button type="button" className="sg-btn sg-btn-ghost" onClick={archiveWorkbook} aria-label="Archive workbook">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search & Replace + Formula Bar */}
          <div className="sg-card" style={{ display: "grid", gap: "0.65rem", padding: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span className="sg-badge sg-badge-gold sg-mono" style={{ minWidth: 54, justifyContent: "center" }}>{selectedRef}</span>
              <span className="sg-mono sg-muted" style={{ fontWeight: 700 }}>fx</span>
              <input
                type="text"
                className="sg-input sg-mono"
                aria-label="Formula bar"
                disabled={!canWrite}
                value={formulaInput}
                onChange={(e) => {
                  setFormulaInput(e.target.value);
                  applyCellValue(selectedRef, e.target.value);
                }}
                placeholder="Enter value or formula e.g. =SUM(B2:B4), =IF(B2>35,&quot;HIGH&quot;,&quot;OK&quot;)"
              />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <Search size={14} className="sg-muted" />
              <input className="sg-input" style={{ width: 170 }} aria-label="Find text in sheet" placeholder="Find..." value={findText} onChange={(e) => setFindText(e.target.value)} />
              <input className="sg-input" style={{ width: 170 }} aria-label="Replace text with" placeholder="Replace with..." value={replaceText} onChange={(e) => setReplaceText(e.target.value)} />
              <button type="button" className="sg-btn sg-btn-ghost" disabled={!canWrite || !findText} onClick={runFindReplace}>
                Replace All
              </button>
            </div>
          </div>

          {/* Version History Drawer */}
          {showVersions && (
            <div className="sg-card-gold">
              <div className="sg-eyebrow" style={{ marginBottom: "0.45rem" }}>Workbook Version History</div>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {versions.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.84rem" }}>
                    <span><strong>v{v.version_number}</strong> — {v.note || "Snapshot"} ({new Date(v.created_at).toLocaleString()})</span>
                    {canWrite && (
                      <button type="button" className="sg-btn sg-btn-outline" style={{ padding: "0.25rem 0.6rem", fontSize: "0.76rem" }} onClick={() => restoreVersion(v.id)}>
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart Visualization */}
          {showChart && (
            <div className="sg-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h2 className="sg-h3" style={{ margin: 0 }}>Column Chart Visualization</h2>
                <select className="sg-select" style={{ width: "auto" }} value={chartCol} onChange={(e) => setChartCol(e.target.value)} aria-label="Chart numeric column">
                  {Array.from({ length: colCount }, (_, i) => colIndexToLetter(i)).map((col) => (
                    <option key={col} value={col}>Column {col}</option>
                  ))}
                </select>
              </div>
              {chartSeries.length === 0 ? (
                <p className="sg-muted" style={{ fontSize: "0.84rem" }}>No numeric values in Column {chartCol} (rows 2+).</p>
              ) : (
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  {(() => {
                    const maxVal = Math.max(...chartSeries.map((p) => Math.abs(p.value)), 1);
                    return chartSeries.map((p, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "150px 1fr 70px", gap: "0.5rem", alignItems: "center", fontSize: "0.8rem" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
                        <div style={{ height: 14, background: "#1b1b1b", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (Math.abs(p.value) / maxVal) * 100)}%`, height: "100%", background: "var(--sg-gold)" }} />
                        </div>
                        <span className="sg-mono" style={{ textAlign: "right" }}>{p.value}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Spreadsheet Grid */}
          <div className="sg-table-wrap" style={{ maxHeight: "480px", overflow: "auto", background: "#0a0a0a" }}>
            <table className="sg-table" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: 46, textAlign: "center" }}>#</th>
                  {Array.from({ length: colCount }, (_, c) => {
                    const letter = colIndexToLetter(c);
                    return (
                      <th key={letter} style={{ width: 130, textAlign: "center" }}>
                        {letter}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, rIdx) => {
                  const r = rIdx + 1;
                  return (
                    <tr key={r}>
                      <td style={{ textAlign: "center", color: "var(--sg-grey)", fontWeight: 700, background: "#0d0d0d" }}>{r}</td>
                      {Array.from({ length: colCount }, (_, cIdx) => {
                        const ref = `${colIndexToLetter(cIdx)}${r}`;
                        const isSelected = selectedRef === ref;
                        const cellEv = evaluated[ref];
                        const displayVal = isSelected ? cells[ref]?.raw ?? "" : cellEv?.display ?? "";

                        return (
                          <td
                            key={ref}
                            style={{
                              padding: 0,
                              border: isSelected ? "2px solid var(--sg-gold)" : "1px solid var(--sg-border)",
                              background: isSelected ? "rgba(201,162,39,0.08)" : undefined,
                            }}
                          >
                            <input
                              type="text"
                              aria-label={`Cell ${ref}`}
                              readOnly={!canWrite}
                              value={displayVal}
                              onFocus={() => selectCell(ref)}
                              onChange={(e) => {
                                setFormulaInput(e.target.value);
                                applyCellValue(ref, e.target.value);
                              }}
                              style={{
                                width: "100%",
                                border: 0,
                                background: "transparent",
                                color: cellEv?.error ? "#f87171" : "var(--sg-white)",
                                padding: "0.4rem 0.5rem",
                                fontSize: "0.82rem",
                                fontFamily: cells[ref]?.raw?.startsWith("=") ? "var(--sg-font-mono)" : "inherit",
                                outline: "none",
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Worksheet Tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            {sheets.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sg-btn ${s.id === activeSheetId ? "sg-btn-primary" : "sg-btn-ghost"}`}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                onClick={() => {
                  if (s.id === activeSheetId) return;
                  if (
                    hasUnsavedChanges &&
                    !window.confirm("You have unsaved changes on the current sheet tab. Switch tabs and discard unsaved edits?")
                  ) {
                    return;
                  }
                  setActiveSheetId(s.id);
                  let parsed: CellMap = {};
                  try {
                    const obj = JSON.parse(s.cells_json || "{}");
                    parsed = typeof obj === "object" && obj !== null ? (obj as CellMap) : {};
                  } catch {
                    parsed = {};
                  }
                  setCells(parsed);
                  setUndoStack([]);
                  setRedoStack([]);
                  setHasUnsavedChanges(false);
                  setExtraRows(0);
                  setExtraCols(0);
                  setSelectedRef("A1");
                  setFormulaInput(parsed["A1"]?.raw || "");
                }}
              >
                {s.name}
              </button>
            ))}
            {canWrite && activeId && (
              <>
                <button type="button" className="sg-btn sg-btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }} onClick={addSheetTab}>
                  <Plus size={13} /> Add Sheet
                </button>
                <button
                  type="button"
                  className="sg-btn sg-btn-ghost"
                  style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                  disabled={colCount >= WORKBOOK_LIMITS.MAX_COLS}
                  onClick={() => setExtraCols((c) => Math.min(c + 1, WORKBOOK_LIMITS.MAX_COLS))}
                >
                  + Column
                </button>
                <button
                  type="button"
                  className="sg-btn sg-btn-ghost"
                  style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                  disabled={rowCount >= WORKBOOK_LIMITS.MAX_ROWS}
                  onClick={() => setExtraRows((r) => Math.min(r + 10, WORKBOOK_LIMITS.MAX_ROWS))}
                >
                  + 10 Rows
                </button>
              </>
            )}
          </div>

          {/* SHEETS Copilot */}
          {canUseAi && (
            <div className="sg-card">
              <div className="sg-eyebrow" style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
                <Sparkles size={13} /> SMART GRID SHEETS Copilot
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="sg-input"
                  aria-label="SHEETS Copilot prompt"
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  placeholder="Ask Copilot to explain a formula, suggest cleaning, or summarize this sheet..."
                />
                <button type="button" className="sg-btn sg-btn-outline" disabled={copilotLoading} onClick={askCopilot}>
                  {copilotLoading ? "Running..." : "Ask Copilot"}
                </button>
              </div>
              {copilotReply && (
                <div style={{ marginTop: "0.65rem", padding: "0.65rem", borderRadius: 6, background: "#141414", fontSize: "0.84rem", whiteSpace: "pre-wrap" }}>
                  {copilotReply}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
