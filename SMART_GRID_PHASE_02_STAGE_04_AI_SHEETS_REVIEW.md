# SMART GRID — PHASE 02, STAGE 04: SMART GRID AI & SMART GRID SHEETS DEEP REVIEW

**Project:** SMART GRID  
**Stage:** Phase 02, Stage 4 — Independent Quality Review  
**Scope:** Permission-aware AI RAG/invocation, truthful provider status, AI safety/quotas, spreadsheet formula engine, CSV/XLSX/JSON import/export, Copilot, version history, and grid UX  
**Verification Date:** 2026-11-13  

---

## 1. Executive Assessment

**SMART GRID AI** and **SMART GRID SHEETS** are genuine functional subsystems—not static mocks. SMART GRID AI performs permission- and tenant-scoped SQLite context retrieval, preserves untrusted-data framing to resist prompt injection, tracks monthly subscription quotas, and returns an honest HTTP `503 AI_PROVIDER_UNAVAILABLE` when no `GEMINI_API_KEY` or `OPENAI_API_KEY` is configured rather than fabricating fake completions. SMART GRID SHEETS implements a working 21-function recursive-descent formula evaluator, multi-sheet workbooks, version snapshots/restoration, data cleaning, find/replace, chart visualization, and CWE-1236-safe CSV/XLSX/JSON export.

Empirical inspection nevertheless identified significant quality findings: high-severity `xlsx` dependency exposure on file imports/exports, eager evaluation of `=IF()` branches causing avoidable `#DIV/0!` errors, silent 60-row / 10-column UI grid limits on file imports, Gemini API key placement in the URL query string, and missing `alerts` city/division scoping in AI context retrieval.

---

## 2. SMART GRID AI Architecture & Quality Review

### Verified Strengths
- **Truthful Unconfigured Behavior:** `getAiProviderStatus()` and `invokeConfiguredAiProvider()` (`src/lib/ai/provider.ts`) cleanly report `{ configured: false }` and return `503 AI_PROVIDER_UNAVAILABLE` in `/api/v1/ai/chat` (verified both in unit tests and live smoke test). Client components (`AiWorkspaceClient.tsx`, `FloatingAiAssistant.tsx`) display clear guidance and preserve user prompt text on error.
- **Tenant Isolation in Context Retrieval:** `retrievePermittedContext()` strictly filters `datasets`, `observations`, and `alerts` by `organization_id = ?`, verified in `tests/securityAndTenant.test.ts` (`ds_toronto_flood` isolated to `org_partner_metro`, invisible to `org_demo_global`).
- **Prompt Injection Defense & Citation Discipline:** System instruction separates retrieved tenant data as untrusted JSON/text context and returns explicit `{ id, title, dataStatus }` citation badges rendered alongside assistant replies.
- **Billing Integrity:** `usage_records` (`AI_REQUEST`) is recorded only after successful completion—unconfigured `503` responses never charge tenant quota.

### Confirmed AI Findings
| Finding ID | Severity | Location | Issue Description | Recommendation |
|---|---|---|---|---|
| `STAGE4-P2-05a` | **P2 (Medium)** | `src/lib/ai/provider.ts:202` | Gemini request appends `?key=${encodeURIComponent(apiKey)}` to the URL instead of using the `x-goog-api-key` header. | Send Gemini key exclusively via `x-goog-api-key` HTTP header. |
| `STAGE4-P2-05b` | **P2 (Medium)** | `src/app/api/v1/ai/chat/route.ts:99-188` | (1) Saves `ai_sessions` + user `ai_messages` BEFORE provider invocation, creating orphaned unanswered messages on `503`. (2) Non-transactional `COUNT(*)` quota check vs insert allows concurrent requests near limit to overshoot `ai_monthly_quota`. | Persist conversation turns atomically after completion (or track failure status) and reserve quota in a SQLite transaction. |
| `STAGE4-P2-05c` | **P2 (Medium)** | `src/lib/ai/provider.ts:137-144` | `retrievePermittedContext()` filters `datasets` and `observations` by optional `cityId`/`divisionCode` selectors, but the `alerts` query omits `city_id` / `division_code` filters—returning organization alerts from unrelated cities/divisions into the scoped prompt context. | Apply matching optional `city_id` / `division_code` SQL filters to the `alerts` retrieval query. |

---

## 3. SMART GRID SHEETS Architecture & Formula Engine Review

### Verified Strengths
- **Safe Formula Evaluation (`src/lib/sheets/formulaEngine.ts`):** Tokenizer + recursive-descent parser executes without `eval()`. Handles operator precedence, scientific notation (`1e3`), power (`^`), `Infinity` / `#NUM!` rejection, circular dependency detection (`#CIRC!`), zero-division (`#DIV/0!`), unknown identifier handling (`#NAME?`), and 10,000-cell range cap (`#LIMIT!`). All 8 unit tests in `formulaEngine.test.ts` + 3 export/engine tests in `sheetsExport.test.ts` pass cleanly.
- **Export Hardening (`src/lib/sheets/exportHelpers.ts` & `export/route.ts`):** Neutralizes CWE-1236 formula injection across leading whitespace, tabs, newlines, `=`, `+`, `-`, `@` on CSV exports, deduplicates/truncates XLSX worksheet tab names safely within OOXML 31-character rules (verified via live smoke test), limits export scans to `5000x100`, and blocks archived workbooks (`is_archived = 0`).
- **Real Versioning & Copilot Integration:** Atomic transaction snapshots in `workbooks/[id]/route.ts` support saving named versions and restoring previous multi-sheet states, plus integrated `SHEETS_COPILOT` chat context.

### Confirmed SHEETS Findings
| Finding ID | Severity | Location | Issue Description | Recommendation |
|---|---|---|---|---|
| `STAGE4-P1-01` | **P1 (High)** | `SheetsWorkspaceClient.tsx:4,294`, `export/route.ts:1` | Imports npm `xlsx` (`0.18.5` heritage) carrying **High-severity Prototype Pollution & ReDoS (`fixAvailable: false`)**, inflating `/app/sheets` bundle to **`224 kB` First Load JS** and parsing untrusted uploaded workbooks client-side. | Replace `xlsx` with a maintained library (e.g., `exceljs`) or isolate CSV/XLSX parsing behind bounded worker validation. |
| `STAGE4-P3-02b` | **P3 (Low)** | `src/lib/sheets/formulaEngine.ts:473-476` | `callFunction("IF", args)` receives pre-evaluated arguments, so **both true and false branches always execute** (e.g., `=IF(B2=0, 0, A2/B2)` erroneously evaluates `A2/B2` and fails with `#DIV/0!`). Also `=IF("FALSE", ...)` is truthy, and cross-sheet references (`Sheet2!A1`) fail with `#ERROR!`. | Add lazy/short-circuit AST evaluation for `IF` (and document single-sheet formula scope clearly or support `Sheet!Ref` syntax). |
| `STAGE4-P3-02c` | **P3 (Low)** | `SheetsWorkspaceClient.tsx:133,279,297,596,612,666` | (1) CSV/XLSX/JSON upload silently truncates imports after **60 rows** without notifying the user. (2) UI grid renders fixed **`DEFAULT_COLS = 10` (`A`–`J`)** columns and caps rows at **80**, making imported columns `K+` invisible in the editor despite existing in stored JSON/export. (3) Clicking worksheet tabs or switching workbooks discards unsaved in-memory edits with no dirty-state confirmation. | Dynamically compute column count alongside `rowCount` (or paginate large sheets), display an explicit truncation warning if row cap applies, and warn before discarding unsaved edits. |
| `STAGE4-P3-02a` | **P3 (Low)** | `workbooks/route.ts:20`, `workbooks/[id]/route.ts:13` | Workbook APIs accept unbounded `cells` map size. | Add upper bounds (`<= 25,000` cells) in Zod validation schemas. |

---

## 4. Verdict

Both SMART GRID AI and SMART GRID SHEETS deliver real, testable, non-mocked functionality with strict tenant isolation and truthful degradation. Resolving the `xlsx` library CVE (`STAGE4-P1-01`), Gemini API header placement, AI quota atomicity, and `=IF()` lazy branching will elevate both subsystems from solid v1 execution to hardened enterprise readiness.
