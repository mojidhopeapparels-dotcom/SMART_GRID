# SMART GRID — PHASE 02 FIX CHANGELOG
**Document Version:** 2.0.0  
**Phase:** Phase 02 Independent Deep Audit, Bug Hunting & Enterprise Quality Optimization  
**Date:** 2026-11-12  
**Target Repository:** `F:\SMART_GRID`  

---

## 1. Summary of Changes

The following systematic fixes were implemented across authentication, security, tenant boundaries, API routing, spreadsheet processing, and AI governance:

### Security & Authentication
- **`src/lib/db/seed.ts`**:
  - Gated evaluation demo user creation strictly to non-production environments unless `SMART_GRID_DEMO_MODE === "true"`.
  - Added support for production admin account initialization via `SMART_GRID_BOOTSTRAP_ADMIN_EMAIL` and `SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD`.
  - Wrapped sample evaluation operational entities (work orders, projects, incidents, workbooks) so they do not create foreign-key violations when demo users are not seeded.
- **`src/app/sign-in/page.tsx` & `src/components/auth/SignInForm.tsx`**:
  - Refactored `SignInPage` to a Server Component that checks server evaluation flags.
  - Extracted `SignInForm` client component.
  - Removed plaintext passwords from the public client JavaScript bundle.
- **`src/lib/auth/session.ts`**:
  - Replaced hardcoded fallback secret with a cryptographically secure random 256-bit runtime key (`crypto.randomBytes(32).toString("hex")`) with operator console warnings.
  - Exported `assertMutationSecurity(req)` to enforce same-origin verification and strict Content-Type checking.
  - Exported tenant boundary validation helpers: `assertPermittedCity`, `assertValidDivision`, `assertTenantAsset`.
- **`src/lib/auth/rateLimit.ts`**:
  - Added automatic periodic eviction of expired rate limit buckets.
  - Capped maximum active buckets at 10,000 entries with FIFO eviction.
  - Exported test helpers `_resetRateLimitsForTesting` and `_getRateLimitBucketCountForTesting`.

### API Routes & Tenant Boundaries
- **`src/app/api/v1/datasets/route.ts`**:
  - Added `assertMutationSecurity(req)`.
  - Added `assertPermittedCity` and `assertValidDivision` to prevent IDOR and unhandled FK constraint errors.
- **`src/app/api/v1/integrations/route.ts`**:
  - Added `assertMutationSecurity(req)`.
  - Added `assertPermittedCity` and `assertValidDivision`.
  - Removed duplicate `const db = getDb();` declaration.
- **`src/app/api/v1/workbooks/route.ts` & `src/app/api/v1/workbooks/[id]/route.ts`**:
  - Added `assertMutationSecurity(req)` across POST, PATCH, and DELETE handlers.
  - Added `assertPermittedCity` and `assertValidDivision` on workbook creation.
  - Wrapped snapshot creation and restoration with safe JSON parsing.
- **`src/app/api/v1/workbooks/[id]/export/route.ts`**:
  - Neutralized CSV formula injection (CWE-1236) by prepending `'` to leading `=+-@\t\r` characters.
  - Enforced grid limits of 5,000 rows and 100 columns in `cellsToMatrix`.
  - Handled corrupted `cells_json` gracefully via `safeParseCells`.
- **`src/app/api/v1/operations/route.ts`**:
  - Added `assertMutationSecurity(req)` across POST and PATCH handlers.
  - Added tenant boundary checks for `cityId`, `divisionCode`, and `assetId` (for work orders).
- **`src/app/api/v1/ai/chat/route.ts`**:
  - Added `assertMutationSecurity(req)`.
  - Added `assertPermittedCity` and `assertValidDivision`.
  - Enforced monthly AI request quota (`subscriptions.ai_monthly_quota`), returning HTTP 429 when exceeded.
  - Only record `AI_REQUEST` in `usage_records` when `aiResult.ok === true`.
- **`src/app/api/v1/ai/sessions/route.ts`**:
  - Added `DELETE` endpoint with tenant and user ownership verification and cascade deletion of messages.
- **`src/lib/ai/provider.ts`**:
  - Added `signal: AbortSignal.timeout(15000)` to Gemini and OpenAI fetch requests.
- **`src/app/api/v1/search/route.ts`**:
  - Added `escapeLike` helper to escape `%` and `_` with `ESCAPE '\'`.
- **`src/app/api/v1/auth/sign-in/route.ts`, `sign-up/route.ts`, `session/route.ts`, `mfa/route.ts`, `sign-out/route.ts`, `admin/route.ts`, `cities/route.ts`, `public/enquiries/route.ts`**:
  - Added `assertMutationSecurity(req)`.

### Spreadsheet Formula Engine
- **`src/lib/sheets/formulaEngine.ts`**:
  - Added scientific notation support in tokenizer (`1e3`, `2.5e-2`).
  - Added range cell expansion limit (maximum 10,000 cells per range, returning `#LIMIT!`).
  - Added `#NUM!` overflow error handling on `Infinity` or `NaN` calculations.
  - Updated `VLOOKUP` to perform case-insensitive key matching on string values.
- **`src/components/enterprise/SheetsWorkspaceClient.tsx`**:
  - Added safe JSON parsing when loading sheet cells.

---

## 2. Test Suite Expansion
- **`tests/formulaEngine.test.ts`**: Added tests for scientific notation, power operations, range expansion `#LIMIT!`, and case-insensitive `VLOOKUP`.
- **`tests/sheetsExport.test.ts`**: Added test for CWE-1236 CSV formula injection prefix neutralization.
- **`tests/securityAndTenant.test.ts`**: Added tests for rate limiter map capping/pruning and production seed isolation with bootstrap admin.
- **`tests/apiAndRbacIntegration.test.ts`**: Added new integration test suite covering `assertPermittedCity`, `assertTenantAsset`, `assertValidDivision`, AI monthly quota exhaustion, and search wildcard escaping.
