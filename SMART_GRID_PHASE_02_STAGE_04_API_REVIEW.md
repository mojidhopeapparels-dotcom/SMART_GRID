# SMART GRID — PHASE 02, STAGE 04: API RELIABILITY, VALIDATION & CONTRACT REVIEW

**Project:** SMART GRID  
**Stage:** Phase 02, Stage 4 — Independent Quality Review  
**Scope:** All 19 `/api/v1/*` handlers — HTTP contracts, Zod validation, auth/RBAC, CSRF/Content-Type guards, error mapping, pagination, concurrency, and payload limits  
**Verification Date:** 2026-11-13  

---

## 1. Executive API Assessment

All **19 `/api/v1/` API route handlers** were audited at source level and tested through unit/integration suites and isolated live HTTP probes. Every route uses uniform response helpers (`apiSuccess`, `apiError`, `apiPaginated`), enforces Zod schema validation on JSON payloads with explicit `400` JSON/validation error handling, applies `assertMutationSecurity()` on state-changing requests, and verifies fine-grained RBAC permissions via `requireAuth(...)`.

Key reliability issues identified during Stage 4 include unbounded cell dictionary payloads on workbook APIs, non-transactional AI quota reservation under concurrent requests, orphaned AI session/message persistence on upstream `503` failures, and `isPublic: true` city publishing needing elevated permission gating.

**API Quality Rating:** **STRONG CORE (Uniform Envelopes & Guards Verified; 4 Reliability Hardening Items)**

---

## 2. Complete Inventory of All 19 API Route Handlers

| Endpoint | Methods Verified | Auth / RBAC Enforced | Mutation & Security Controls | Notable Observations |
|---|---|---|---|---|
| `/api/v1/health` | `GET` | Public | DB readiness + `divisionsLoaded === 24` check | Verified `200 OK` live |
| `/api/v1/divisions` | `GET` | Public | Serves 24 standardized domain definitions | Verified `200 OK` (24 records) |
| `/api/v1/public/enquiries` | `POST` | Public | `assertMutationSecurity`, IP rate limit, Zod consent validation | Susceptible to `X-Forwarded-For` spoofing (`STAGE4-P2-02`) |
| `/api/v1/auth/sign-in` | `POST` | Public | `assertMutationSecurity`, per-IP + per-email throttle, `scrypt` + TOTP check | Audit logs both failures & successes |
| `/api/v1/auth/sign-up` | `POST` | Public | `assertMutationSecurity`, IP rate limit, transactional tenant creation | Allocates `ORG_OWNER` + `STARTER` subscription |
| `/api/v1/auth/sign-out` | `POST` | Session optional | `assertMutationSecurity` (JSON CSRF fix preserved), deletes session row + cookie | Verified session revocation (`401` on reuse) |
| `/api/v1/auth/session` | `GET`, `PATCH` | Authenticated | Context city switch validates `(organization_id = ? OR is_public = 1)` | Clean session introspection & active city validation |
| `/api/v1/auth/mfa` | `POST` | Authenticated | `assertMutationSecurity`, active MFA `409` overwrite guard | Does not re-verify password on enable/disable (`STAGE4-P2-02`) |
| `/api/v1/cities` | `GET`, `POST` | `GET`: optional / `POST`: `cities:write` | `NaN`-safe pagination, `escapeLike` with `ESCAPE '\'`, transaction | Allows `isPublic: true` under `cities:write` (`STAGE4-P2-04`) |
| `/api/v1/datasets` | `GET`, `POST`, `PATCH` | `GET`/`POST` `data:write` / `PATCH` permissioned | City & 2-digit division validation via `guards.ts` | Stores provenance classification & limitations |
| `/api/v1/integrations` | `GET`, `POST`, `PATCH` | `GET`: auth / Mutate: `integrations:manage` | `isSafeExternalHttpsUrl()` SSRF check on `endpointRef`, `assertPermittedCity` + `assertValidDivision` | Truthfully tests HTTPS connectivity or returns diagnostics |
| `/api/v1/operations` | `GET`, `POST`, `PATCH` | Read: auth / Write: `operations:write` / `workflows:approve` / `reports:publish` | Verified `REPORT_STATUS` uses `auth.ctx.permissions`, `NOTIFICATION_READ` returns `404` on missing/foreign ID, `calendar_event` rejects invalid dates | Handles assets, projects, work orders, incidents, alerts, reports, documents, events, messages, vendors, workflows, scenarios |
| `/api/v1/search` | `GET` | Authenticated | `escapeLike()` across cities, divisions, datasets, workbooks, assets, reports | Scoped strictly by `organization_id` (plus public cities/divisions) |
| `/api/v1/admin` | `GET`, `POST` | `users:manage` (`CREATE_WEBHOOK` also checks webhook SSRF) | Prevents privilege escalation on unknown roles, enforces `seat_limit`, transactional user creation, webhook SSRF check | Complete admin/developer credential lifecycle |
| `/api/v1/workbooks` | `GET`, `POST` | `sheets:read` / `sheets:write` | Validates `cityId`, 2-digit `divisionCode`, active `is_archived = 0` | `initialCells` has no entry count limit (`STAGE4-P3-02`) |
| `/api/v1/workbooks/[id]` | `GET`, `PATCH`, `DELETE` | `sheets:read` / `sheets:write` | Scopes `organization_id = ? AND is_archived = 0`, validates target `sheetId` ownership, transactional snapshot restore | Verified `404` cross-tenant & post-archive |
| `/api/v1/workbooks/[id]/export` | `GET` | `data:export` | Blocks archived (`is_archived = 0`), sanitizes CSV cells (`CWE-1236`) & XLSX tab names (`<=31` chars, deduplicated) | Uses legacy `xlsx` (`STAGE4-P1-01`) |
| `/api/v1/ai/sessions` | `GET`, `DELETE` | Authenticated (`organization_id` + `user_id`) | Verifies session ownership (`404` on missing/foreign) | Clean per-user session cleanup |
| `/api/v1/ai/chat` | `GET`, `POST` | `ai:use` | Prompt injection system framing, monthly quota check, truthful `503 AI_PROVIDER_UNAVAILABLE` | Orphaned message insert on 503 & non-transactional quota race (`STAGE4-P2-05`) |

---

## 3. Confirmed API Reliability & Input Validation Findings

| ID | Severity | Route | Issue Details | Recommendation |
|---|---|---|---|---|
| `STAGE4-P2-05b` | **P2 (Medium)** | `src/app/api/v1/ai/chat/route.ts:99-188` | (1) Inserts `ai_sessions` + user `ai_messages` BEFORE invoking the AI provider; on `503 AI_PROVIDER_UNAVAILABLE`, unanswered user turns remain saved in the DB. (2) Monthly `COUNT(*)` quota check and `usage_records` insert are not wrapped in an atomic check-and-reserve transaction, allowing concurrent burst requests to exceed `ai_monthly_quota`. | Delay persistence or write only after provider response (or mark status `FAILED`), and reserve quota atomically inside a transaction (rolling back if provider fails). |
| `STAGE4-P2-04` | **P2 (Medium)** | `src/app/api/v1/cities/route.ts:22,85,148` | Allows any `"cities:write"` caller to set `isPublic: true`. | Require `"reports:publish"` or `"users:manage"` when `isPublic === true`. |
| `STAGE4-P3-02a` | **P3 (Low)** | `workbooks/route.ts:20`, `workbooks/[id]/route.ts:13` | `initialCells` and `cells` `z.record(...)` schemas impose no `.refine()` limit on entry count or individual string length, risking oversized JSON blobs under malformed or abusive payloads. | Enforce reasonable cell-count caps (e.g., `<= 25,000` cells and `raw.length <= 2,000`) in Zod schemas. |

---

## 4. API Review Verdict

All 19 routes conform cleanly to standardized HTTP status codes, JSON-only CSRF protection, parameterized DB queries, and strict RBAC checks. Addressing `STAGE4-P2-05b`, `STAGE4-P2-04`, and `STAGE4-P3-02a` will eliminate the remaining concurrency and resource-bound gaps.
