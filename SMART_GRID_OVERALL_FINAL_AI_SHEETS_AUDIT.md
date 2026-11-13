# SMART GRID — OVERALL FINAL AI & SHEETS AUDIT

**Audit Date:** `2026-11-13`  
**Project:** SMART GRID — Global Smart City Intelligence & Management Ecosystem  
**Audit Scope:** SMART GRID AI Intelligence Engine (Section 9) & SMART GRID SHEETS Engine (Section 10)  
**Repository Root:** `F:\SMART_GRID`

---

## PART I — SMART GRID AI INTELLIGENCE SYSTEM AUDIT (SECTION 9)

### 1. Classification & Honest Implementation State
- **Internal Orchestration, Provenance, Tenant Isolation, Atomic Quota & Error Handling:** `VERIFIED` / `TEST-VERIFIED`
- **Live Upstream Provider Inference (`Gemini` / `OpenAI`):** `ENVIRONMENT-DEPENDENT` / `NOT VERIFIED` (`GEMINI_API_KEY` and `OPENAI_API_KEY` are absent in the local environment; external model responses remain awaiting production credentials).

### 2. AI Architecture & Control Verification

| Control | Mechanism Verified | Evidence Label | Finding / Note |
| --- | --- | --- | --- |
| **Provider Integration (`src/lib/ai/provider.ts`)** | Supports Gemini REST (`x-goog-api-key` header — NOT URL query parameter) and OpenAI-compatible Bearer (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`). Zero API keys bundled in client `.next/static`. | `VERIFIED` / `CODE-VERIFIED` | Live HTTP calls to external endpoints require production keys (`NOT VERIFIED` externally). |
| **Truthful Unavailable Behavior** | `POST /api/v1/ai/chat` without API keys returns **HTTP `503 AI_PROVIDER_UNAVAILABLE`** (`task-2678`) plus `details.citations` scoped strictly to Tenant A. Never fabricates AI completions. | `VERIFIED` | Matches master truthfulness policy cleanly. |
| **Tenant / City / Division Isolation** | `retrievePermittedContext()` queries strictly filter by `organization_id`, `cityId`, and `divisionCode`. `ds_toronto_flood` (`org_partner_metro`) isolated from `org_demo_global`; city/division alerts isolated (`stage5Hardening.test.ts`, `securityAndTenant.test.ts`). | `TEST-VERIFIED` & `VERIFIED` | Untrusted DB data injected as explicit delimited context (`untrustedDataContext`) with citation tags (`SIMULATED`/`HISTORICAL`). |
| **Atomic Quota Reservation & Release (`src/lib/ai/quota.ts`)** | `reserveAiQuotaSlot()` atomically reserves against `subscriptions.ai_monthly_quota` in `ai_quota_reservations`; concurrent duplicate slot rejected; upstream failure releases slot with `0` `usage_records` inserted; success commits turn + usage atomically. | `TEST-VERIFIED` | **Minor gap `OFA-P2-06`:** In `ai/chat/route.ts`, `reserveAiQuotaSlot()` creates + releases a reservation row even when `!providerStatus.configured`, and `/api/v1/ai/chat` has no separate per-minute `checkRateLimit` burst throttle beyond monthly org quota. |
| **Session & Message Storage (`ai/sessions/route.ts`)** | Tenant-scoped `GET`/`POST` session & message retrieval backed by `ai_sessions` / `ai_messages`. | `CODE-VERIFIED` / `VERIFIED` | Safe error sanitization verified (`logger.ts`). |

---

## PART II — SMART GRID SHEETS AUDIT (SECTION 10)

### 1. Classification
- **Formula Engine, Workbook Limits, Import/Export & Formula-Injection Security:** `VERIFIED` / `TEST-VERIFIED`
- **Multi-Tab Interactive UI Ergonomics (Undo/Redo, Save, Range Selection in Browser):** `CODE-VERIFIED` (`src/components/enterprise/SheetsWorkspaceClient.tsx`), automated headless Playwright browser editing tests **absent (`NOT VERIFIED`)**.

### 2. Formula Engine Verification (`src/lib/sheets/formulaEngine.ts`)

Tested in `tests/formulaEngine.test.ts` (8 tests) and `tests/sheetsExport.test.ts` (5 tests) — **`13/13` SHEETS unit/integration tests pass** (`npm test` exit `0`):

| Capability | Verified Functions / Rules | Edge & Safety Verification | Label |
| --- | --- | --- | --- |
| **Supported Formula Catalog** | `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `ROUND`, `IF`, `AND`, `OR`, `CONCAT`, `LEFT`, `MID`, `RIGHT`, `VLOOKUP` (case-insensitive key match), `TODAY`, `DATE`, arithmetic `+ - * / ^`, comparisons, scientific notation (`1e3`, `2.5e2`) | Unsupported function returns `#NAME?`. Do **NOT** assume Excel functions outside this explicit set exist. | `TEST-VERIFIED` |
| **Error & Overflow Semantics** | `=10/0` -> `#DIV/0!`; cycle `B1<->C1` -> `#CIRC!`; overflow `=10^1000` / `=1e999` / `=1e308*1e308` -> `#NUM!` | Prevents JS `Infinity` corruption. | `TEST-VERIFIED` |
| **Lazy Conditional Branching** | `=IF(B1=0, "SAFE_ZERO", 100/B1)` short-circuits untaken branch cleanly without throwing `#DIV/0!` | Verified explicitly in `sheetsExport.test.ts`. | `TEST-VERIFIED` |
| **DoS Range Expansion Cap** | `=SUM(A1:Z1000)` (`26,000` cells) aborted cleanly with `#LIMIT!` | Prevents server/browser OOM freezes. | `TEST-VERIFIED` |

### 3. Workbook Limits, Server Enforcement & Export Security (`src/lib/sheets/exportHelpers.ts` & `/api/v1/workbooks/**`)

| Control | Server-Enforced Ceiling / Rule | Live / Test Verification Result | Label |
| --- | --- | --- | --- |
| **`MAX_SHEETS = 25`** | Enforced server-side when adding/updating sheets (`[id]/route.ts`) | `live_smoke.mjs` verified `25` tabs allowed, **26th rejected with HTTP `400 WORKBOOK_SHEET_LIMIT`**. Note: initial `POST /api/v1/workbooks` creates a 1-sheet workbook and validates metadata; sheet growth happens via `PATCH`. | `VERIFIED` |
| **`MAX_CELLS = 10_000` & `MAX_COLS = 52`** | Defined in `WORKBOOK_LIMITS` (`exportHelpers.ts`), checked in `workbooks/[id]/route.ts` | Verified in `stage5Hardening.test.ts` and `sheetsExport.test.ts`. | `TEST-VERIFIED` / `CODE-VERIFIED` |
| **Export Pipeline (`export/route.ts`)** | `csv` (default, RFC 4180 + `sanitizeForCsv()`), `xlsx` (`write-excel-file/node` + 31-char sanitized unique tab names), `json` (evaluated values) | Legacy vulnerable `xlsx` package completely removed. Live smoke proved `'@SUM(1,2)` and `'-cmd...` prefix neutralization (`CWE-1236`) and valid OOXML XLSX roundtrip via `read-excel-file`. | `VERIFIED` |
| **Import Security (`exportHelpers.ts`)** | ReDoS-free stateful RFC 4180 CSV parser reporting `truncatedRows`/`truncatedCols`; rejects OLE2 legacy binary `.xls` (`D0 CF 11 E0`); strips `__proto__`, `constructor`, `prototype` keys in JSON import | Verified in `sheetsExport.test.ts`. **Note (`OFA-P3-06`):** Separate Data Catalog inline CSV textarea in `DataCatalogClient.tsx` still uses `line.split(",")` rather than `parseCsvToMatrix()`. | `TEST-VERIFIED` |
| **Tenant Access Isolation** | All workbook & export queries filter `organization_id = ?` | Verified live (`run_security_probe.mjs`): Tenant B got `404` on GET, PATCH, DELETE, and CSV export of Tenant A workbook `wb_bca92437-362`. | `VERIFIED` |
| **Known Limitations** | No CRDT real-time multi-user cell locking (`last-writer-wins` on `PATCH` save); unsupported Excel macros/pivot tables/`INDEX-MATCH` return `#NAME?`; `DataCatalogClient` naive CSV line-split (`OFA-P3-06`). | Documented for operator transparency; client dirty-tab navigation guard is `CODE-VERIFIED` in `SheetsWorkspaceClient.tsx` (`NOT VERIFIED` in headless browser test). | `CODE-VERIFIED` |
