# SMART GRID — PHASE 02 BUG REGISTER
**Document Version:** 2.0.0  
**Audit Phase:** Phase 02 Independent Deep Audit, Bug Hunting & Enterprise Quality Optimization  
**Date:** 2026-11-12  
**Target Repository:** `F:\SMART_GRID`  
**Standard:** Enterprise Security, Tenant Isolation, RFC/CWE Compliance, Truthful Data Architecture  

---

## 1. Executive Summary & Defect Overview

During Phase 02 deep inspection across all 49 database tables, 19 API route handlers, 22 public pages, 28 enterprise routes, the SMART GRID SHEETS formula engine, SMART GRID AI orchestrator, and security/session layers, 11 genuine defects were discovered, verified, and classified according to standard severity guidelines:

- **P0 (Critical Security Vulnerability):** 2 defects (Default credential exposure in production & predictable signing key fallback)
- **P1 (High Security / Cross-Tenant IDOR / Resource Exhaustion):** 5 defects (Cross-tenant foreign key IDOR, CSRF & Content-Type bypass, CSV Formula Injection CWE-1236, Formula Range DoS, AI Quota bypass & failed request billing)
- **P2 (Medium / API Completeness & Reliability):** 3 defects (Missing AI session DELETE & upstream timeout, Unbounded rate limiter memory leak, Unchecked JSON.parse on corrupted sheet cells)
- **P3 (Low / UX & Search Robustness):** 1 defect (SQL LIKE wildcard unescaped search queries)

---

## 2. Comprehensive Defect Register

### BUG-01 (P0): Production Demo Credentials Auto-Seeded & Exposed in Client Bundle
- **Subsystem:** Authentication / Database Seeding / Client Bundles
- **Files & Lines:** `src/lib/db/seed.ts:98–117`, `src/app/sign-in/page.tsx:8–13, 134–140`
- **Severity:** P0 — Critical
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)
- **Root Cause:**
  1. `src/lib/db/seed.ts` checked `process.env.SMART_GRID_DEMO_MODE !== "false"`, which automatically created 4 demo users with hardcoded passwords even in `NODE_ENV === "production"`.
  2. `src/app/sign-in/page.tsx` was a `"use client"` component containing an array of plaintext evaluation passwords directly rendered in the HTML/JS bundle for all visitors.
- **Risk:** An attacker discovering an active production instance could use the credentials embedded in the client JavaScript bundle to obtain `ORG_OWNER` privileges over the Global Observatory.
- **Planned Fix:**
  1. In `src/lib/db/seed.ts`, restrict demo account creation strictly to non-production environments unless `process.env.SMART_GRID_DEMO_MODE === "true"` is explicitly passed. Provide production admin bootstrapping through `SMART_GRID_BOOTSTRAP_ADMIN_EMAIL` and `SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD`.
  2. In `src/app/sign-in/page.tsx`, remove hardcoded passwords from the client component. Move evaluation account quick-select to an optional server-gated flag and never ship plaintext passwords in the client bundle.
- **Regression Test:** `tests/apiAndRbacIntegration.test.ts` (verifies `NODE_ENV=production` does not seed default demo accounts without explicit opt-in).

---

### BUG-02 (P0): Predictable Session Secret Fallback in Session Token Signing
- **Subsystem:** Authentication / Cryptography
- **Files & Lines:** `src/lib/auth/session.ts:32–37`
- **Severity:** P0 — Critical
- **CWE:** CWE-321 (Use of Hard-coded Cryptographic Key), CWE-330 (Use of Insufficiently Random Values)
- **Root Cause:** If `SMART_GRID_SESSION_SECRET` was omitted from environment configuration, `session.ts` fell back to a static string: `"smart-grid-dev-ephemeral-signing-key-change-in-prod"`.
- **Risk:** In misconfigured deployments, any attacker knowing the public repository source could sign arbitrary session tokens with `userId` and `organizationId` and bypass authentication completely.
- **Planned Fix:** If `SMART_GRID_SESSION_SECRET` is unset, generate an unpredictable cryptographically secure random 32-byte hexadecimal key at process startup using `crypto.randomBytes(32).toString("hex")` and log a high-priority warning.
- **Regression Test:** `tests/securityAndTenant.test.ts` (verifies session tokens signed with hardcoded key are rejected).

---

### BUG-03 (P1): Cross-Tenant IDOR & Unhandled SQLite Foreign Key Exceptions on Entity Mutations
- **Subsystem:** Tenant Isolation / API Validation / Operations & Datasets
- **Files & Lines:**
  - `src/app/api/v1/datasets/route.ts:120–160`
  - `src/app/api/v1/integrations/route.ts:80–120`
  - `src/app/api/v1/workbooks/route.ts:35–70`
  - `src/app/api/v1/workbooks/[id]/route.ts:90–120`
  - `src/app/api/v1/operations/route.ts:195–340`
- **Severity:** P1 — High
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key / IDOR), CWE-20 (Improper Input Validation)
- **Root Cause:** Routes accepted user-supplied `cityId`, `divisionCode`, or `assetId` (in work orders) and executed `INSERT` without checking:
  1. Does `cityId` belong to the caller's `organizationId` or is it a public city (`is_public = 1`)?
  2. Is `divisionCode` an authentic 2-digit code among the 24 divisions?
  3. Does `assetId` belong to the caller's `organizationId`?
  Passing an invalid or foreign identifier either silently bound resources to an unauthorized tenant's city or triggered an unhandled SQLite `SQLITE_CONSTRAINT_FOREIGNKEY` (HTTP 500).
- **Risk:** Cross-tenant resource pollution and unhandled 500 error cascades.
- **Planned Fix:** Implement shared tenant validation helpers:
  - `assertCityPermitted(db, cityId, orgId)`
  - `assertValidDivision(divisionCode)`
  - `assertAssetBelongsToOrg(db, assetId, orgId)`
  Return clean 400/404 responses before inserting.
- **Regression Test:** `tests/apiAndRbacIntegration.test.ts` (cross-tenant city/asset attachment tests).

---

### BUG-04 (P1): CSRF & Content-Type Strictness on Mutating API Endpoints
- **Subsystem:** API Security / Web Security
- **Files & Lines:** `src/app/api/v1/*` (all POST, PATCH, DELETE handlers)
- **Severity:** P1 — High
- **CWE:** CWE-352 (Cross-Site Request Forgery), CWE-436 (Interpretation Conflict)
- **Root Cause:** Mutating route handlers used `req.json()` without checking `Content-Type: application/json` or validating the `Origin` / `Host` request headers. Cross-origin HTML forms using `navigator.sendBeacon` or standard text form posts could submit requests.
- **Risk:** CSRF exploitation from malicious web pages visiting clients with active session cookies.
- **Planned Fix:** Add a shared `requireMutationSecurity(req)` guard in `src/lib/auth/session.ts` to verify matching `Origin`/`Host` and require `application/json` content-type on all mutating routes.
- **Regression Test:** `tests/securityAndTenant.test.ts` (verifies cross-origin and invalid content-type mutation attempts are rejected with 403/415).

---

### BUG-05 (P1): CSV Formula Injection (CWE-1236) & Export Grid Size Denial of Service
- **Subsystem:** SMART GRID SHEETS / Export Engine
- **Files & Lines:** `src/app/api/v1/workbooks/[id]/export/route.ts:120–129`
- **Severity:** P1 — High
- **CWE:** CWE-1236 (Improper Neutralization of Formula Elements in a CSV File), CWE-400 (Uncontrolled Resource Consumption)
- **Root Cause:**
  1. Cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` were exported to CSV without single-quote escaping. When opened in spreadsheet software, formulas execute automatically.
  2. `cellsToMatrix` iterated `0..maxR` and `0..maxC` without bounds. A malicious cell at `Z999999` caused the server to allocate billions of empty matrix slots, triggering an Out-Of-Memory crash.
- **Risk:** Client-side remote code execution / data exfiltration on CSV download, and server denial of service via memory exhaustion.
- **Planned Fix:**
  1. Neutralize formula characters in CSV output by prepending `'` to dangerous leading characters.
  2. Enforce strict grid limits in `cellsToMatrix`: maximum 5,000 rows and 100 columns, ignoring indices beyond the threshold.
- **Regression Test:** `tests/sheetsExport.test.ts` (verifies formula prefix neutralization and grid limit enforcement).

---

### BUG-06 (P1): Formula Engine Range Expansion DoS & Mathematical Edge Cases
- **Subsystem:** SMART GRID SHEETS / Formula Engine
- **Files & Lines:** `src/lib/sheets/formulaEngine.ts:91–519`
- **Severity:** P1 — High
- **CWE:** CWE-400 (Resource Exhaustion), CWE-682 (Incorrect Calculation)
- **Root Cause:**
  1. Large ranges like `=SUM(A1:Z100000)` expanded without limit, blocking the Node.js event loop.
  2. Exponentiation `=10^1000` resulted in `Infinity`, which was displayed as `Infinity` instead of standard spreadsheet `#NUM!`.
  3. Numbers in scientific notation (e.g. `1e5`, `2.4e-2`) were broken into separate numeric and identifier tokens.
  4. `VLOOKUP` performed case-sensitive string matching and lacked bounds protection.
- **Planned Fix:**
  1. Cap range expansion at 10,000 cells per range; return `#LIMIT!` if exceeded.
  2. Detect `!Number.isFinite(result)` and return `#NUM!`.
  3. Update tokenizer to support scientific notation in numbers.
  4. Case-insensitive key comparison in `VLOOKUP`.
- **Regression Test:** `tests/formulaEngine.test.ts` (comprehensive range limit and edge-case testing).

---

### BUG-07 (P1): AI Monthly Quota Not Enforced & Failed Requests Charged to Tenant
- **Subsystem:** SMART GRID AI / Billing & Usage Governance
- **Files & Lines:** `src/app/api/v1/ai/chat/route.ts:115–145`
- **Severity:** P1 — High
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling), CWE-840 (Business Logic Errors)
- **Root Cause:**
  1. `src/app/api/v1/ai/chat/route.ts` recorded `AI_REQUEST` in `usage_records` *before* verifying `aiResult.ok`. If the external provider failed (HTTP 503/502), the tenant's usage was still decremented.
  2. The endpoint never checked the organization's monthly quota (`subscriptions.ai_monthly_quota`). Tenants could consume unlimited AI requests.
- **Risk:** Unfair usage charges on outages, and financial loss from uncontrolled LLM consumption.
- **Planned Fix:**
  1. Check current month's usage against `ai_monthly_quota` before execution; return HTTP 429 `AI_QUOTA_EXCEEDED` if exceeded.
  2. Only insert into `usage_records` after `aiResult.ok === true`.
- **Regression Test:** `tests/apiAndRbacIntegration.test.ts` (verifies quota limit enforcement and failed request billing protection).

---

### BUG-08 (P2): Missing AI Session DELETE Endpoint & Upstream HTTP Timeout
- **Subsystem:** SMART GRID AI / API Completeness & Network Resilience
- **Files & Lines:** `src/app/api/v1/ai/sessions/route.ts:1–34`, `src/lib/ai/provider.ts:203, 239`
- **Severity:** P2 — Medium
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-1059 (Incomplete Documentation/Implementation)
- **Root Cause:**
  1. `ai/sessions/route.ts` lacked a `DELETE` handler to prune chat history, leaving orphaned sessions.
  2. Upstream fetch calls in `provider.ts` did not specify an `AbortSignal.timeout(15000)`, risking permanently hung connections if the AI provider stalls.
- **Planned Fix:**
  1. Add `DELETE` handler in `src/app/api/v1/ai/sessions/route.ts` with tenant/user ownership verification.
  2. Add `signal: AbortSignal.timeout(15000)` to all provider fetch requests.
- **Regression Test:** `tests/apiAndRbacIntegration.test.ts` (AI session deletion test).

---

### BUG-09 (P2): Unbounded In-Memory Map in Rate Limiter Leaks Memory Under High Traffic
- **Subsystem:** Rate Limiting / Memory Management
- **Files & Lines:** `src/lib/auth/rateLimit.ts:6–25`
- **Severity:** P2 — Medium
- **CWE:** CWE-400 (Uncontrolled Resource Consumption - Memory Leak)
- **Root Cause:** `buckets` Map grew with every new IP/key without periodic eviction or maximum size threshold.
- **Risk:** Memory exhaustion under large-scale IP scans or continuous usage.
- **Planned Fix:** Implement automatic eviction of expired entries and cap total buckets at 10,000 entries.
- **Regression Test:** `tests/securityAndTenant.test.ts` (verifies map pruning and bound enforcement).

---

### BUG-10 (P2): Unchecked JSON.parse on Corrupted Cells and Snapshots Triggers 500 Errors
- **Subsystem:** SMART GRID SHEETS / Error Handling & Resilience
- **Files & Lines:**
  - `src/app/api/v1/workbooks/[id]/route.ts:50, 100`
  - `src/app/api/v1/workbooks/[id]/export/route.ts:40, 120`
  - `src/components/enterprise/SheetsWorkspaceClient.tsx:102`
- **Severity:** P2 — Medium
- **CWE:** CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **Root Cause:** Direct `JSON.parse(cells_json)` threw unhandled exceptions if the database field was malformed or corrupted.
- **Risk:** Workbook rendering and export failure (HTTP 500).
- **Planned Fix:** Wrap with safe parsing utility `safeJsonParse<T>(raw, fallback)` with graceful defaults.
- **Regression Test:** `tests/sheetsExport.test.ts` (verifies graceful recovery from corrupted cell JSON).

---

### BUG-11 (P3): SQL LIKE Wildcard Injection in Search Query
- **Subsystem:** Search API
- **Files & Lines:** `src/app/api/v1/search/route.ts:18`
- **Severity:** P3 — Low
- **CWE:** CWE-89 (Improper Neutralization of Special Elements used in an SQL Command)
- **Root Cause:** User input `q` was wrapped in `%${q}%` without escaping `%` and `_`. Searching for `%` returned all rows across all tables.
- **Risk:** Information disclosure of unintended search results and unnecessary database load.
- **Planned Fix:** Escape `%` and `_` characters in user query or sanitize query input before constructing LIKE parameters.
- **Regression Test:** `tests/apiAndRbacIntegration.test.ts` (verifies search with `%` does not dump all records).

---

## 3. Implementation Plan & Priority Order
1. **P0 Fixes:** BUG-01 (Production demo credentials & client bundle exposure), BUG-02 (Session signing key fallback).
2. **P1 Fixes:** BUG-03 (Cross-tenant IDOR), BUG-04 (CSRF & Content-Type security), BUG-05 (CSV Formula Injection & Grid DoS), BUG-06 (Formula Engine DoS & Math Edge Cases), BUG-07 (AI Quota & Billing).
3. **P2 Fixes:** BUG-08 (AI Session DELETE & Upstream Timeout), BUG-09 (Rate Limiter Memory Leak), BUG-10 (Safe JSON Parsing).
4. **P3 Fixes:** BUG-11 (Search LIKE Wildcard Escaping).
5. **Testing & Verification:** Run TypeScript check (`npm.cmd run typecheck`), execute all test suites (`npm.cmd test`), build production bundle (`npm.cmd run build`), and verify live with `next start`.
