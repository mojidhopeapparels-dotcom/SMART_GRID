# SMART GRID — OVERALL FINAL 24 INTELLIGENCE DIVISIONS, API & DATA PROVENANCE AUDIT

**Audit Date:** `2026-11-13`  
**Project:** SMART GRID — Global Smart City Intelligence & Management Ecosystem  
**Audit Scope:** API Backend Audit (Section 11), 24 Intelligence Divisions Verification Matrix (Section 12), Data Trust & Provenance Accuracy (Section 13)  
**Repository Root:** `F:\SMART_GRID`

---

## PART I — API AND BACKEND ROUTE INVENTORY (SECTION 11)

All **21** route handlers under `src/app/api/v1/**/route.ts` were inspected during this audit:

| Endpoint | Methods | Auth & RBAC | CSRF / Validation / Tenant Scope | Evidence & Defects |
| --- | --- | --- | --- | --- |
| `/api/v1/health` | `GET` | Public | Safe readiness telemetry | `VERIFIED` live (`200 OK`). **Note (`OFA-P2-05`):** Always returns HTTP `200` even when `readiness.configValid === false`; probes must parse JSON. |
| `/api/v1/divisions` | `GET` | Public | Static read-only 24-division catalog | `CODE-VERIFIED` |
| `/api/v1/public/enquiries` | `POST` | Public | `assertMutationSecurity`, Zod validation, rate-limited | `CODE-VERIFIED` |
| `/api/v1/auth/session` | `GET` | Public / Optional Session | Inspects SHA-256 session token cleanly | `VERIFIED` (`live_smoke.mjs`) |
| `/api/v1/auth/sign-in` | `POST` | Public + IP Rate Limit | `assertMutationSecurity`, `scrypt` verify, `DEMO_MODE` guard | `VERIFIED` live (`401` demo blocked, `10` x `401` then `429`) |
| `/api/v1/auth/sign-up` | `POST` | Public + IP Rate Limit | `assertMutationSecurity`, creates isolated org + `ORG_OWNER` | `VERIFIED` live (`201`, isolated Tenant B verification) |
| `/api/v1/auth/sign-out` | `POST` | Session optional/revoked | `assertMutationSecurity`, deletes DB session row | `VERIFIED` (`401` on revoked cookie reuse) |
| `/api/v1/auth/password-reset` | `POST` | Public + IP/email Limit | Non-enumerating `200` JSON for known/unknown emails | `VERIFIED` live byte-identical `data` payload |
| `/api/v1/auth/password-reset/confirm` | `POST` | Public token + Limit | Single-use hashed token expiry/burn | `CODE-VERIFIED` |
| `/api/v1/auth/mfa` | `GET`, `POST` | Session required | Current-password re-auth, TOTP, single-use recovery | `VERIFIED` / `TEST-VERIFIED` — **Gap `OFA-P2-02`:** lacks `checkRateLimit()` |
| `/api/v1/cities` | `GET`, `POST` | Session + `canPublishPublicCity` | `assertPermittedCity`, LIKE escape, public gate (`403`) | `VERIFIED` (`live_smoke.mjs`) |
| `/api/v1/datasets` | `GET`, `POST` | Session + RBAC | `organization_id = ?`, Zod, provenance status metadata | `CODE-VERIFIED` |
| `/api/v1/operations` | `GET`, `POST`, `PATCH` | Session + RBAC | `organization_id = ?`, `assertPermittedCity`, `assertValidDivision` | `VERIFIED` (`400` bad div) — **Gap `OFA-P3-04`:** GET ignores `cityId`/`divisionCode` on 10 non-`alerts` resource switches |
| `/api/v1/integrations` | `GET`, `POST` | Session + `integrations:manage` | `isSafeExternalHttpsUrl`, `TEST_CONNECTION` HEAD no redirect | `VERIFIED` (`400 UNSAFE_ENDPOINT_URL`) — **Gap `OFA-P2-01`:** missing pre-connect `dns.lookup` |
| `/api/v1/search` | `GET` | Session required | `organization_id = ?`, `escapeLike`, bounded pagination | `VERIFIED` live (`0` cross-tenant hits) |
| `/api/v1/ai/sessions` | `GET`, `POST` | Session + AI perm | Strict `organization_id` scope | `CODE-VERIFIED` |
| `/api/v1/ai/chat` | `POST` | Session + AI perm | Atomic quota reserve/release, `503` without keys | `VERIFIED` live (`503 AI_PROVIDER_UNAVAILABLE`) — **Gap `OFA-P2-06`:** reserves/releases slot even when provider unconfigured; no per-minute rate limit |
| `/api/v1/workbooks` | `GET`, `POST` | Session + `sheets:read/write` | `organization_id = ?`, validated city/division | `VERIFIED` live |
| `/api/v1/workbooks/[id]` | `GET`, `PATCH`, `DELETE` | Session + `sheets:read/write` | Tenant `404` isolation, `MAX_SHEETS = 25`, `MAX_CELLS = 10_000` | `VERIFIED` live (`404` Tenant B, `400 WORKBOOK_SHEET_LIMIT`) |
| `/api/v1/workbooks/[id]/export` | `GET` | Session + `sheets:read` | Tenant `404`, CSV CWE-1236, `write-excel-file` OOXML | `VERIFIED` live (`404` Tenant B, `'` neutralization, XLSX roundtrip) |
| `/api/v1/admin` | `GET`, `POST`, `PATCH` | Session + Admin RBAC | Organization-scoped user/subscription/audit actions | `CODE-VERIFIED` (Note: `subscriptions` fix for `org_partner_metro` verified in `apiAndRbacIntegration.test.ts`; legacy `data/smart_grid.db` still only had 1 sub row `OFA-P3-05`) |

---

## PART II — ALL 24 INTELLIGENCE DIVISIONS VERIFICATION MATRIX (SECTION 12)

All 24 Divisions exist verbatim in `src/lib/domain/divisions.ts` and SQLite `divisions` table, contain **50 standardized KPI definitions**, and returned **HTTP `200 OK` with `0` error boundaries** across all `24` public `/divisions/[slug]` URLs and all `24` authenticated `/app/divisions/[slug]` URLs in the live production sweep (`task-2678`).

| Code | Official Division Name & Slug | KPIs | Seeded Datasets / Observations / Sources (`data/smart_grid.db`) | Honest Data Provenance Status | Public & App HTTP `200` | Functional Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `01` | City Governance & Command (`city-governance-and-command`) | `3` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` / Governance Workspace | `200` / `200` | `VERIFIED` (Workspace shell + KPI catalog; awaits operator records) |
| `02` | Digital Twin & Geospatial Intelligence (`digital-twin-and-geospatial-intelligence`) | `2` | `0` obs / `0` datasets / `0` sources (`1` GIS layer seeded in `gis_layers`) | `SIMULATED` / GIS Workspace | `200` / `200` | `VERIFIED` (Spatial layers UI + metadata; no live third-party basemap telemetry claimed) |
| `03` | Traffic & Mobility (`traffic-and-mobility`) | `3` | `ds_london_traffic` (`SIMULATED`), `7` obs (`SIMULATED`) | `SIMULATED` | `200` / `200` | `VERIFIED` |
| `04` | Public Transit & Transportation (`public-transit-and-transportation`) | `2` | `ds_tokyo_transit` (`SIMULATED`), `7` obs (`SIMULATED`), `src_gtfs_tokyo` (`INTEGRATION_REQUIRED`), `alt_gtfs_01` | `SIMULATED` / `INTEGRATION_REQUIRED` | `200` / `200` | `VERIFIED` |
| `05` | Environment & Air Quality (`environment-and-air-quality`) | `2` | `ds_dhaka_aq` (`HISTORICAL`), `7` obs (`HISTORICAL`), `src_aq_dhaka` (`HISTORICAL`), `alt_aq_02` | `HISTORICAL` | `200` / `200` | `VERIFIED` |
| `06` | Weather & Climate (`weather-and-climate`) | `2` | `src_weather_london` (`SIMULATED`) | `SIMULATED` | `200` / `200` | `VERIFIED` |
| `07` | Energy & Power Grid (`energy-and-power-grid`) | `2` | `7` obs (`SIMULATED`), `src_grid_singapore` (`INTEGRATION_REQUIRED`) | `SIMULATED` / `INTEGRATION_REQUIRED` | `200` / `200` | `VERIFIED` (Intelligence-only; zero SCADA switching) |
| `08` | Water & Wastewater (`water-and-wastewater`) | `2` | `ds_singapore_water` (`SIMULATED`) | `SIMULATED` | `200` / `200` | `VERIFIED` |
| `09` | Waste & Sanitation (`waste-and-sanitation`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` / Operational Workspace | `200` / `200` | `VERIFIED` (Division workspace & alerts/KPIs interactive) |
| `10` | Disaster & Climate Risk (`disaster-and-climate-risk`) | `2` | `ds_toronto_flood` (`SIMULATED`, partner org), `src_toronto_lab` | `SIMULATED` (Partner-isolated) | `200` / `200` | `VERIFIED` |
| `11` | Public Safety & Emergency Services (`public-safety-and-emergency-services`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` / Role-Gated | `200` / `200` | `VERIFIED` |
| `12` | Healthcare & Medical Infrastructure (`healthcare-and-medical-infrastructure`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` / Aggregate-Only | `200` / `200` | `VERIFIED` (Prohibits identifiable patient records) |
| `13` | Urban Planning & Development (`urban-planning-and-development`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `14` | Buildings & Housing (`buildings-and-housing`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `15` | IoT & Sensor Networks (`iot-and-sensor-networks`) | `2` | `1` seeded sensor | `INTEGRATION_REQUIRED` / `SIMULATED` | `200` / `200` | `VERIFIED` |
| `16` | Telecommunications & Connectivity (`telecommunications-and-connectivity`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `17` | Logistics & Supply Chain (`logistics-and-supply-chain`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `18` | Economy & Commerce (`economy-and-commerce`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `19` | Municipal Finance & Procurement (`municipal-finance-and-procurement`) | `2` | `1` vendor & `1` contract seeded | `INTERNAL` / `UNAVAILABLE` telemetry | `200` / `200` | `VERIFIED` |
| `20` | Citizen Services & Community (`citizen-services-and-community`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `21` | Education & Social Infrastructure (`education-and-social-infrastructure`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `22` | Public Lighting & Street Infrastructure (`public-lighting-and-street-infrastructure`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |
| `23` | Tourism, Culture & Recreation (`tourism-culture-and-recreation`) | `2` | `1` city event seeded | `UNAVAILABLE` telemetry | `200` / `200` | `VERIFIED` |
| `24` | Food Systems & Urban Agriculture (`food-systems-and-urban-agriculture`) | `2` | `0` obs / `0` datasets / `0` sources | `UNAVAILABLE` | `200` / `200` | `VERIFIED` |

*(Note: In `SMART_GRID_DEMO_MODE=false`, transactional demo rows like sample alerts/contracts/events are suppressed while the 24 division catalog definitions, 50 KPIs, and showcase evaluation sources/datasets still keep explicit `SIMULATED`, `HISTORICAL`, or `INTEGRATION_REQUIRED` statuses — zero false `LIVE` claims.)*

---

## PART III — DATA TRUST, PROVENANCE & INTELLIGENCE ACCURACY (SECTION 13)

- **Controlled Vocabulary (`src/lib/domain/statuses.ts`):** Enforces exact 10 provenance states: `LIVE`, `HISTORICAL`, `SIMULATED`, `UNAVAILABLE`, `INTEGRATION_REQUIRED`, `STALE`, `ERROR`, `VALIDATING`, `PARTIAL`, `DISABLED` (`TEST-VERIFIED`).
- **Live DB Audit Results (`dump_audit_facts.mjs`):**
  - Across `data/smart_grid.db`: **0 rows claim `LIVE`**! Datasets consist of `1` `HISTORICAL` (`ds_dhaka_aq`) + `4` `SIMULATED`; Data Sources consist of `2` `INTEGRATION_REQUIRED` (`src_grid_singapore`, `src_gtfs_tokyo`) + `2` `SIMULATED` (`src_toronto_lab`, `src_weather_london`) + `1` `HISTORICAL` (`src_aq_dhaka`); Observations consist of `7` `HISTORICAL` + `21` `SIMULATED`; Alerts consist of `1` `HISTORICAL` + `1` `INTEGRATION_REQUIRED`.
- **AI Provenance Grounding:** Verified in `task-2678` `/api/v1/ai/chat` JSON error details and `securityAndTenant.test.ts` — AI citations attach explicit `dataStatus` (`SIMULATED`, `HISTORICAL`), `cityId`, and `divisionCode`.
- **Conclusion (`VERIFIED`):** SMART GRID maintains strong anti-fabrication and provenance discipline across schema, APIs, UI badges (`StatusBadge`), and AI responses. One API query bug (`OFA-P3-04` in `operations/route.ts`) affects `cityId`/`divisionCode` filtering consistency on GET `operations` calls and should be wired before operational multi-city rollouts.
