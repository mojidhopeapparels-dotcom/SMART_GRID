# SMART GRID — KNOWN ISSUES & EXTERNAL DEPENDENCY REGISTER
**Document Version:** 4.0.0  
**Phase:** Phase 02, Stage 5 — Production Preparation Complete (Forensically Verified: Conditionally Production Ready — `B`)  
**Date:** 2026-11-13  

---

## 1. Deliberately Unavailable / External Integration Dependencies (Not Defective)

1. **Live SMART GRID AI Inference (`503 AI_PROVIDER_UNAVAILABLE`):**
   - No `GEMINI_API_KEY` or `OPENAI_API_KEY` is provisioned in the base environment.
   - `/api/v1/ai/chat` intentionally refuses to synthesize mock AI completions and returns structured HTTP `503` (`AI_PROVIDER_UNAVAILABLE`) without consuming user quota (`ai_quota_reservations`). Setting either environment variable activates live completions via `x-goog-api-key` or OpenAI-compatible headers.
2. **External City Telemetry / SCADA / GTFS Connectors (`INTEGRATION_REQUIRED`):**
   - External municipal connectors carry no external municipal API credentials and remain truthfully labeled `INTEGRATION_REQUIRED`.
3. **External Payment Processor Gateway (`INTEGRATION_REQUIRED`):**
   - `/app/billing` persists internal subscription tier quotas in SQLite without connecting to an external payment gateway like Stripe.
4. **Transactional Email Transport (`SMART_GRID_EMAIL_WEBHOOK_URL` vs `SMART_GRID_SMTP_HOST`):**
   - `src/lib/email/mailer.ts` dispatches live password reset emails via HTTPS webhook (`SMART_GRID_EMAIL_WEBHOOK_URL`). Native raw SMTP socket transport is not bundled: declaring `SMART_GRID_SMTP_HOST` alone logs `SMTP_TRANSPORT_REQUIRES_RELAY` (`channel: "smtp_unwired"`) and returns `INTEGRATION_REQUIRED`.

---

## 2. Environment & Architectural Constraints

1. **In-Memory Rate Limiter (`src/lib/auth/rateLimit.ts`):**
   - Stores rate-limit buckets in Node.js process memory with expired-bucket pruning (`60s` window) and a `10,000`-bucket cap. Suitable for single-instance deployment behind a trusted proxy (`SMART_GRID_TRUST_PROXY=true`); horizontal scaling requires Redis.
2. **SQLite Single-Writer Concurrency (`node:sqlite`):**
   - `DatabaseSync` operates in WAL mode (`54` tables once `002_stage5_hardening.sql` is applied). Designed for single-node persistent SSD deployments; multi-region clusters require PostgreSQL + PostGIS or LiteFS.
3. **CSP Script Policy & Health HTTP Status Behavior:**
   - `next.config.mjs` sets `Content-Security-Policy` in production with `script-src 'self' 'unsafe-inline'` (necessary without runtime nonces).
   - `/api/v1/health` returns HTTP `200` JSON with `data.readiness.configValid: false` if env validation fails; load balancers should inspect `data.readiness.configValid`.
4. **Reference Showcase Data When `SMART_GRID_DEMO_MODE=false`:**
   - Fresh production DB creation with `SMART_GRID_DEMO_MODE=false` suppresses all `@smartgrid.local` demo accounts (`0` demo users verified live) and sample operational records (`seed.ts:400-588`), while retaining public showcase cities (`Tokyo`, `Singapore`, `London`, `Dhaka`, `Nairobi`, `Toronto`) and reference catalog rows labeled `SIMULATED`/`HISTORICAL` unless cleaned via `scripts/demo-cleanup.mjs`.

---

## 3. Stage 4 Findings — Resolved vs Residual Backlog (Verified in Stage 5 Forensic Audit)

### Resolved & Verified in Stage 5
- **`STAGE4-P1-01` (`xlsx` CVEs):** **RESOLVED.** Replaced `xlsx` with `read-excel-file@9.3.15` (dynamically imported in browser) and `write-excel-file@4.1.1`. `npm audit --json` reports `0` vulnerabilities across `70` packages.
- **`STAGE4-P2-01` (Security Headers & `next` Upgrade):** **RESOLVED.** Configured CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, `poweredByHeader: false`, and conditional HSTS in `next.config.mjs`; upgraded `next@16.4.6`.
- **`STAGE4-P2-02` (IP Trust & Auth Lifecycle):** **RESOLVED (WITH FORENSIC FIX).** Added `SMART_GRID_TRUST_PROXY`, `password-reset` & `confirm` with `15m` SHA-256 single-use tokens + atomic session revocation, current-password MFA re-auth + server `mfa_pending_enrollments` + 8 hashed backup recovery codes. Forensic audit closed a residual account-enumeration oracle in `password-reset/route.ts`.
- **`STAGE4-P2-04` (`isPublic` City Permission):** **RESOLVED.** Restricted `isPublic: true` city publishing via `canPublishPublicCity()` (`reports:publish` or `users:manage`), verified `403 FORBIDDEN` live for `DATA_ANALYST`.
- **`STAGE4-P2-05a/b/c` (AI Key Header, Quota Atomicity & Scoped Alerts):** **RESOLVED.** Switched Gemini key to `x-goog-api-key` header, added transactional `ai_quota_reservations` reserve/release/commit, and scoped `alerts` retrieval by `cityId`/`divisionCode`.
- **`STAGE4-P3-02` (SHEETS Completeness & Limits):** **RESOLVED (WITH FORENSIC FIX).** Added lazy `=IF()` AST branching, dynamic columns up to `52`, upload truncation banner, dirty-tab warning, dynamic import `read-excel-file/browser`, `MAX_CELLS = 10_000`, and forensic fix enforcing `MAX_SHEETS = 25` server+client (`400 WORKBOOK_SHEET_LIMIT`). Note: cross-sheet formula references (`Sheet2!A1`) remain unsupported by design.

### Open Operational / Residual Conditions (Non-Blocking for Controlled Single-Node Launch)
- **`STAGE5-OPS-01` (Pre-Existing Dev SQLite File `F:\SMART_GRID\data\smart_grid.db`):** Remains untouched with `001_initial.sql` (`49` tables) and `4` `@smartgrid.local` demo accounts (`STAGE4-P2-03` legacy file). Before production cutover, deploy with a fresh `SMART_GRID_DB_PATH` + `SMART_GRID_BOOTSTRAP_ADMIN_*` or execute backup -> `002` -> `node scripts/demo-cleanup.mjs --confirm-execute`.
- **`STAGE4-P3-01` (Documentation & Git Hygiene):** Recovered all 8 Stage 5 reports in `F:\SMART_GRID\`. However, **0 Stage 3 reports** (`SMART_GRID_PHASE_02_STAGE_03_*.md`) exist on disk, Git `master` has **0 commits yet**, and **no ESLint configuration/`lint` script** exists.
- **`STAGE4-P3-03` (UI/A11y Browser Verification & Minor Silent Mutations):** Source/CSS fixes landed (`UI-01..07` + forensic `.sg-card-white` `#525252` contrast fix), but **no headless Playwright/axe visual DOM audit has been run**. Minor silent failure paths remain on plan switch (`BillingClient.tsx:42`) and org/city context switch (`EnterpriseShell.tsx:134`).
- **`STAGE4-P3-04` (Schema Foreign Key Retrofit Depth):** `seed_metadata` and `app/divisions/[slug]` city filtering are complete, while retrofitting nullable `001_initial.sql` foreign keys on `sessions.active_city_id`, `observations.kpi_code`, and `observations.sensor_id` remains deferred to a future table-rebuild migration.


---

## Overall Final Audit Synchronized Issue Register (2026-11-13)

All findings below are freshly verified against the actual codebase (`F:\SMART_GRID`) on `2026-11-13`. Note that several UI/a11y and security hardening items were found incomplete or newly surfaced beyond historical Stage 4/5 notes.

### Summary Counts (`2026-11-13`)
- **`P0` (Critical):** `0`
- **`P1` (High / Public Production Blockers):** `4` (`OFA-P1-01`..`OFA-P1-04`)
- **`P2` (Medium / Controlled Release Conditions):** `6` (`OFA-P2-01`..`OFA-P2-06`)
- **`P3` (Low / Polish & Functional Fixes):** `7` (`OFA-P3-01`..`OFA-P3-07`)

### Full Findings Table

| ID | Sev | Evidence Label | Affected Area & File(s) | Summary & Observed Evidence | Recommended Remediation | Status | Blocks Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `OFA-P1-01` | `P1` | `VERIFIED` / `ENV-DEP` | `src/lib/email/mailer.ts`, `ai/provider.ts`, `/api/v1/health` | External HTTPS mail webhook, AI keys (`GEMINI_API_KEY` / `OPENAI_API_KEY`), payment, telemetry unprovisioned; `SMART_GRID_SMTP_HOST` alone reports `smtp_unwired` / `INTEGRATION_REQUIRED`. | Configure HTTPS `SMART_GRID_EMAIL_WEBHOOK_URL` (+ bearer token) and required external credentials per launch scope. | **OPEN** | Pilot mail / **Public Prod** |
| `OFA-P1-02` | `P1` | `VERIFIED` | `F:\SMART_GRID\data\smart_grid.db` (`-wal` 1.14 MB) | Workspace DB remains on `001_initial.sql` (`49` tables, `7` indexes) with `4` `@smartgrid.local` demo accounts and `109` demo-linked rows (`002` unapplied). | Never deploy workspace DB directly; boot clean DB (`DEMO_MODE=false` + bootstrap admin) or run verified backup->`002`->cleanup drill. | **OPEN** | Staging / Pilot / **Public Prod** |
| `OFA-P1-03` | `P1` | `VERIFIED` | `.env` (absent), `next.config.mjs`, `session.ts`, `env.ts` | No `.env` exists; unset `SMART_GRID_SESSION_SECRET` falls back to ephemeral per-process key; runtime-only `SMART_GRID_ENABLE_HSTS` emitted `null` header without `x-forwarded-proto: https`. | Provision production `.env` secrets and configure TLS reverse proxy passing `X-Forwarded-Proto: https` (+ `SMART_GRID_TRUST_PROXY=true`). | **OPEN** | Staging / Pilot / **Public Prod** |
| `OFA-P1-04` | `P1` | `VERIFIED` | `git status` (`0` commits), `package.json`, `SMART_GRID_PHASE_02_STAGE_03_*` | Zero Git commits on `master`; missing ESLint/`lint`, Playwright, `@axe-core`, k6 load suite, Linux CI `npx` parity; `0` Stage 3 Markdown logs on disk. | Create audited Git baseline commit; add ESLint, Playwright + `@axe-core` E2E checks, load test, and CI workflow. | **OPEN** | **Public Prod** |
| `OFA-P2-01` | `P2` | `CODE-VERIFIED` | `src/app/api/v1/integrations/route.ts:209-217`, `sanitize.ts` | `isSafeExternalHttpsUrl` blocks literal private/loopback/IPv6/metadata hosts (`400`), but `TEST_CONNECTION` does not resolve DNS (`dns.lookup`) prior to `HEAD` fetch (DNS-rebinding gap for privileged callers). | Resolve DNS A/AAAA records pre-connect and reject private/loopback/link-local IPs before opening socket. | **OPEN** | Controlled Pilot cond. / **Public Prod** |
| `OFA-P2-02` | `P2` | `VERIFIED` / `CODE-VERIFIED` | `src/app/api/v1/auth/mfa/route.ts`, `src/lib/auth/guards.ts` | `/api/v1/auth/mfa` checks `currentPassword`, TOTP, and recovery codes without `checkRateLimit`; auth IP limiter shares `"direct-unproxied"` bucket if `SMART_GRID_TRUST_PROXY=true` omitted behind proxy. | Add per-user/IP rate limit to `/api/v1/auth/mfa` actions and enforce `SMART_GRID_TRUST_PROXY=true` behind reverse proxies. | **OPEN** | Controlled Pilot cond. / **Public Prod** |
| `OFA-P2-03` | `P2` | `VERIFIED` | `src/lib/db/index.ts`, `rateLimit.ts`, `scripts/db-*.mjs` | Single-node SQLite (`WAL`) & `MAX_BUCKETS = 10_000` in-memory limiter prohibit serverless / multi-instance clustering; scheduled backup cron & host RPO/RTO `NOT VERIFIED`. | Keep single-node persistent host + automated encrypted off-host backup cron for Pilot; upgrade to PostgreSQL + Redis for HA/scale. | **OPEN** | Serverless/HA / **Public Prod** |
| `OFA-P2-04` | `P2` | `VERIFIED` | `next.config.mjs` (`CSP` headers) | Live response CSP includes `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'` (currently mitigated by `0` XSS sinks). | Plan nonce-based middleware CSP alongside inline style cleanup. | **OPEN** | Hardening target |
| `OFA-P2-05` | `P2` | `VERIFIED` | `src/app/api/v1/health/route.ts:26-54` | `/api/v1/health` returns HTTP `200` even if `readiness.configValid === false`; no external APM/disk/backup alerting wired. | Fail `/api/v1/health` HTTP `503` on invalid prod config or configure LB monitor JSON assertion + external alerts. | **OPEN** | Controlled Pilot cond. / **Public Prod** |
| `OFA-P2-06` | `P2` | `CODE-VERIFIED` | `src/app/api/v1/ai/chat/route.ts`, `ai/provider.ts` | Reserves/releases DB quota row even when `!providerStatus.configured` (`503`); lacks per-minute burst throttle; live Gemini/OpenAI HTTP calls `NOT VERIFIED`. | Short-circuit unconfigured provider before DB reservation, add per-minute AI rate limit, and test live keys in staging. | **OPEN** | AI live rollout |
| `OFA-P3-01` | `P3` | `VERIFIED` | `src/app/(public)/page.tsx:85`, `src/app/globals.css:13` | Public homepage `<p style={{ color: "var(--sg-grey)" }}>` renders `#9CA3AF` directly on white `#FFFFFF` (`~2.54:1`, fails WCAG 2.2 AA `4.5:1`). | Update color token/rule on light surfaces to `#525252` or darker AAA/AA grey. | **OPEN** | Accessibility polish / **Public Prod** |
| `OFA-P3-02` | `P3` | `VERIFIED` | `src/components/enterprise/CitiesClient.tsx:105-156`, `src/app/app/search/page.tsx:21-51` | `CitiesClient` has `7` unassociated `<label>` inputs + unlabelled filter input; `/app/search` lacks input `<label>`/`aria-label`. | Bind explicit `htmlFor`/`id` and `aria-label` attributes on all form controls. | **OPEN** | Accessibility polish / **Public Prod** |
| `OFA-P3-03` | `P3` | `VERIFIED` | `EnterpriseShell.tsx:133-140`, `BillingClient.tsx:35-47`, `ScenariosClient.tsx:38-63`, `app/search/page.tsx` | Client `fetch()` mutations and search lack `!res.ok` / `catch` inline error banners. | Render accessible `role="alert"` inline error state on failed API calls. | **OPEN** | UX / A11y polish |
| `OFA-P3-04` | `P3` | `CODE-VERIFIED` | `src/app/api/v1/operations/route.ts:133-195` | Validates `cityId` & `divisionCode` on `GET /api/v1/operations` but filters SQL only in `case "alerts":`, ignoring params across 10 sibling switches. | Apply tenant-safe `cityId` & `divisionCode` WHERE filters uniformly across filtered GET queries. | **OPEN** | Functional polish |
| `OFA-P3-05` | `P3` | `VERIFIED` | `src/lib/db/migrations/001_initial.sql`, `data/smart_grid.db` | Nullable `sessions.active_city_id`, `observations.kpi_code`, `observations.sensor_id` omit SQL FKs; legacy `data/smart_grid.db` `subscriptions` has `1` row (`sub_demo_1` only). | Schedule future SQLite table-rebuild FK migration; prefer fresh DB cutover (`seed.ts` seeds all tenant subs). | **DEFERRED** | Schema debt |
| `OFA-P3-06` | `P3` | `CODE-VERIFIED` | `src/components/enterprise/DataCatalogClient.tsx:56-67` | Dataset inline CSV textarea uses naive `line.split(",")` instead of RFC 4180 `parseCsvToMatrix()` (`exportHelpers.ts`). | Replace `line.split(",")` with shared `parseCsvToMatrix()`. | **OPEN** | Data import polish |
| `OFA-P3-07` | `P3` | `NOT VERIFIED` | `src/app/(public)/cities/`, `DocumentsClient.tsx`, mobile drawer | No public `/cities/[slug]` page (enterprise-only `/app/cities/[slug]`); viewport responsiveness/focus-trap untested in headless browser. | Add Playwright + `@axe-core` multi-viewport verification before public launch. | **OPEN** | Public polish |
