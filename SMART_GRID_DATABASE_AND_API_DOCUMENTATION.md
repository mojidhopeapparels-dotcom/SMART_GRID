# SMART GRID — DATABASE & API DOCUMENTATION

**Database Engine:** Node 26 `node:sqlite` (`DatabaseSync`, WAL mode + `PRAGMA foreign_keys = ON`)
**Migration Entrypoint:** `src/lib/db/index.ts` -> `src/lib/db/migrations/001_initial.sql`

---

## 1. Database Schema Overview (37 Tables + Schema Migrations)

1. **Identity, Multi-Tenancy & RBAC**
   - `users`: accounts (`id`, `email`, `password_hash`, `full_name`, `job_title`, `locale`, `timezone`, `status`, `mfa_enabled`, `mfa_secret`)
   - `organizations`: tenant organizations (`id`, `slug`, `name`, `org_type`, `country_code`, `verification_status`, `plan_code`, `status`)
   - `workspaces`: scoped tenant workspaces (`id`, `organization_id`, `name`, `slug`)
   - `roles`, `permissions`: role & permission definitions (`code`, `name`, `description`)
   - `organization_memberships`: user-to-org bindings (`organization_id`, `user_id`, `role_code`, `department`, `status`)
   - `sessions`: opaque SHA-256 hashed session tokens with `active_organization_id`, `active_city_id`, `expires_at`
2. **Geographic Hierarchy & Divisions**
   - `countries`, `cities`, `administrative_areas`: hierarchical municipal entities (`organization_id`, `is_public`, `boundary_geojson`, `readiness_score`, `data_status`)
   - `divisions`: canonical catalog `01` through `24`
3. **Data Platform & Integrations**
   - `data_sources`, `datasets`, `integration_runs`, `kpi_definitions`, `observations`
   - All telemetry records store `data_status` and provenance metadata
4. **Infrastructure Operations, Incidents & Governance**
   - `assets`, `sensors`, `projects`, `work_orders`, `incidents`, `city_events`, `alerts`
   - `workflows`, `workflow_runs`, `notifications`
5. **SMART GRID SHEETS, Reports, GIS & Scenarios**
   - `workbooks`, `workbook_sheets`, `workbook_versions`
   - `reports`, `dashboards`, `documents`, `gis_layers`, `scenarios`
6. **SMART GRID AI**
   - `ai_sessions`, `ai_messages` (`citations_json`, `provider`, `model`, `status`)
7. **Developer, Procurement, Community & Audit**
   - `api_keys` (SHA-256 hashed), `webhooks`, `subscriptions`, `usage_records`
   - `vendors`, `contracts`, `calendar_events`, `team_messages`, `public_enquiries`
   - `audit_logs`, `background_jobs`

---

## 2. REST API Endpoints (`/api/v1/*`)

Every authenticated endpoint returns uniform envelope structures (`apiSuccess`, `apiPaginated`, `apiError` from `src/lib/domain/statuses.ts`).

| Route | Methods | Auth / Permission | Purpose |
| --- | --- | --- | --- |
| `/api/v1/health` | `GET` | Public | Database connectivity, migration count, AI provider configuration status (`LIVE` / `INTEGRATION_REQUIRED`) |
| `/api/v1/public/enquiries` | `POST` | Public (rate-limited) | Persists public contact requests into `public_enquiries` |
| `/api/v1/auth/sign-in` | `POST` | Public (rate-limited) | Verifies scrypt password (+ TOTP if `mfa_enabled`), issues signed `HttpOnly` cookie `sg_session` |
| `/api/v1/auth/sign-up` | `POST` | Public (rate-limited) | Provisions new organization, membership (`ORG_OWNER`), starter subscription, and session |
| `/api/v1/auth/sign-out` | `POST` | Session | Revokes session row and clears cookie |
| `/api/v1/auth/session` | `GET`, `PATCH` | Session | Returns current `AuthContext` or switches `activeOrganizationId` / `activeCityId` |
| `/api/v1/auth/mfa` | `POST` | Session | `setup` (TOTP secret + URI), `enable` (verify + persist), `disable` |
| `/api/v1/cities` | `GET`, `POST` | `cities:read` / `cities:write` | Lists tenant + public cities; creates new tenant cities |
| `/api/v1/divisions` | `GET` | `divisions:read` | Returns 24 intelligence divisions + optional city observation/asset summary |
| `/api/v1/datasets` | `GET`, `POST` | `data:read` / `data:write` | Lists tenant datasets/observations; ingests CSV/JSON/manual observations cleanly |
| `/api/v1/integrations` | `GET`, `POST` | `integrations:manage` | Lists data sources & sync runs; creates connectors or triggers sync runs with honest statuses |
| `/api/v1/workbooks` | `GET`, `POST` | `sheets:read` / `sheets:write` | Lists tenant workbooks; creates blank, template, or dataset-imported workbooks |
| `/api/v1/workbooks/[id]` | `GET`, `PATCH`, `DELETE` | `sheets:read` / `sheets:write` | Loads sheets/versions, saves cell/sheet changes + versions, archives workbook |
| `/api/v1/workbooks/[id]/export` | `GET` | `data:export` | Exports workbook (`format=xlsx` or `format=csv`) with evaluated formula values |
| `/api/v1/ai/sessions` | `GET`, `DELETE` | `ai:use` | Lists user/tenant AI conversations and messages; deletes sessions |
| `/api/v1/ai/chat` | `POST` | `ai:use` | Retrieves permitted tenant context + invokes configured AI provider (503 if unconfigured) |
| `/api/v1/operations` | `GET`, `POST`, `PATCH` | `operations:read` / `operations:write` / `workflows:approve` | Unified CRUD + workflow state transitions for assets, projects, work orders, incidents, alerts, reports, scenarios, documents, calendar events, team messages, and vendors |
| `/api/v1/admin` | `GET`, `POST` | `org:manage` / `users:manage` / `audit:read` / `developer:manage` / `billing:manage` | Member provisioning, audit log queries, API key generation/revocation, HTTPS webhook registration, plan tier updates |
| `/api/v1/search` | `GET` | Session | Tenant-scoped search across divisions, cities, datasets, workbooks, assets, and reports |
