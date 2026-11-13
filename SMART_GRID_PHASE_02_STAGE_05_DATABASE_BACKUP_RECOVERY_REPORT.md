# SMART GRID — PHASE 02, STAGE 5: DATABASE, BACKUP & RECOVERY REPORT (RECOVERED)

**Project:** SMART GRID — *The Intelligence Behind Tomorrow's Cities.*  
**Repository:** `F:\SMART_GRID`  
**Phase / Stage:** Phase 02, Stage 5 — Production Preparation (Forensic Recovery Verification)  
**Assessment Date:** 2026-11-13  

---

## 1. Executive Summary

Stage 5 introduced schema migration [002_stage5_hardening.sql](file:///F:/SMART_GRID/src/lib/db/migrations/002_stage5_hardening.sql) (expanding schema coverage from `49` to **`54` tables** and adding `7` indexes) along with three deterministic Node/SQLite operational scripts (`scripts/db-backup.mjs`, `scripts/db-restore.mjs`, `scripts/demo-cleanup.mjs`).

**Important Forensic Disclosure Regarding Live Workspace File `F:\SMART_GRID\data\smart_grid.db`:**
Read-only inspection of the pre-existing `F:\SMART_GRID\data\smart_grid.db` (`4,096` bytes base + `1,145,392` bytes WAL, last modified `2026-11-12`) established that Stage 5's upgrade/cleanup tools have **NOT yet been executed against `F:\SMART_GRID\data\smart_grid.db`**:
- `schema_migrations` in `data\smart_grid.db` currently contains only `001_initial.sql` (`49` tables; the `5` Stage 5 tables do not yet exist in that file until migration `002` runs on startup or maintenance).
- `data\smart_grid.db` still contains **4 seeded `@smartgrid.local` demo accounts**, **2 demo organizations**, and **109 total demo rows**.
- Read-only health checks on `data\smart_grid.db` remain **`PRAGMA integrity_check = ok`** and **`PRAGMA foreign_key_check = []`** (`wal` mode).

By contrast, on a fresh database in `NODE_ENV=production` with `SMART_GRID_DEMO_MODE=false` (verified cleanly in `task-2374` on `.tmp_s5_smoke.db`), all `54` tables and both `001_initial.sql` & `002_stage5_hardening.sql` apply automatically with `0` demo `@smartgrid.local` users. Furthermore, an isolated copy of `data\smart_grid.db*` passed the entire backup -> `002` migration -> refusal-gate -> cleanup -> SHA-256 verified restore rollback drill (`Exit 0`).

**Overall Stage 5 Database & Ops Verdict:**
- Schema `002_stage5_hardening.sql`, Backup, Restore & Cleanup Scripts: **`VERIFIED PASS`** (empirically tested in isolated `.tmp_s5_ops` drill and fresh smoke DB).
- Legacy `F:\SMART_GRID\data\smart_grid.db` Production Cutover Hygiene: **PENDING EXECUTION BEFORE EXTERNAL GO-LIVE** (must either boot from a clean production DB file or run backup + `002` + `demo-cleanup.mjs --confirm-execute`).

---

## 2. Schema Architecture & Migration `002_stage5_hardening.sql`

- **`001_initial.sql` (`49` tables):** Core multi-tenant organizations, workspaces, users, sessions, RBAC (`roles`, `permissions`, `role_permissions`), global taxonomy (`countries`, `cities`, `administrative_areas`, `divisions`), datasets, observations, operations (`assets`, `sensors`, `projects`, `work_orders`, `incidents`, `alerts`, `workflows`), SHEETS (`workbooks`, `workbook_sheets`, `workbook_versions`), AI (`ai_sessions`, `ai_messages`), governance (`audit_logs`, `subscriptions`, `usage_records`, `webhooks`, `api_keys`).
- **`002_stage5_hardening.sql` (+`5` tables -> `54` total, +`7` indexes):**
  1. `password_reset_tokens` (SHA-256 `token_hash UNIQUE`, `expires_at`, `used_at`, `requested_ip`)
  2. `mfa_recovery_codes` (SHA-256 `code_hash`, `used_at`)
  3. `mfa_pending_enrollments` (server-bound enrollment secret + expiry)
  4. `ai_quota_reservations` (`status IN ('RESERVED','COMMITTED','RELEASED')`)
  5. `seed_metadata` (`seed_key`, `seed_version`, `mode`, `applied_at`)
  6. Indexes: `idx_sessions_user_active`, `idx_alerts_org_city_div`, `idx_ai_sessions_org_user`, `idx_usage_org_metric_time`, `idx_pwd_reset_user`, `idx_mfa_rec_user`, `idx_ai_quota_res_org_month`.

**Residual `STAGE4-P3-04` Note (`PARTIALLY IMPLEMENTED`):** `seed_metadata` cleanly resolves seed-version tracking beyond `divisions >= 24`, and `app/divisions/[slug]/page.tsx` adds explicit org/public city authorization. However, retrofitting inline `REFERENCES` constraints onto nullable columns in `001_initial.sql` (`sessions.active_city_id`, `observations.kpi_code`, `observations.sensor_id`) was not included in additive `002_stage5_hardening.sql` (`sqlite` table-rebuild deferred to future schema cleanup). Note also that when `SMART_GRID_DEMO_MODE=false`, [seed.ts](file:///F:/SMART_GRID/src/lib/db/seed.ts) still seeds public showcase reference cities (`city_tokyo`, `city_singapore`, `city_london`, `city_dhaka`, `city_nairobi`, `city_toronto`), demo reference orgs (`org_demo_global`, `org_partner_metro`), sample sources/datasets/observations/assets/sensors (lines `88-109, 155-399`) labeled `SIMULATED`/`HISTORICAL`, while suppressing `@smartgrid.local` user accounts and operational demo records (lines `118-152, 400-588`). Operators wishing zero showcase tenant orgs on fresh DBs should run `demo-cleanup.mjs` or customize `seed.ts`.

---

## 3. Operational Scripts Forensic Inspection & Isolated Execution Drill

1. **[scripts/db-backup.mjs](file:///F:/SMART_GRID/scripts/db-backup.mjs):** Uses `node:sqlite` online `backup()` API (capturing uncommitted WAL pages cleanly), supports `--read-only-source`, writes atomic `.tmp` then renames, emits `.sha256` sidecar, validates `PRAGMA integrity_check` and `foreign_key_check` on the backup file.
2. **[scripts/demo-cleanup.mjs](file:///F:/SMART_GRID/scripts/demo-cleanup.mjs):** Defaults strictly to `DRY_RUN_READ_ONLY` (`DatabaseSync(..., { readOnly: true })`). Refuses `--confirm-execute` unless `--backup <verifiedBackupFile>` is supplied and passes `PRAGMA integrity_check`. Aborts if non-demo users hold memberships in demo orgs (`nonDemoMembersBlockingOrgDelete`). Preserves system taxonomy (`divisions: 24`, `countries: 9`, `permissions: 20`, `roles: 10`, `role_permissions: 124`, `global_kpi_definitions: 50`, `schema_migrations`).
3. **[scripts/db-restore.mjs](file:///F:/SMART_GRID/scripts/db-restore.mjs):** Verifies SHA-256 checksum sidecar before restore, reads backup SQLite integrity check, requires `--force` when overwriting an existing DB, creates a timestamped `.pre-restore-*.bak` safety snapshot, removes stale `-wal`/`-shm` sidecars, and re-verifies post-restore integrity.

### Empirical Isolated Drill Results (Executed Against Copy of `data/smart_grid.db*` in `.tmp_s5_ops/`)

| Step | Command / Action | Observed Empirical Outcome | Exit |
|---|---|---|---|
| **Live DB Read-Only Dry Run** | `node scripts/demo-cleanup.mjs --dry-run --json` | Read-only mode confirmed (`data/smart_grid.db` untouched); `4` demo users, `2` demo orgs, `109` rows planned across `37` tables; preserved `24` divisions, `50` global KPIs. | `0` |
| **1. Online Backup** | `node scripts/db-backup.mjs --db .tmp_s5_ops/live_copy.db --out .tmp_s5_ops/backup.db --read-only-source --json` | Created `536,576` byte consolidated backup (`131` pages including `1,145,392`-byte WAL), SHA-256 `245549f6a3aa8f5c13c69b08bbb782266b4c98e4f36a5188249bb286364b956c`, `integrityCheck: "ok"`, `foreignKeyViolations: 0`, `tableCount: 49`. | `0` |
| **2. Apply `002` Migration** | Exec `002_stage5_hardening.sql` on copy | `tablesAfter002: 54`, `migrations: ["001_initial.sql", "002_stage5_hardening.sql"]`. | `0` |
| **3. Refusal Gate Test** | `node scripts/demo-cleanup.mjs --db .tmp_s5_ops/live_copy.db --confirm-execute` (no `--backup`) | Refused with `Refusing --confirm-execute without --backup <verifiedBackupFile>`. | `1` (expected fail) |
| **4. Cleanup Execution** | `node scripts/demo-cleanup.mjs --db ... --confirm-execute --backup ... --json` | Removed `109` rows; post-check `users: 0`, `orgs: 0`, `divs: 24`, `kpis: 50`, `integrity_check: ok`, `fkViolations: 0`. | `0` |
| **5. Rollback Restore** | `node scripts/db-restore.mjs --backup ... --target ... --force --json` | Verified SHA-256 `checksumVerified: true`, created `.pre-restore-*.bak`, restored `536,576` bytes; post-restore `users: 4`, `demoUsers: 4`, `orgs: 2`, `integrity_check: ok`. | `0` |
| **6. Cleanup Workspace** | `Remove-Item -Recurse -Force .tmp_s5_ops` | Zero temporary artifacts retained; live `data/smart_grid.db` completely untouched. | `0` |

---

## 4. Production Cutover Procedure for Existing SQLite File (If Not Bootstrapping Fresh)

If deploying by upgrading the existing `F:\SMART_GRID\data\smart_grid.db` rather than initializing a brand-new `SMART_GRID_DB_PATH` file with `SMART_GRID_DEMO_MODE=false` + `SMART_GRID_BOOTSTRAP_ADMIN_*`:
1. Take verified backup: `node scripts/db-backup.mjs --out backups/pre_prod_cutover.db`
2. Ensure migration `002` is applied (either app boot or startup init).
3. Preview & execute cleanup: `node scripts/demo-cleanup.mjs --dry-run` -> `node scripts/demo-cleanup.mjs --confirm-execute --backup backups/pre_prod_cutover.db`
4. Restart application with `SMART_GRID_DEMO_MODE=false` and `SMART_GRID_BOOTSTRAP_ADMIN_EMAIL` / `SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD` to create your first real organizational owner.
