import crypto from "node:crypto";
import { getDb, withTransaction } from "./index";
import { DIVISIONS } from "../domain/divisions";
import { PERMISSIONS, SYSTEM_ROLES } from "../auth/rbac";
import { hashPassword } from "../auth/password";
import { isDemoModeEnabled } from "../config/env";
import {
  CAREER_FEST_ORG_ID,
  CAREER_FEST_ORG_SLUG,
  CAREER_FEST_ROLE_CODE,
  CAREER_FEST_STARTER_WORKBOOK_ID,
  CAREER_FEST_USER_EMAIL,
  CAREER_FEST_USER_ID,
  CAREER_FEST_WORKSPACE_ID,
} from "../careerFest/constants";

let seededInProcess = false;

export function resetSeedStateForTests(): void {
  seededInProcess = false;
}

function getCareerFestMonthlyQuota(): number {
  const raw = Number(process.env.SMART_GRID_CAREER_FEST_MONTHLY_AI_QUOTA);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 5000) : 200;
}

function seedCareerFestSandbox(
  tx: ReturnType<typeof getDb>,
  now: string
): void {
  const hasCfSeed = tx
    .prepare("SELECT 1 FROM seed_metadata WHERE seed_key = 'career_fest_seed'")
    .get();
  if (hasCfSeed) return;

  // Ensure RBAC role + permissions exist even when upgrading an existing database
  const insPerm = tx.prepare(
    "INSERT OR IGNORE INTO permissions (code, module, description) VALUES (?, ?, ?)"
  );
  for (const p of PERMISSIONS) {
    insPerm.run(p.code, p.module, p.description);
  }
  const cfRole = SYSTEM_ROLES.find((r) => r.code === CAREER_FEST_ROLE_CODE);
  if (cfRole) {
    tx.prepare(
      "INSERT OR IGNORE INTO roles (code, name, description, is_system) VALUES (?, ?, ?, 1)"
    ).run(cfRole.code, cfRole.name, cfRole.description);
    const insRolePerm = tx.prepare(
      "INSERT OR IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)"
    );
    for (const perm of cfRole.permissions) {
      insRolePerm.run(cfRole.code, perm);
    }
  }

  // Ensure isolated showcase organization, workspace, quota, and non-login system actor
  tx.prepare(
    `INSERT OR IGNORE INTO organizations (id, slug, name, org_type, country_code, verification_status, plan_code, created_at, updated_at)
     VALUES (?, ?, 'SMART GRID Career Fest 2026 Observatory', 'SHOWCASE_SANDBOX', 'GLOBAL', 'VERIFIED', 'ENTERPRISE', ?, ?)`
  ).run(CAREER_FEST_ORG_ID, CAREER_FEST_ORG_SLUG, now, now);

  tx.prepare(
    "INSERT OR IGNORE INTO workspaces (id, organization_id, name, slug, description, status, created_at) VALUES (?, ?, 'Career Fest 2026 Explorer Workspace', 'career-fest-explorer', 'Time-boxed 30-minute public showcase environment with isolated visitor state.', 'ACTIVE', ?)"
  ).run(CAREER_FEST_WORKSPACE_ID, CAREER_FEST_ORG_ID, now);

  tx.prepare(
    `INSERT OR IGNORE INTO subscriptions (id, organization_id, plan_code, status, seat_limit, storage_limit_mb, ai_monthly_quota, current_period_start, current_period_end)
     VALUES ('sub_career_fest_demo', ?, 'ENTERPRISE', 'ACTIVE', 500, 2048, ?, ?, ?)`
  ).run(
    CAREER_FEST_ORG_ID,
    getCareerFestMonthlyQuota(),
    now,
    new Date(Date.now() + 90 * 86400_000).toISOString()
  );

  // Random unguessable credential hash; login route also explicitly blocks this account
  const lockedPasswordHash = hashPassword(crypto.randomBytes(32).toString("hex"));
  tx.prepare(
    `INSERT OR IGNORE INTO users (id, email, password_hash, full_name, job_title, locale, timezone, status, mfa_enabled, created_at, updated_at)
     VALUES (?, ?, ?, 'Career Fest Visitor', 'Career Fest 2026 Guest', 'en', 'UTC', 'ACTIVE', 0, ?, ?)`
  ).run(CAREER_FEST_USER_ID, CAREER_FEST_USER_EMAIL, lockedPasswordHash, now, now);

  tx.prepare(
    `INSERT OR IGNORE INTO organization_memberships (id, organization_id, user_id, role_code, department, status, created_at)
     VALUES ('mem_career_fest_visitor', ?, ?, ?, 'Public Showcase Sandbox', 'ACTIVE', ?)`
  ).run(CAREER_FEST_ORG_ID, CAREER_FEST_USER_ID, CAREER_FEST_ROLE_CODE, now);

  const cityExists = (id: string): string | null =>
    tx.prepare("SELECT 1 FROM cities WHERE id = ?").get(id) ? id : null;
  const dhakaId = cityExists("city_dhaka");
  const sgId = cityExists("city_singapore");
  const tokyoId = cityExists("city_tokyo");
  const londonId = cityExists("city_london");

  // Showcase Data Sources (strictly SIMULATED / HISTORICAL / INTEGRATION_REQUIRED, zero secrets)
  const cfSources: [string, string | null, string, string, string, string, string, string][] = [
    ["src_cf_aq_dhaka", dhakaId, "05", "Dhaka Air Quality Reference Archive (Showcase)", "Evaluation CSV Import", "CSV_UPLOAD", "HISTORICAL", "Contains historical sample observations for Career Fest 2026; live feeds require municipal credentials."],
    ["src_cf_energy_sg", sgId, "07", "Energy Grid Telemetry Bridge (Showcase)", "Utility SCADA Bridge", "REST_API", "INTEGRATION_REQUIRED", "Read-only connector placeholder; no external telemetry credentials attached in public sandbox."],
    ["src_cf_transit_tyo", tokyoId, "04", "Metropolitan Transit Headway Feed (Showcase)", "Transit Open Reference", "JSON_UPLOAD", "SIMULATED", "Simulated corridor cadence model for Career Fest exploration."],
  ];
  const insCfSrc = tx.prepare(
    `INSERT OR IGNORE INTO data_sources (
      id, organization_id, city_id, division_code, name, provider, category,
      connection_type, auth_type, has_credentials, data_format, update_frequency,
      license, status, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'URBAN_DATA', ?, 'NONE', 0, 'JSON', 'HOURLY', 'Career Fest Showcase / Sample', ?, ?, ?, ?)`
  );
  for (const s of cfSources) {
    insCfSrc.run(s[0], CAREER_FEST_ORG_ID, s[1], s[2], s[3], s[4], s[5], s[6], s[7], now, now);
  }

  // Showcase Datasets
  const defaultSchema = JSON.stringify([
    { name: "observed_at", type: "datetime" },
    { name: "metric_name", type: "string" },
    { name: "metric_value", type: "number" },
    { name: "unit", type: "string" },
  ]);
  const cfDatasets: [string, string | null, string, string, string, string, string, number, number][] = [
    ["ds_cf_aq", dhakaId, "05", "src_cf_aq_dhaka", "Dhaka PM2.5 & NO2 Showcase Archive", "Historical urban air-quality showcase sample for Division 05 & SHEETS exploration.", "HISTORICAL", 84, 92.4],
    ["ds_cf_transit", tokyoId, "04", "src_cf_transit_tyo", "Rail Corridor Headway Showcase", "Simulated metropolitan transit headway dataset across peak corridors.", "SIMULATED", 48, 95.1],
    ["ds_cf_energy", sgId, "07", "src_cf_energy_sg", "Urban Microgrid Renewable Balance (Sample)", "Simulated civic solar and feeder load balance dataset for Energy & Scenarios.", "SIMULATED", 36, 97.6],
    ["ds_cf_water", londonId, "08", "src_cf_aq_dhaka", "District Water Pressure & Drainage Benchmark", "Simulated stormwater telemetry benchmark for resilience reviews.", "SIMULATED", 30, 94.8],
  ];
  const insCfDs = tx.prepare(
    `INSERT OR IGNORE INTO datasets (
      id, organization_id, city_id, division_code, source_id, name, description,
      classification, data_status, schema_json, row_count, quality_score,
      unit_system, limitations, is_public_published, last_validated_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INTERNAL', ?, ?, ?, ?, 'METRIC', 'Career Fest 2026 showcase sample dataset — not live city production telemetry.', 0, ?, ?, ?)`
  );
  for (const d of cfDatasets) {
    insCfDs.run(d[0], CAREER_FEST_ORG_ID, d[1], d[2], d[3], d[4], d[5], d[6], defaultSchema, d[7], d[8], now, now, now);
  }

  // Showcase Observations
  const insObs = tx.prepare(
    `INSERT OR IGNORE INTO observations (
      id, organization_id, city_id, division_code, dataset_id, kpi_code, metric_name,
      metric_value, unit, data_status, observed_at, source_name, quality_flag
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID')`
  );
  const baseMs = Date.now();
  for (let i = 0; i < 4; i++) {
    const ts = new Date(baseMs - (3 - i) * 86400_000).toISOString();
    insObs.run(`obs_cf_aq_${i}`, CAREER_FEST_ORG_ID, dhakaId, "05", "ds_cf_aq", "ENV-01", "PM2.5 Mean", 54 + i * 2.8, "ug/m3", "HISTORICAL", "Dhaka AQ Showcase Archive", ts);
    insObs.run(`obs_cf_eng_${i}`, CAREER_FEST_ORG_ID, sgId, "07", "ds_cf_energy", "ENG-01", "Renewable Share", 21.0 + i * 0.5, "%", "SIMULATED", "Urban Microgrid Showcase", ts);
    insObs.run(`obs_cf_trn_${i}`, CAREER_FEST_ORG_ID, tokyoId, "04", "ds_cf_transit", "TRN-01", "On-Time Adherence", 97.6 + (i % 2) * 0.4, "%", "SIMULATED", "Rail Corridor Showcase", ts);
  }

  // Showcase Assets, Sensors, Alerts, GIS, Scenarios, Starter Report & Guide
  tx.prepare(
    `INSERT OR IGNORE INTO assets (id, organization_id, city_id, division_code, asset_tag, name, asset_type, condition_status, operational_status, latitude, longitude, owner_department, data_status, created_at, updated_at)
     VALUES ('ast_cf_pump_01', ?, ?, '08', 'CF-WAT-001', 'Stormwater Detention Pump Station (Sample)', 'Pumping Station', 'FAIR', 'OPERATIONAL', 23.7511, 90.4043, 'Water & Resilience', 'SIMULATED', ?, ?)`
  ).run(CAREER_FEST_ORG_ID, dhakaId, now, now);

  tx.prepare(
    `INSERT OR IGNORE INTO assets (id, organization_id, city_id, division_code, asset_tag, name, asset_type, condition_status, operational_status, latitude, longitude, owner_department, data_status, created_at, updated_at)
     VALUES ('ast_cf_sub_01', ?, ?, '07', 'CF-ENG-014', 'District Civic Microgrid Substation (Sample)', 'Electrical Substation', 'GOOD', 'OPERATIONAL', 1.3521, 103.8198, 'Grid Operations', 'SIMULATED', ?, ?)`
  ).run(CAREER_FEST_ORG_ID, sgId, now, now);

  tx.prepare(
    `INSERT OR IGNORE INTO sensors (id, organization_id, city_id, division_code, asset_id, device_code, name, measurement_type, unit, latitude, longitude, health_status, data_status, last_observation_at, calibrated_at, created_at)
     VALUES ('sen_cf_pm25', ?, ?, '05', NULL, 'CF-AQ-102', 'Central Urban Particulate Node (Showcase)', 'PM2.5', 'ug/m3', 23.733, 90.417, 'INTEGRATION_REQUIRED', 'INTEGRATION_REQUIRED', NULL, ?, ?)`
  ).run(CAREER_FEST_ORG_ID, dhakaId, now, now);

  tx.prepare(
    `INSERT OR IGNORE INTO alerts (id, organization_id, city_id, division_code, title, message, alert_type, priority, status, data_status, created_at, updated_at)
     VALUES ('alt_cf_01', ?, ?, '04', 'External Feed Credentials Required (Showcase Notice)', 'Live agency GTFS credentials are intentionally disabled in the Career Fest visitor sandbox. Sample data is shown.', 'DATA_FRESHNESS', 'MEDIUM', 'ACTIVE', 'INTEGRATION_REQUIRED', ?, ?)`
  ).run(CAREER_FEST_ORG_ID, tokyoId, now, now);

  tx.prepare(
    `INSERT OR IGNORE INTO alerts (id, organization_id, city_id, division_code, title, message, alert_type, priority, status, data_status, created_at, updated_at)
     VALUES ('alt_cf_02', ?, ?, '05', 'Historical PM2.5 Reference Benchmark Alert', 'Historical sample observation exceeded the 55 ug/m3 urban air quality threshold.', 'THRESHOLD', 'HIGH', 'ACTIVE', 'HISTORICAL', ?, ?)`
  ).run(CAREER_FEST_ORG_ID, dhakaId, now, now);

  tx.prepare(
    `INSERT OR IGNORE INTO city_events (id, organization_id, city_id, division_code, title, category, description, source_name, verification_status, latitude, longitude, occurred_at)
     VALUES ('evt_cf_01', ?, ?, '07', 'Solar Microgrid Load Balancing Drill (Simulated)', 'INFRASTRUCTURE', 'Career Fest showcase timeline event modeling peak feeder dispatch.', 'Career Fest Showcase Log', 'SIMULATED', 1.3521, 103.8198, ?)`
  ).run(CAREER_FEST_ORG_ID, sgId, now);

  tx.prepare(
    `INSERT OR IGNORE INTO gis_layers (id, organization_id, city_id, division_code, name, layer_type, crs, source_name, data_status, geojson, created_at)
     VALUES ('gis_cf_urban_nodes', ?, ?, '02', 'Smart City Showcase Telemetry Nodes (Simulated)', 'POINT_COLLECTION', 'EPSG:4326', 'Career Fest Showcase Spatial Seed', 'SIMULATED', ?, ?)`
  ).run(
    CAREER_FEST_ORG_ID,
    dhakaId,
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name: "Stormwater Pump Node (Simulated)", division: "08", status: "OPERATIONAL" }, geometry: { type: "Point", coordinates: [90.4043, 23.7511] } },
        { type: "Feature", properties: { name: "Urban AQ Station (Integration Required)", division: "05", status: "INTEGRATION_REQUIRED" }, geometry: { type: "Point", coordinates: [90.417, 23.733] } },
      ],
    }),
    now
  );

  tx.prepare(
    `INSERT OR IGNORE INTO scenarios (id, organization_id, city_id, division_code, name, description, baseline_label, parameters_json, results_json, assumptions, status, created_by, created_at)
     VALUES ('scn_cf_solar', ?, ?, '07', 'Civic Rooftop Solar +25% Modeled Scenario', 'Hypothetical peak-load reduction estimate for Career Fest visitors exploring Division 07.', '2026 Simulated Baseline', ?, ?, 'Modeled estimate only; assumes 14% average capacity factor and existing substation limits.', 'REVIEWED', ?, ?)`
  ).run(
    CAREER_FEST_ORG_ID,
    sgId,
    JSON.stringify({ rooftopSolarIncreasePct: 25, batteryStorageMwh: 40 }),
    JSON.stringify({ estimatedPeakReductionPct: 8.4, estimatedAnnualCo2AvoidedTons: 12400, modeledEstimate: true }),
    CAREER_FEST_USER_ID,
    now
  );

  tx.prepare(
    `INSERT OR IGNORE INTO reports (id, organization_id, city_id, division_code, title, report_type, status, content_markdown, sources_json, is_public, created_by, approved_by, created_at, updated_at)
     VALUES ('rep_cf_overview', ?, ?, '05', 'Career Fest 2026 — Urban Intelligence Showcase Brief', 'EXECUTIVE', 'PUBLISHED', ?, ?, 0, ?, ?, ?, ?)`
  ).run(
    CAREER_FEST_ORG_ID,
    dhakaId,
    "## Career Fest 2026 Showcase Report\n\nWelcome to SMART GRID. This approved showcase brief demonstrates traceable urban intelligence reporting with explicit provenance (`HISTORICAL` / `SIMULATED` / `INTEGRATION_REQUIRED`).\n\n- **Visitor Scope:** 30-minute interactive session isolated inside the Career Fest 2026 Observatory.\n- **Try Next:** Explore the 24 Divisions, run a query in SMART GRID AI, or analyze live spreadsheet formulas in SMART GRID SHEETS.",
    JSON.stringify(["Dhaka Air Quality Showcase Archive (HISTORICAL)", "Urban Microgrid Showcase (SIMULATED)"]),
    CAREER_FEST_USER_ID,
    CAREER_FEST_USER_ID,
    now,
    now
  );

  tx.prepare(
    `INSERT OR IGNORE INTO documents (id, organization_id, city_id, division_code, title, folder, category, mime_type, content_text, version, classification, uploaded_by, created_at, updated_at)
     VALUES ('doc_cf_guide', ?, ?, '01', 'SMART GRID Career Fest Visitor Charter & Provenance Guide', 'Showcase Guides', 'Charter', 'text/markdown', ?, 1, 'INTERNAL', ?, ?, ?)`
  ).run(
    CAREER_FEST_ORG_ID,
    dhakaId,
    "# Visitor Sandbox Charter\n\nAll Career Fest sessions automatically expire after 30 minutes. Administrative configuration, billing, API keys, and other organizations remain strictly unreachable.",
    CAREER_FEST_USER_ID,
    now,
    now
  );

  tx.prepare(
    `INSERT OR IGNORE INTO dashboards (id, organization_id, city_id, title, description, widgets_json, created_by, created_at, updated_at)
     VALUES ('dsh_cf_01', ?, ?, 'Career Fest 2026 Live Observatory Overview', 'Cross-division KPI and truthfulness composition for Career Fest visitors.', ?, ?, ?, ?)`
  ).run(
    CAREER_FEST_ORG_ID,
    dhakaId,
    JSON.stringify([
      { id: "w1", type: "KPI_CARD", title: "Mean PM2.5 (Historical Sample)", divisionCode: "05", metric: "PM2.5 Mean" },
      { id: "w2", type: "ALERT_FEED", title: "Showcase Data & Threshold Alerts", divisionCode: "ALL" },
    ]),
    CAREER_FEST_USER_ID,
    now,
    now
  );

  // Shared read-only starter template workbook (owner_session_id = NULL)
  tx.prepare(
    `INSERT OR IGNORE INTO workbooks (id, organization_id, city_id, division_code, owner_user_id, owner_session_id, title, description, folder, is_starred, data_status, created_at, updated_at)
     VALUES (?, ?, ?, '05', ?, NULL, 'Smart City Sustainability & Mobility Matrix (Showcase Template)', 'Read-only starter showcase workbook with live formulas (=SUM, =AVERAGE, =IF, =ROUND). Create a new workbook in SHEETS to save session-isolated edits.', 'Showcase Templates', 1, 'SIMULATED', ?, ?)`
  ).run(CAREER_FEST_STARTER_WORKBOOK_ID, CAREER_FEST_ORG_ID, dhakaId, CAREER_FEST_USER_ID, now, now);

  const starterCells = {
    A1: { raw: "Urban Zone" },
    B1: { raw: "PM2.5 (ug/m3)" },
    C1: { raw: "Target (ug/m3)" },
    D1: { raw: "Threshold Check" },
    E1: { raw: "Solar Share (%)" },
    A2: { raw: "Central Corridor" },
    B2: { raw: "61.2" },
    C2: { raw: "35" },
    D2: { raw: '=IF(B2>C2,"ABOVE","OK")' },
    E2: { raw: "22.4" },
    A3: { raw: "Transit District" },
    B3: { raw: "44.8" },
    C3: { raw: "35" },
    D3: { raw: '=IF(B3>C3,"ABOVE","OK")' },
    E3: { raw: "26.1" },
    A4: { raw: "Harbor Precinct" },
    B4: { raw: "30.5" },
    C4: { raw: "35" },
    D4: { raw: '=IF(B4>C4,"ABOVE","OK")' },
    E4: { raw: "19.8" },
    A5: { raw: "Summary Mean" },
    B5: { raw: "=ROUND(AVERAGE(B2:B4),2)" },
    C5: { raw: "=AVERAGE(C2:C4)" },
    D5: { raw: "=COUNT(B2:B4)" },
    E5: { raw: "=ROUND(AVERAGE(E2:E4),1)" },
  };
  tx.prepare(
    `INSERT OR IGNORE INTO workbook_sheets (id, workbook_id, name, sheet_order, cells_json, updated_at)
     VALUES ('sh_cf_starter', ?, 'Urban KPI Matrix', 0, ?, ?)`
  ).run(CAREER_FEST_STARTER_WORKBOOK_ID, JSON.stringify(starterCells), now);

  tx.prepare(
    `INSERT OR IGNORE INTO workbook_versions (id, workbook_id, version_number, snapshot_json, created_by, note, created_at)
     VALUES ('wbv_cf_01', ?, 1, ?, ?, 'Career Fest showcase starter baseline', ?)`
  ).run(
    CAREER_FEST_STARTER_WORKBOOK_ID,
    JSON.stringify([{ name: "Urban KPI Matrix", cells: starterCells }]),
    CAREER_FEST_USER_ID,
    now
  );

  tx.prepare(
    `INSERT OR REPLACE INTO seed_metadata (seed_key, seed_version, mode, applied_at)
     VALUES ('career_fest_seed', 1, 'showcase', ?)`
  ).run(now);
}

export function ensureSeeded(): void {
  if (seededInProcess) return;
  const db = getDb();
  const now = new Date().toISOString();

  const existingDivCount = db
    .prepare("SELECT COUNT(*) AS cnt FROM divisions")
    .get() as { cnt: number };

  if (existingDivCount && existingDivCount.cnt >= 24) {
    const hasMeta = db
      .prepare("SELECT 1 FROM seed_metadata WHERE seed_key = 'reference_taxonomy'")
      .get();
    if (!hasMeta) {
      db.prepare(
        `INSERT OR IGNORE INTO seed_metadata (seed_key, seed_version, mode, applied_at)
         VALUES ('reference_taxonomy', 1, 'core', ?)`
      ).run(now);
    }
    const hasCfMeta = db
      .prepare("SELECT 1 FROM seed_metadata WHERE seed_key = 'career_fest_seed'")
      .get();
    if (!hasCfMeta) {
      withTransaction((tx) => {
        seedCareerFestSandbox(tx, now);
      });
    }
    seededInProcess = true;
    return;
  }

  withTransaction((tx) => {
    // 1. Permissions & Roles
    const insPerm = tx.prepare(
      "INSERT OR IGNORE INTO permissions (code, module, description) VALUES (?, ?, ?)"
    );
    for (const p of PERMISSIONS) {
      insPerm.run(p.code, p.module, p.description);
    }

    const insRole = tx.prepare(
      "INSERT OR IGNORE INTO roles (code, name, description, is_system) VALUES (?, ?, ?, 1)"
    );
    const insRolePerm = tx.prepare(
      "INSERT OR IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)"
    );
    for (const r of SYSTEM_ROLES) {
      insRole.run(r.code, r.name, r.description);
      for (const perm of r.permissions) {
        insRolePerm.run(r.code, perm);
      }
    }

    // 2. All 24 Intelligence Divisions
    const insDiv = tx.prepare(
      `INSERT OR IGNORE INTO divisions (code, number, slug, name, category, purpose, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of DIVISIONS) {
      insDiv.run(d.code, d.number, d.slug, d.name, d.category, d.purpose, d.description);
    }

    // 3. Countries
    const countries = [
      ["JP", "Japan", "Asia-Pacific", "JPY", "Asia/Tokyo"],
      ["GB", "United Kingdom", "Europe", "GBP", "Europe/London"],
      ["SG", "Singapore", "Asia-Pacific", "SGD", "Asia/Singapore"],
      ["BD", "Bangladesh", "South Asia", "BDT", "Asia/Dhaka"],
      ["KE", "Kenya", "Africa", "KES", "Africa/Nairobi"],
      ["CA", "Canada", "North America", "CAD", "America/Toronto"],
      ["BR", "Brazil", "Latin America", "BRL", "America/Sao_Paulo"],
      ["US", "United States", "North America", "USD", "America/New_York"],
      ["DE", "Germany", "Europe", "EUR", "Europe/Berlin"],
    ];
    const insCountry = tx.prepare(
      "INSERT OR IGNORE INTO countries (code, name, region_group, default_currency, default_timezone) VALUES (?, ?, ?, ?, ?)"
    );
    for (const c of countries) {
      insCountry.run(c[0], c[1], c[2], c[3], c[4]);
    }

    // 4. Organizations & Demo Users (Local Evaluation Mode)
    const orgId = "org_demo_global";
    const partnerOrgId = "org_partner_metro";
    tx.prepare(
      `INSERT OR IGNORE INTO organizations (id, slug, name, org_type, country_code, verification_status, plan_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'VERIFIED', 'ENTERPRISE', ?, ?)`
    ).run(orgId, "global-urban-observatory", "Global Urban Observatory (Evaluation)", "MUNICIPAL_NETWORK", "GLOBAL", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO organizations (id, slug, name, org_type, country_code, verification_status, plan_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'VERIFIED', 'PROFESSIONAL', ?, ?)`
    ).run(partnerOrgId, "metro-resilience-lab", "Metro Resilience Lab (Isolated Tenant)", "RESEARCH_INSTITUTE", "CA", now, now);

    tx.prepare(
      "INSERT OR IGNORE INTO workspaces (id, organization_id, name, slug, description, status, created_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)"
    ).run("ws_demo_main", orgId, "Primary Operations Workspace", "primary-ops", "Default evaluation workspace across 24 intelligence divisions.", now);

    tx.prepare(
      "INSERT OR IGNORE INTO subscriptions (id, organization_id, plan_code, status, seat_limit, storage_limit_mb, ai_monthly_quota, current_period_start, current_period_end) VALUES (?, ?, 'ENTERPRISE', 'ACTIVE', 50, 10240, 1000, ?, ?)"
    ).run("sub_demo_1", orgId, now, new Date(Date.now() + 30 * 86400_000).toISOString());
    tx.prepare(
      "INSERT OR IGNORE INTO subscriptions (id, organization_id, plan_code, status, seat_limit, storage_limit_mb, ai_monthly_quota, current_period_start, current_period_end) VALUES (?, ?, 'GROWTH', 'ACTIVE', 20, 2048, 250, ?, ?)"
    ).run("sub_partner_1", "org_partner_metro", now, new Date(Date.now() + 30 * 86400_000).toISOString());

    const allowDemo = isDemoModeEnabled();

    tx.prepare(
      `INSERT OR REPLACE INTO seed_metadata (seed_key, seed_version, mode, applied_at)
       VALUES ('reference_taxonomy', 1, 'core', ?)`
    ).run(now);

    if (allowDemo) {
      const demoUsers: [string, string, string, string, string, string, string][] = [
        ["usr_demo_admin", "admin@smartgrid.local", "SmartGrid!Admin2026", "Amina Rahman", "Chief Urban Systems Architect", orgId, "ORG_OWNER"],
        ["usr_demo_analyst", "analyst@smartgrid.local", "SmartGrid!Analyst2026", "Kenji Sato", "Senior Mobility & GIS Analyst", orgId, "DATA_ANALYST"],
        ["usr_demo_viewer", "viewer@smartgrid.local", "SmartGrid!Viewer2026", "Clara Mensah", "Municipal Oversight Viewer", orgId, "VIEWER"],
        ["usr_partner_admin", "partner@smartgrid.local", "SmartGrid!Partner2026", "Liam Vance", "Director, Metro Resilience Lab", partnerOrgId, "ORG_OWNER"],
      ];
      const insUser = tx.prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, full_name, job_title, locale, timezone, status, mfa_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'en', 'UTC', 'ACTIVE', 0, ?, ?)`
      );
      const insMem = tx.prepare(
        `INSERT OR IGNORE INTO organization_memberships (id, organization_id, user_id, role_code, department, status, created_at)
         VALUES (?, ?, ?, ?, 'Platform Operations', 'ACTIVE', ?)`
      );
      for (const u of demoUsers) {
        insUser.run(u[0], u[1], hashPassword(u[2]), u[3], u[4], now, now);
        insMem.run(`mem_${u[0]}`, u[5], u[0], u[6], now);
      }
    } else if (
      process.env.SMART_GRID_BOOTSTRAP_ADMIN_EMAIL &&
      process.env.SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD
    ) {
      const bEmail = process.env.SMART_GRID_BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
      const bPass = process.env.SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD;
      const bName = process.env.SMART_GRID_BOOTSTRAP_ADMIN_NAME?.trim() || "System Administrator";
      tx.prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, full_name, job_title, locale, timezone, status, mfa_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'Chief System Administrator', 'en', 'UTC', 'ACTIVE', 0, ?, ?)`
      ).run("usr_bootstrap_admin", bEmail, hashPassword(bPass), bName, now, now);
      tx.prepare(
        `INSERT OR IGNORE INTO organization_memberships (id, organization_id, user_id, role_code, department, status, created_at)
         VALUES (?, ?, ?, 'ORG_OWNER', 'Executive Administration', 'ACTIVE', ?)`
      ).run("mem_bootstrap_admin", orgId, "usr_bootstrap_admin", now);
    }

    // 5. Sample Cities (Public & Evaluation — clearly labeled SIMULATED/HISTORICAL)
    const sampleCities = [
      {
        id: "city_tokyo",
        orgId,
        slug: "tokyo",
        name: "Tokyo",
        localName: "東京都",
        country: "JP",
        region: "Kanto",
        lat: 35.6762,
        lng: 139.6503,
        tz: "Asia/Tokyo",
        currency: "JPY",
        pop: 14094034,
        popSrc: "Reference statistical benchmark (Sample/Historical)",
        area: 2194.07,
        readiness: 82,
        status: "HISTORICAL",
        isPublic: 1,
        summary: "Reference metropolitan profile demonstrating multi-division transit, seismic resilience, and energy demand indicators using clearly labeled historical/sample records.",
      },
      {
        id: "city_singapore",
        orgId,
        slug: "singapore",
        name: "Singapore",
        localName: "Singapura",
        country: "SG",
        region: "Central Region",
        lat: 1.3521,
        lng: 103.8198,
        tz: "Asia/Singapore",
        currency: "SGD",
        pop: 5917600,
        popSrc: "Reference statistical benchmark (Sample/Historical)",
        area: 734.3,
        readiness: 86,
        status: "SIMULATED",
        isPublic: 1,
        summary: "Evaluation city profile covering water resilience, green-building benchmarking, and transit accessibility modeling with simulated baseline records.",
      },
      {
        id: "city_london",
        orgId,
        slug: "london",
        name: "London",
        localName: "Greater London",
        country: "GB",
        region: "Greater London",
        lat: 51.5072,
        lng: -0.1276,
        tz: "Europe/London",
        currency: "GBP",
        pop: 8866180,
        popSrc: "Reference statistical benchmark (Sample/Historical)",
        area: 1572.0,
        readiness: 79,
        status: "HISTORICAL",
        isPublic: 1,
        summary: "Reference profile illustrating air-quality corridors, low-emission zones, and public transit headway tracking with historical sample data.",
      },
      {
        id: "city_dhaka",
        orgId,
        slug: "dhaka",
        name: "Dhaka",
        localName: "ঢাকা",
        country: "BD",
        region: "Dhaka Division",
        lat: 23.8103,
        lng: 90.4125,
        tz: "Asia/Dhaka",
        currency: "BDT",
        pop: 10295786,
        popSrc: "Reference statistical benchmark (Sample/Historical)",
        area: 306.4,
        readiness: 64,
        status: "SIMULATED",
        isPublic: 1,
        summary: "Rapid-growth South Asian megacity evaluation profile focusing on monsoon flood risk, urban drainage, transit corridors, and air quality.",
      },
      {
        id: "city_nairobi",
        orgId,
        slug: "nairobi",
        name: "Nairobi",
        localName: "Nairobi City",
        country: "KE",
        region: "Nairobi County",
        lat: -1.2921,
        lng: 36.8219,
        tz: "Africa/Nairobi",
        currency: "KES",
        pop: 4750000,
        popSrc: "Reference statistical benchmark (Sample/Historical)",
        area: 696.1,
        readiness: 68,
        status: "SIMULATED",
        isPublic: 1,
        summary: "East African urban hub evaluation profile covering water distribution, informal-settlement connectivity, and solar microgrid readiness.",
      },
      {
        id: "city_toronto",
        orgId: partnerOrgId,
        slug: "toronto",
        name: "Toronto",
        localName: "City of Toronto",
        country: "CA",
        region: "Ontario",
        lat: 43.6532,
        lng: -79.3832,
        tz: "America/Toronto",
        currency: "CAD",
        pop: 2794356,
        popSrc: "Reference statistical benchmark (Sample/Historical)",
        area: 630.2,
        readiness: 77,
        status: "SIMULATED",
        isPublic: 1,
        summary: "North American lakefront city profile assigned to Metro Resilience Lab demonstrating tenant-isolated operational data.",
      },
    ];

    const insCity = tx.prepare(
      `INSERT OR IGNORE INTO cities (
        id, organization_id, slug, name, local_name, country_code, region_name,
        latitude, longitude, timezone, currency, population, population_source,
        area_km2, readiness_score, data_status, is_public, boundary_geojson, summary,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insArea = tx.prepare(
      "INSERT OR IGNORE INTO administrative_areas (id, city_id, parent_id, name, area_type, population) VALUES (?, ?, NULL, ?, ?, ?)"
    );

    for (const c of sampleCities) {
      const box = [
        [c.lng - 0.12, c.lat - 0.08],
        [c.lng + 0.12, c.lat - 0.08],
        [c.lng + 0.12, c.lat + 0.08],
        [c.lng - 0.12, c.lat + 0.08],
        [c.lng - 0.12, c.lat - 0.08],
      ];
      const geojson = JSON.stringify({
        type: "Feature",
        properties: { name: `${c.name} Sample Boundary`, simulated: true },
        geometry: { type: "Polygon", coordinates: [box] },
      });
      insCity.run(
        c.id, c.orgId, c.slug, c.name, c.localName, c.country, c.region,
        c.lat, c.lng, c.tz, c.currency, c.pop, c.popSrc, c.area, c.readiness,
        c.status, c.isPublic, geojson, c.summary, now, now
      );
      insArea.run(`area_${c.id}_central`, c.id, `${c.name} Central District`, "District", Math.round(c.pop * 0.22));
      insArea.run(`area_${c.id}_north`, c.id, `${c.name} North Sector`, "Zone", Math.round(c.pop * 0.18));
    }

    // 6. Data Sources (Honest INTEGRATION_REQUIRED & HISTORICAL)
    const sources: [string, string, string, string, string, string, string, string, string][] = [
      ["src_gtfs_tokyo", orgId, "city_tokyo", "04", "Metropolitan Transit GTFS Feed", "Transit Authority Connector", "REST_API", "INTEGRATION_REQUIRED", "Requires agency API key and static GTFS bundle URL."],
      ["src_aq_dhaka", orgId, "city_dhaka", "05", "Dhaka Air Quality Reference Archive", "Evaluation CSV Import", "CSV_UPLOAD", "HISTORICAL", "Contains sample historical particulate observations; live telemetry requires station API credentials."],
      ["src_grid_singapore", orgId, "city_singapore", "07", "Energy Substation Telemetry Connector", "Utility SCADA Bridge (Read-Only)", "REST_API", "INTEGRATION_REQUIRED", "Read-only telemetry endpoint not configured; no credentials stored."],
      ["src_weather_london", orgId, "city_london", "06", "London Meteorological Sample Series", "Evaluation Weather Adapter", "JSON_UPLOAD", "SIMULATED", "Simulated weather baseline for analytics testing."],
      ["src_toronto_lab", partnerOrgId, "city_toronto", "10", "Lakefront Flood Hazard Connector", "Regional GIS Service", "GEOJSON", "SIMULATED", "Partner-isolated hazard polygon dataset."],
    ];
    const insSource = tx.prepare(
      `INSERT OR IGNORE INTO data_sources (
        id, organization_id, city_id, division_code, name, provider, category,
        connection_type, auth_type, has_credentials, data_format, update_frequency,
        license, status, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'URBAN_DATA', ?, 'API_KEY', 0, 'JSON', 'HOURLY', 'Evaluation / Open Reference', ?, ?, ?, ?)`
    );
    for (const s of sources) {
      insSource.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], now, now);
    }

    // 7. Datasets
    const datasets: [string, string, string, string, string, string, string, string, string, number, number, number][] = [
      ["ds_tokyo_transit", orgId, "city_tokyo", "04", "src_gtfs_tokyo", "Metropolitan Rail Headway Sample", "Sample corridor headway and accessibility summary by station group.", "PUBLIC", "SIMULATED", 48, 94.5, 1],
      ["ds_dhaka_aq", orgId, "city_dhaka", "05", "src_aq_dhaka", "Dhaka PM2.5 & NO2 Historical Sample", "Historical reference series for evaluation of environmental alerts and Sheets imports.", "PUBLIC", "HISTORICAL", 120, 91.2, 1],
      ["ds_london_traffic", orgId, "city_london", "03", "src_weather_london", "Central Corridor Speed Benchmark", "Simulated hourly corridor speeds and congestion index for division evaluation.", "INTERNAL", "SIMULATED", 72, 96.0, 0],
      ["ds_singapore_water", orgId, "city_singapore", "08", "src_grid_singapore", "Water Distribution Quality Sample", "Sample turbidity and pressure compliance table across zones.", "INTERNAL", "SIMULATED", 36, 98.1, 0],
      ["ds_toronto_flood", partnerOrgId, "city_toronto", "10", "src_toronto_lab", "Toronto Floodplain Exposure Register", "Isolated partner tenant dataset — must never leak to Global Urban Observatory.", "CONFIDENTIAL", "SIMULATED", 24, 95.0, 0],
    ];
    const insDs = tx.prepare(
      `INSERT OR IGNORE INTO datasets (
        id, organization_id, city_id, division_code, source_id, name, description,
        classification, data_status, schema_json, row_count, quality_score,
        unit_system, limitations, is_public_published, last_validated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'METRIC', 'Evaluation dataset — not live city production telemetry.', ?, ?, ?, ?)`
    );
    const defaultSchema = JSON.stringify([
      { name: "observed_at", type: "datetime" },
      { name: "metric_name", type: "string" },
      { name: "metric_value", type: "number" },
      { name: "unit", type: "string" },
    ]);
    for (const d of datasets) {
      insDs.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], defaultSchema, d[9], d[10], d[11], now, now, now);
    }

    // 8. KPI Definitions across all 24 divisions
    const insKpi = tx.prepare(
      `INSERT OR IGNORE INTO kpi_definitions (id, organization_id, division_code, code, name, description, formula_text, unit, target_value, is_standardized, limitations)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, 1, 'Standardized SMART GRID indicator; verify unit compatibility before cross-city comparison.')`
    );
    for (const d of DIVISIONS) {
      for (const k of d.kpis) {
        insKpi.run(`kpi_${k.code}`, d.code, k.code, k.name, k.description, `AVG(${k.code})`, k.unit);
      }
    }

    // 9. Sample Observations (Truthfully tagged SIMULATED / HISTORICAL)
    const insObs = tx.prepare(
      `INSERT OR IGNORE INTO observations (
        id, organization_id, city_id, division_code, dataset_id, kpi_code, metric_name,
        metric_value, unit, data_status, observed_at, source_name, quality_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID')`
    );
    const baseTime = Date.now();
    for (let i = 0; i < 7; i++) {
      const ts = new Date(baseTime - (6 - i) * 86400_000).toISOString();
      insObs.run(`obs_aq_${i}`, orgId, "city_dhaka", "05", "ds_dhaka_aq", "ENV-01", "PM2.5 Mean", 58 + i * 3.2, "ug/m3", "HISTORICAL", "Dhaka Air Quality Reference Archive", ts);
      insObs.run(`obs_trf_${i}`, orgId, "city_london", "03", "ds_london_traffic", "TRF-01", "Corridor Speed", 28.4 - (i % 3) * 1.9, "km/h", "SIMULATED", "Central Corridor Speed Benchmark", ts);
      insObs.run(`obs_eng_${i}`, orgId, "city_singapore", "07", "ds_singapore_water", "ENG-01", "Renewable Share", 19.5 + i * 0.4, "%", "SIMULATED", "Evaluation Grid Profile", ts);
      insObs.run(`obs_trn_${i}`, orgId, "city_tokyo", "04", "ds_tokyo_transit", "TRN-01", "On-Time Adherence", 97.8 + (i % 2) * 0.3, "%", "SIMULATED", "Metropolitan Rail Headway Sample", ts);
    }

    // 10. Sample Assets, Sensors, Projects, Work Orders, Incidents, Alerts, City Events
    tx.prepare(
      `INSERT OR IGNORE INTO assets (id, organization_id, city_id, division_code, asset_tag, name, asset_type, condition_status, operational_status, latitude, longitude, owner_department, data_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SIMULATED', ?, ?)`
    ).run("ast_dhaka_pump_01", orgId, "city_dhaka", "08", "WAT-DHK-001", "Hatirjheel Stormwater Pump Station A", "Pumping Station", "FAIR", "OPERATIONAL", 23.7511, 90.4043, "Water & Drainage", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO assets (id, organization_id, city_id, division_code, asset_tag, name, asset_type, condition_status, operational_status, latitude, longitude, owner_department, data_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SIMULATED', ?, ?)`
    ).run("ast_tokyo_sub_01", orgId, "city_tokyo", "07", "ENG-TYO-014", "Chiyoda District Substation B", "Electrical Substation", "GOOD", "OPERATIONAL", 35.694, 139.753, "Grid Operations", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO sensors (id, organization_id, city_id, division_code, asset_id, device_code, name, measurement_type, unit, latitude, longitude, health_status, data_status, last_observation_at, calibrated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INTEGRATION_REQUIRED', 'INTEGRATION_REQUIRED', NULL, ?, ?)`
    ).run("sen_dhk_pm25", orgId, "city_dhaka", "05", null, "AQ-DHK-102", "Motijheel Roadside Particulate Node", "PM2.5", "ug/m3", 23.733, 90.417, now, now);

    if (allowDemo) {
      tx.prepare(
        `INSERT OR IGNORE INTO projects (id, organization_id, city_id, division_code, title, description, status, progress_pct, budget_amount, spent_amount, currency, owner_user_id, start_date, target_end_date, latitude, longitude, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', 62, 4200000, 2450000, 'USD', 'usr_demo_admin', '2026-03-01', '2027-02-15', 23.7511, 90.4043, ?, ?)`
      ).run("prj_dhk_drainage", orgId, "city_dhaka", "10", "Stormwater Pump Telemetry Modernization", "Upgrading urban flood pumping stations with automated water-level sensors and maintenance workflows.", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO work_orders (id, organization_id, city_id, division_code, asset_id, title, description, priority, maintenance_type, status, assigned_to, due_date, estimated_cost, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'HIGH', 'PREVENTIVE', 'OPEN', 'Drainage Field Unit B', '2026-11-25', 14500, 'usr_demo_admin', ?, ?)`
    ).run("wo_dhk_001", orgId, "city_dhaka", "08", "ast_dhaka_pump_01", "Pre-monsoon impeller & backup generator inspection", "Verify standby diesel generator load transfer and clear intake grates.", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO incidents (id, organization_id, city_id, division_code, asset_id, title, description, severity, status, latitude, longitude, reported_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'MEDIUM', 'INVESTIGATING', 51.513, -0.131, 'usr_demo_analyst', ?, ?)`
    ).run("inc_ldn_001", orgId, "city_london", "03", null, "Oxford Street Westbound Signal Timing Anomaly", "Simulated sample incident representing recurring peak-hour signal phase desynchronization.", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO alerts (id, organization_id, city_id, division_code, title, message, alert_type, priority, status, data_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'DATA_FRESHNESS', 'HIGH', 'ACTIVE', 'INTEGRATION_REQUIRED', ?, ?)`
    ).run("alt_gtfs_01", orgId, "city_tokyo", "04", "GTFS-Realtime Feed Credentials Required", "Metropolitan Transit GTFS connector is registered without active API credentials. Historical sample data is shown.", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO alerts (id, organization_id, city_id, division_code, title, message, alert_type, priority, status, data_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'THRESHOLD', 'MEDIUM', 'ACTIVE', 'HISTORICAL', ?, ?)`
    ).run("alt_aq_02", orgId, "city_dhaka", "05", "Historical PM2.5 Reference Threshold Exceeded", "Sample historical observation exceeded 55 ug/m3 benchmark in evaluation dataset.", now, now);

    tx.prepare(
      `INSERT OR IGNORE INTO city_events (id, organization_id, city_id, division_code, title, category, description, source_name, verification_status, latitude, longitude, occurred_at)
       VALUES (?, ?, ?, ?, ?, 'INFRASTRUCTURE', ?, 'Evaluation Log', 'SIMULATED', 23.7511, 90.4043, ?)`
    ).run("evt_dhk_01", orgId, "city_dhaka", "08", "Drainage Pump Station Scheduled Maintenance Window", "Evaluation timeline event linked to WO-DHK-001.", now);

    // 11. Workflows & Workflow Runs
    tx.prepare(
      `INSERT OR IGNORE INTO workflows (id, organization_id, name, description, trigger_type, steps_json, status, created_at)
       VALUES (?, ?, 'Maintenance & Report Publication Approval', 'Two-step verification workflow for operational work orders and public report releases.', 'MANUAL_OR_THRESHOLD', ?, 'PUBLISHED', ?)`
    ).run(
      "wf_approval_std",
      orgId,
      JSON.stringify([
        { step: 1, name: "Division Manager Technical Check", role: "DIVISION_MANAGER" },
        { step: 2, name: "Organization / City Admin Final Approval", role: "ORG_ADMIN" },
      ]),
      now
    );

    tx.prepare(
      `INSERT OR IGNORE INTO workflow_runs (id, organization_id, workflow_id, target_entity_type, target_entity_id, current_step, status, requested_by, created_at, updated_at)
       VALUES (?, ?, 'wf_approval_std', 'WORK_ORDER', 'wo_dhk_001', 1, 'PENDING_APPROVAL', 'usr_demo_analyst', ?, ?)`
    ).run("wfr_001", orgId, now, now);

    // 12. Starter SMART GRID SHEETS Workbook
    tx.prepare(
      `INSERT OR IGNORE INTO workbooks (id, organization_id, city_id, division_code, owner_user_id, title, description, folder, is_starred, data_status, created_at, updated_at)
       VALUES (?, ?, 'city_dhaka', '05', 'usr_demo_admin', 'Urban Air & Energy Evaluation Model', 'Interactive multi-sheet evaluation workbook with live formulas (=SUM, =AVERAGE, =IF, =ROUND).', 'My Files', 1, 'SIMULATED', ?, ?)`
    ).run("wb_eval_01", orgId, now, now);

    const sheetCells = {
      A1: { raw: "District" },
      B1: { raw: "PM2.5 (ug/m3)" },
      C1: { raw: "Target (ug/m3)" },
      D1: { raw: "Exceeds Target" },
      E1: { raw: "Renewable Share (%)" },
      A2: { raw: "Central Ward" },
      B2: { raw: "62.4" },
      C2: { raw: "35" },
      D2: { raw: '=IF(B2>C2,"ABOVE","OK")' },
      E2: { raw: "21.5" },
      A3: { raw: "North Sector" },
      B3: { raw: "48.2" },
      C3: { raw: "35" },
      D3: { raw: '=IF(B3>C3,"ABOVE","OK")' },
      E3: { raw: "24.8" },
      A4: { raw: "Harbor Zone" },
      B4: { raw: "31.0" },
      C4: { raw: "35" },
      D4: { raw: '=IF(B4>C4,"ABOVE","OK")' },
      E4: { raw: "18.2" },
      A5: { raw: "Summary Mean" },
      B5: { raw: "=ROUND(AVERAGE(B2:B4),2)" },
      C5: { raw: "=AVERAGE(C2:C4)" },
      D5: { raw: '=COUNT(B2:B4)' },
      E5: { raw: "=ROUND(AVERAGE(E2:E4),1)" },
    };

    tx.prepare(
      `INSERT OR IGNORE INTO workbook_sheets (id, workbook_id, name, sheet_order, cells_json, updated_at)
       VALUES (?, 'wb_eval_01', 'Air & Energy Matrix', 0, ?, ?)`
    ).run("sh_eval_01", JSON.stringify(sheetCells), now);

    tx.prepare(
      `INSERT OR IGNORE INTO workbook_versions (id, workbook_id, version_number, snapshot_json, created_by, note, created_at)
       VALUES (?, 'wb_eval_01', 1, ?, 'usr_demo_admin', 'Initial evaluation baseline', ?)`
    ).run("wbv_01", JSON.stringify([{ name: "Air & Energy Matrix", cells: sheetCells }]), now);

    // 13. Sample Report, GIS Layer, Scenario, Vendor, Contract, Calendar, Team Message
    tx.prepare(
      `INSERT OR IGNORE INTO reports (id, organization_id, city_id, division_code, title, report_type, status, content_markdown, sources_json, is_public, created_by, approved_by, created_at, updated_at)
       VALUES (?, ?, 'city_dhaka', '05', 'Dhaka Air Quality & Drainage Readiness Brief (Sample)', 'DIVISION', 'PUBLISHED', ?, ?, 1, 'usr_demo_analyst', 'usr_demo_admin', ?, ?)`
    ).run(
      "rep_dhk_sample",
      orgId,
      "## Executive Summary\n\nThis published evaluation brief illustrates how SMART GRID structures division reports with explicit source citations and data-status disclosures.\n\n- **Data Status:** `HISTORICAL` / `SIMULATED` (No live telemetry connected).\n- **Observed Sample Trend:** PM2.5 benchmark sample averaged above 55 ug/m3 across historical evaluation records.\n- **Limitations:** Sample evaluation records only; connect an authorized environmental monitoring API in Integration Hub for live values.",
      JSON.stringify(["Dhaka Air Quality Reference Archive (HISTORICAL)"]),
      now,
      now
    );

    tx.prepare(
      `INSERT OR IGNORE INTO gis_layers (id, organization_id, city_id, division_code, name, layer_type, crs, source_name, data_status, geojson, created_at)
       VALUES (?, ?, 'city_dhaka', '02', 'Critical Stormwater & AQ Nodes (Sample)', 'POINT_COLLECTION', 'EPSG:4326', 'SMART GRID Evaluation Spatial Seed', 'SIMULATED', ?, ?)`
    ).run(
      "gis_dhk_nodes",
      orgId,
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { name: "Hatirjheel Pump A", division: "08", status: "OPERATIONAL" }, geometry: { type: "Point", coordinates: [90.4043, 23.7511] } },
          { type: "Feature", properties: { name: "Motijheel AQ Node", division: "05", status: "INTEGRATION_REQUIRED" }, geometry: { type: "Point", coordinates: [90.417, 23.733] } },
          { type: "Feature", properties: { name: "Uttara Civic Substation", division: "07", status: "OPERATIONAL" }, geometry: { type: "Point", coordinates: [90.398, 23.875] } },
        ],
      }),
      now
    );

    tx.prepare(
      `INSERT OR IGNORE INTO scenarios (id, organization_id, city_id, division_code, name, description, baseline_label, parameters_json, results_json, assumptions, status, created_by, created_at)
       VALUES (?, ?, 'city_singapore', '07', 'Solar Roof +25% Modeled Scenario', 'Hypothetical grid peak-load reduction estimate from 25% civic rooftop solar expansion.', '2026 Simulated Baseline', ?, ?, 'Modeled estimate only; assumes 14% average capacity factor and existing feeder limits.', 'REVIEWED', 'usr_demo_analyst', ?)`
    ).run(
      "scn_sg_solar",
      orgId,
      JSON.stringify({ rooftopSolarIncreasePct: 25, batteryStorageMwh: 40 }),
      JSON.stringify({ estimatedPeakReductionPct: 8.4, estimatedAnnualCo2AvoidedTons: 12400, modeledEstimate: true }),
      now
    );

    tx.prepare(
      `INSERT OR IGNORE INTO vendors (id, organization_id, name, category, compliance_status, contact_email, created_at)
       VALUES ('vnd_01', ?, 'Aegis Urban Telemetry Systems (Sample)', 'Sensor & Telemetry Hardware', 'VERIFIED', 'procurement-sample@example.invalid', ?)`
    ).run(orgId, now);

    tx.prepare(
      `INSERT OR IGNORE INTO contracts (id, organization_id, city_id, vendor_id, title, contract_value, currency, status, end_date, created_at)
       VALUES ('ctr_01', ?, 'city_dhaka', 'vnd_01', 'Pump Station Telemetry Integration Pilot', 185000, 'USD', 'ACTIVE', '2027-06-30', ?)`
    ).run(orgId, now);

    tx.prepare(
      `INSERT OR IGNORE INTO calendar_events (id, organization_id, city_id, division_code, title, event_type, start_at, end_at, location, created_by)
       VALUES ('cal_01', ?, 'city_dhaka', '08', 'Hatirjheel Pump Preventive Inspection', 'MAINTENANCE', ?, ?, 'Hatirjheel Sector A', 'usr_demo_admin')`
    ).run(orgId, new Date(Date.now() + 2 * 86400_000).toISOString(), new Date(Date.now() + 2 * 86400_000 + 7200_000).toISOString());

    tx.prepare(
      `INSERT OR IGNORE INTO team_messages (id, organization_id, city_id, channel, author_id, author_name, body, created_at)
       VALUES ('msg_01', ?, 'city_dhaka', 'operations', 'usr_demo_admin', 'Amina Rahman', 'Evaluation workspace initialized. Remember: all sample feeds are labeled SIMULATED or HISTORICAL until live agency credentials are connected.', ?)`
    ).run(orgId, now);

    tx.prepare(
      `INSERT OR IGNORE INTO documents (id, organization_id, city_id, division_code, title, folder, category, mime_type, content_text, version, classification, uploaded_by, created_at, updated_at)
       VALUES ('doc_01', ?, 'city_dhaka', '01', 'SMART GRID Data Truthfulness & Governance Policy', 'Governance', 'Policy', 'text/markdown', ?, 1, 'INTERNAL', 'usr_demo_admin', ?, ?)`
    ).run(
      orgId,
      "# Data Truthfulness Policy\n\nEvery dataset in SMART GRID must declare its status (LIVE, HISTORICAL, SIMULATED, INTEGRATION_REQUIRED, STALE, or UNAVAILABLE), owner, unit system, and known limitations.",
      now,
      now
    );

    tx.prepare(
      `INSERT OR IGNORE INTO dashboards (id, organization_id, city_id, title, description, widgets_json, created_by, created_at, updated_at)
       VALUES ('dsh_01', ?, 'city_dhaka', 'Executive Urban Resilience Overview', 'Cross-division KPI and alert composition.', ?, 'usr_demo_admin', ?, ?)`
    ).run(
      orgId,
      JSON.stringify([
        { id: "w1", type: "KPI_CARD", title: "Mean PM2.5 (Historical Sample)", divisionCode: "05", metric: "PM2.5 Mean" },
        { id: "w2", type: "ALERT_FEED", title: "Active Data & Threshold Alerts", divisionCode: "ALL" },
        { id: "w3", type: "PROJECT_PROGRESS", title: "Active Capital Projects", divisionCode: "10" },
      ]),
      now,
      now
    );

    tx.prepare(
      `INSERT OR IGNORE INTO notifications (id, organization_id, user_id, title, body, category, link_url, is_read, created_at)
       VALUES ('ntf_01', ?, 'usr_demo_admin', 'Pending Workflow Approval', 'Work Order wo_dhk_001 is awaiting Step 1 approval in Workflow Manager.', 'APPROVAL', '/app/workflows', 0, ?)`
    ).run(orgId, now);

    tx.prepare(
      `INSERT OR REPLACE INTO seed_metadata (seed_key, seed_version, mode, applied_at)
       VALUES ('demo_seed', 1, 'demo', ?)`
    ).run(now);
    }

    // Always seed isolated Career Fest 2026 Showcase org & visitor account cleanly
    seedCareerFestSandbox(tx, now);
  });

  seededInProcess = true;
}
