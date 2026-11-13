# SMART GRID — OVERALL FINAL ENVIRONMENT, INTEGRATIONS & OPERATIONS AUDIT

**Audit Date:** `2026-11-13`  
**Project:** SMART GRID — Global Smart City Intelligence & Management Ecosystem  
**Audit Scope:** Environment & Configuration Matrix (Section 17), Email & External Integrations (Section 18), Monitoring & Backup Operations (Sections 20.5–20.6)  
**Repository Root:** `F:\SMART_GRID`

---

## PART I — ENVIRONMENT AND CONFIGURATION MATRIX (SECTION 17)

Inspected `.env.example` (`1,725` B) and scanned all source/script files (`dump_audit_facts.mjs`): **0 `.env` / `.env.local` files exist on disk**, and exactly **24 `process.env.*` variables** are referenced by application code and scripts:

| Variable | Referenced In | Prod Req | Default / Example Format | Risk if Missing / Misconfigured |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | `next.config.mjs`, `env.ts`, `session.ts`, `sign-in/page.tsx` | **Required** (`production`) | Set by host (`production`) | Enables dev behavior/demo fallbacks outside production. |
| `SMART_GRID_SESSION_SECRET` | `env.ts`, `session.ts` | **Mandatory (`>= 32` random chars)** | `<64-char-hex-secret>` | `session.ts` falls back to ephemeral per-process key -> `configValid: false`, breaks sessions on restart (`OFA-P1-03`). |
| `SMART_GRID_DEMO_MODE` | `env.ts`, `sign-in/page.tsx` | **Mandatory (`false`)** | `false` | Fail-closed blocked by `validateEnvironment()` if `true` in production; `DEMO_MODE=false` verified to block demo logins (`401`). |
| `NEXT_PUBLIC_APP_URL` | `next.config.mjs`, `env.ts`, `password-reset/route.ts` | **Mandatory (`https://...`)** | `https://smartgrid.example.org` | Reset links & build-time HSTS depend on canonical origin; note `next.config.mjs` evaluates at **build time** (`OFA-P1-03`). |
| `SMART_GRID_DB_PATH` | `db/index.ts`, `env.ts`, `scripts/*.mjs` | **Recommended** | `/var/lib/smartgrid/smart_grid.db` | Defaults relative to CWD (`data/smart_grid.db`), risking ephemeral disk loss if unpinned. |
| `SMART_GRID_BOOTSTRAP_ADMIN_EMAIL` | `db/seed.ts` | **Required on clean cutover** | `admin@city.example.org` | Clean prod DB (`DEMO_MODE=false`) starts with `0` login accounts unless bootstrap env vars are provided. |
| `SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD` | `db/seed.ts` | **Required on clean cutover** | `<strong-initial-password>` | Cannot create initial `usr_bootstrap_admin` without explicit password. |
| `SMART_GRID_BOOTSTRAP_ADMIN_NAME` | `db/seed.ts` | Optional | `"System Administrator"` | Falls back to default administrator display name. |
| `SMART_GRID_COOKIE_SECURE` | `session.ts` | Optional override | `"true"` / `"false"` | Auto-detects via HTTPS URL or `x-forwarded-proto`; override if custom proxy terminates TLS without header. |
| `SMART_GRID_ENABLE_HSTS` | `next.config.mjs`, `env.ts` | Optional HTTPS flag | `"true"` | **Build-time caveat (`OFA-P1-03`):** runtime-only setting did NOT emit HSTS header without `x-forwarded-proto: https`. |
| `SMART_GRID_TRUST_PROXY` | `env.ts` | **Mandatory behind Nginx/ALB** | `"true"` behind trusted proxy | If omitted behind proxy, all users collide in `"direct-unproxied"` rate-limit bucket (`OFA-P2-02`). |
| `SMART_GRID_EMAIL_WEBHOOK_URL` | `env.ts`, `email/mailer.ts` | **Required for password reset** | `https://relay.example.org/send` | Reset requests record tokens safely but cannot dispatch emails (`INTEGRATION_REQUIRED`, `OFA-P1-01`). |
| `SMART_GRID_EMAIL_WEBHOOK_TOKEN` | `email/mailer.ts` | Optional Bearer auth | `<webhook-bearer-token>` | Outbound HTTPS webhook relay calls lack Authorization bearer token if relay requires auth. |
| `SMART_GRID_SMTP_HOST` | `env.ts`, `email/mailer.ts` | Optional (incomplete transport) | `smtp.example.org` | Triggers `smtp_unwired` / `INTEGRATION_REQUIRED` because no SMTP client transport is installed (`OFA-P1-01`). |
| `SMART_GRID_SMTP_FROM` | `email/mailer.ts` | Optional | `noreply@smartgrid.example` | Metadata `from` address for mailer payload. |
| `GEMINI_API_KEY` | `ai/provider.ts`, `env.ts`, `health`, UI | Optional (for Gemini AI) | `<gemini-api-key>` | AI chat returns honest HTTP `503 AI_PROVIDER_UNAVAILABLE`. |
| `GEMINI_MODEL` | `ai/provider.ts` | Optional | Defaults to configured model | Uses code default if omitted. |
| `OPENAI_API_KEY` | `ai/provider.ts`, `env.ts`, `health`, UI | Optional (for OpenAI AI) | `<openai-api-key>` | Fallback provider disabled cleanly (`503` when both keys unset). |
| `OPENAI_MODEL` | `ai/provider.ts` | Optional | Default GPT model string | Uses code default if omitted. |
| `OPENAI_BASE_URL` | `ai/provider.ts` | Optional | `https://api.openai.com/v1` | Allows OpenAI-compatible gateway URL override. |
| `SMART_GRID_DEMO_ADMIN_PASSWORD` / `ANALYST` / `PARTNER` / `VIEWER` | `sign-in/page.tsx` | Local demo override only | Dev-only | Used solely when `SMART_GRID_DEMO_MODE=true` in non-production environments; suppressed completely in production SSR. |

*(Audit confirmation: `validateEnvironment()` fails `configValid: false` if `NODE_ENV=production` with `SMART_GRID_DEMO_MODE=true` or weak/missing `SMART_GRID_SESSION_SECRET`, verified in `stage5Hardening.test.ts`.)*

---

## PART II — EMAIL & EXTERNAL INTEGRATIONS AUDIT (SECTION 18)

| Integration / Channel | Implemented? | Configured Here? | Live Connected? | Verified Behavior & Evidence Label |
| --- | --- | --- | --- | --- |
| **Password-Reset HTTPS Email Webhook (`mailer.ts`)** | **YES** (HTTPS POST JSON + AbortController timeout + optional Bearer token) | **NO** | **NO** | `TEST-VERIFIED` via `__SMART_GRID_EMAIL_SINK__` test hook (`stage5Hardening.test.ts`); live external relay endpoint **`NOT VERIFIED`** (`ENVIRONMENT-DEPENDENT`). |
| **Native SMTP Client Transport (`SMART_GRID_SMTP_HOST`)** | **PARTIAL / UNWIRED** (`smtp_unwired`) | **NO** | **NO** | Setting `SMART_GRID_SMTP_HOST` alone still reports **`INTEGRATION_REQUIRED`** because no `nodemailer`/SMTP socket transport exists (`OFA-P1-01`). **Use `SMART_GRID_EMAIL_WEBHOOK_URL` in production.** |
| **Google Gemini API (`provider.ts`)** | **YES** (`x-goog-api-key` header) | **NO** | **NO** | Honest `503 AI_PROVIDER_UNAVAILABLE` verified live; external completion call **`NOT VERIFIED`** (`ENVIRONMENT-DEPENDENT`). |
| **OpenAI-Compatible API (`provider.ts`)** | **YES** (Bearer header) | **NO** | **NO** | Honest `503` verified live; external completion call **`NOT VERIFIED`** (`ENVIRONMENT-DEPENDENT`). |
| **Transit GTFS / City Telemetry (`src_gtfs_tokyo`, etc.)** | Registry + Read-Only Test Probe (`HEAD`) | **NO** | **NO** | Stored explicitly as `INTEGRATION_REQUIRED`, `SIMULATED`, or `HISTORICAL` in DB. |
| **Utility SCADA Switching (`src_grid_singapore`)** | **NO (By Design — Read-Only Only)** | **NO** | **NO** | `NOT APPLICABLE` for write switching (Division 07 strictly intelligence-only; read-only telemetry unconfigured). |
| **Payment Processor / Live Billing Checkout** | UI / Internal plan selection & `subscriptions` table | **NO** | **NO** | Plan upgrades update DB subscription metadata (`BillingClient` lacks fetch error banner `OFA-P3-03`); no live Stripe/PCI gateway integrated (`DEFERRED`). |
| **Live GIS Basemap Tiles / Sensor Hardware Streams** | Spatial table (`gis_layers`) & SSR UI | **NO** | **NO** | No live external tile server key or hardware MQTT broker integrated (`SIMULATED` / `INTEGRATION_REQUIRED`). |

---

## PART III — MONITORING & BACKUP OPERATIONS AUDIT (SECTIONS 20.5–20.6)

- **Health Endpoint (`/api/v1/health`):** Returns rich JSON telemetry (`database.status`, `divisionsLoaded`, `migrationsApplied`, `latestMigration`, `aiProvider.status`, `readiness.emailDelivery`, `readiness.configValid`, `configErrorCount`, `configWarningCount`) verified live (`task-2678`). **Gap (`OFA-P2-05`):** Always returns HTTP `200` even when `configValid === false`; load-balancer/uptime monitors must assert `.data.readiness.configValid === true` and `database.migrationsApplied >= 2`.
- **Logs & Secret Redaction (`logger.ts`):** Redacts keys, tokens, passwords cleanly (`TEST-VERIFIED` + zero secret leaks in `task-2678` stdout/stderr). Missing: structured log shipping, disk-space alerts, rate-limit spike metrics, backup failure alerts (`OFA-P2-05`).
- **Backup & Recovery (`scripts/db-backup.mjs`, `db-restore.mjs`, `demo-cleanup.mjs`):**
  - Backup integrity, `.sha256` verification, WAL safety, pre-restore snapshot, and cleanup safety refusal (`exit 1` without `--backup`) all `VERIFIED` in isolated drill (`run_db_drill.mjs`).
  - **Gap (`OFA-P2-03`):** No scheduled cron/Task Scheduler job, off-site encrypted archive storage, or production host disk alerting exists yet.
  - **RPO / RTO:** **`UNVERIFIED`** (`NOT VERIFIED` on target host storage — depends entirely on operator-configured backup cadence and off-site copy time).
