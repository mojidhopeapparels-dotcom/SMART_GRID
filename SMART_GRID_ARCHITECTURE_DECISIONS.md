# SMART GRID — ARCHITECTURE DECISIONS (ADR LOG)

**Project:** SMART GRID — Global Smart City Intelligence & Management Ecosystem
**Status Basis:** Observed implementation in `F:\SMART_GRID`

---

## ADR-001: Full-Stack Unified Next.js 15 App Router Architecture
- **Decision:** Implement both the Public Experience (`src/app/(public)/*`) and the Authenticated Enterprise Platform (`src/app/app/*` + `src/app/api/v1/*`) inside the existing Next.js `^15.5.29` / React `^19.3.1` App Router workspace without introducing unnecessary external microservices.
- **Rationale:** Preserves `package.json` runtime dependencies, shares domain models (`src/lib/domain/*`), auth/RBAC enforcement (`src/lib/auth/*`), and database queries across Server Components and Route Handlers.
- **Boundary Isolation:** Public layout/pages never query or render tenant-private tables (`workbooks`, `ai_sessions`, `audit_logs`, `api_keys`, `incidents`, `work_orders`, etc.). Enterprise pages reside under `/app/*` and rely on `src/app/app/layout.tsx` server session validation plus route-level permission guards.

## ADR-002: Embedded Relational Persistence via Node 26 `node:sqlite` (`DatabaseSync`)
- **Decision:** Use Node.js v26 built-in `node:sqlite` (`DatabaseSync`) configured via `next.config.ts` (`serverExternalPackages: ["node:sqlite"]`) and forward SQL migrations (`src/lib/db/migrations/001_initial.sql`) managed in `src/lib/db/index.ts`.
- **Rationale:** Requires zero native C++ addon builds on Windows and runs deterministically offline for both application runtime (`data/smart_grid.db`) and isolated in-memory tests (`SMART_GRID_DB_PATH=:memory:`).
- **Implementation Constraint:** `node:sqlite` returns null-prototype row objects; `normalizeRow` / `normalizeRows` converts rows to plain JS objects before passing across React Server → Client Component boundaries.
- **Upgrade Path:** SQL uses portable ANSI/SQLite constructs cleanly separable behind `src/lib/db/index.ts` for future PostgreSQL/PostGIS adoption.

## ADR-003: Truthful Data Integrity & Provenance Model (`DATA_STATUS_META`)
- **Decision:** Every dataset, KPI observation, sensor, GIS layer, event, alert, AI response, and integration run carries an explicit provenance status (`LIVE`, `HISTORICAL`, `SIMULATED`, `UNAVAILABLE`, `INTEGRATION_REQUIRED`, `STALE`, `ERROR`, `PARTIAL`, `DISABLED`) defined in `src/lib/domain/statuses.ts`.
- **Rationale:** Strictly prohibits presenting synthetic evaluation data or unconfigured integrations as real-time telemetry.

## ADR-004: Safe Non-Evaluating Formula Engine for SMART GRID SHEETS
- **Decision:** Implement a custom tokenizer, recursive-descent parser, and topological dependency evaluator in `src/lib/sheets/formulaEngine.ts` rather than `eval()` or `new Function()`.
- **Rationale:** Eliminates code injection vectors inside user-authored formulas, detects circular references (`#CIRC!`), division by zero (`#DIV/0!`), and unknown functions (`#NAME?`), and supports `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `IF`, `AND`, `OR`, `ROUND`, `CONCAT`, `LEFT`, `RIGHT`, `MID`, `TODAY`, `DATE`, and `VLOOKUP`. Export to `.xlsx` and `.csv` uses the installed `xlsx` library.

## ADR-005: Provider-Neutral Server-Side AI Abstraction (`src/lib/ai/provider.ts`)
- **Decision:** Route all AI requests through `/api/v1/ai/chat` -> `retrievePermittedContext` + `invokeConfiguredAiProvider`.
- **Rationale:**
  - Enforces `ai:use` RBAC check and tenant `organization_id` filtering before retrieving datasets, alerts, observations, or reports.
  - Wraps retrieved records inside `<UNTRUSTED_CITY_DATA>` delimiters to mitigate indirect prompt injection.
  - Returns explicit HTTP `503 AI_PROVIDER_UNAVAILABLE` when neither `GEMINI_API_KEY` nor `OPENAI_API_KEY` is present on the server; never returns simulated/faked AI completions.

## ADR-006: Locked Brand Visual System
- **Decision:** Centralize styling in `src/app/globals.css` strictly adhering to the locked palette: Black (`#080808`), Gold (`#C9A227`), White (`#FFFFFF`), Grey (`#737373`).
- **Rationale:** Guarantees high-contrast enterprise legibility and cohesive visual identity across public pages, 24 division workspaces, and data tools.
