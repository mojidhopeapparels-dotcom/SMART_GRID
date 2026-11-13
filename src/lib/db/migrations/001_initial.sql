-- SMART GRID Initial Relational & Spatial Metadata Schema (SQLite / PostgreSQL-compatible SQL)
-- Migration 001

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- 1. Identity & Security
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  job_title TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED', 'LOCKED')),
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  mfa_secret TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'MUNICIPALITY',
  country_code TEXT NOT NULL DEFAULT 'GLOBAL',
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'SUSPENDED')),
  plan_code TEXT NOT NULL DEFAULT 'STARTER',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, slug)
);

CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES roles(code),
  department TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED')),
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  active_city_id TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

-- 2. Global City Hierarchy
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region_group TEXT NOT NULL,
  default_currency TEXT NOT NULL,
  default_timezone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  local_name TEXT,
  country_code TEXT NOT NULL REFERENCES countries(code),
  region_name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timezone TEXT NOT NULL,
  currency TEXT NOT NULL,
  measurement_system TEXT NOT NULL DEFAULT 'METRIC',
  population INTEGER,
  population_source TEXT,
  area_km2 REAL,
  readiness_score INTEGER NOT NULL DEFAULT 0,
  data_status TEXT NOT NULL DEFAULT 'SIMULATED',
  is_public INTEGER NOT NULL DEFAULT 0,
  boundary_geojson TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS administrative_areas (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES administrative_areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  area_type TEXT NOT NULL,
  population INTEGER,
  geometry_geojson TEXT
);

-- 3. The 24 Intelligence Divisions
CREATE TABLE IF NOT EXISTS divisions (
  code TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  purpose TEXT NOT NULL,
  description TEXT NOT NULL
);

-- 4. Data Platform, Sources, Catalog & Integrations
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  division_code TEXT REFERENCES divisions(code),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  endpoint_ref TEXT,
  auth_type TEXT NOT NULL DEFAULT 'API_KEY',
  has_credentials INTEGER NOT NULL DEFAULT 0,
  data_format TEXT NOT NULL DEFAULT 'JSON',
  update_frequency TEXT NOT NULL DEFAULT 'DAILY',
  license TEXT NOT NULL DEFAULT 'Unspecified',
  status TEXT NOT NULL DEFAULT 'INTEGRATION_REQUIRED',
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  division_code TEXT REFERENCES divisions(code),
  source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')),
  data_status TEXT NOT NULL DEFAULT 'SIMULATED',
  schema_json TEXT NOT NULL DEFAULT '[]',
  row_count INTEGER NOT NULL DEFAULT 0,
  quality_score REAL NOT NULL DEFAULT 0,
  unit_system TEXT,
  limitations TEXT,
  is_public_published INTEGER NOT NULL DEFAULT 0,
  last_validated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  records_ingested INTEGER NOT NULL DEFAULT 0,
  records_rejected INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

-- 5. KPIs & Time-Series Observations
CREATE TABLE IF NOT EXISTS kpi_definitions (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  formula_text TEXT NOT NULL,
  unit TEXT NOT NULL,
  target_value REAL,
  is_standardized INTEGER NOT NULL DEFAULT 1,
  limitations TEXT
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  dataset_id TEXT REFERENCES datasets(id) ON DELETE SET NULL,
  kpi_code TEXT,
  sensor_id TEXT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  unit TEXT NOT NULL,
  data_status TEXT NOT NULL DEFAULT 'SIMULATED',
  observed_at TEXT NOT NULL,
  source_name TEXT NOT NULL,
  quality_flag TEXT NOT NULL DEFAULT 'VALID'
);

-- 6. Operations: Assets, Sensors, Projects, Work Orders, Incidents, Events, Alerts
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  asset_tag TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  condition_status TEXT NOT NULL DEFAULT 'GOOD',
  operational_status TEXT NOT NULL DEFAULT 'OPERATIONAL',
  latitude REAL,
  longitude REAL,
  owner_department TEXT,
  data_status TEXT NOT NULL DEFAULT 'SIMULATED',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sensors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  device_code TEXT NOT NULL,
  name TEXT NOT NULL,
  measurement_type TEXT NOT NULL,
  unit TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  health_status TEXT NOT NULL DEFAULT 'OFFLINE',
  data_status TEXT NOT NULL DEFAULT 'INTEGRATION_REQUIRED',
  last_observation_at TEXT,
  calibrated_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  progress_pct INTEGER NOT NULL DEFAULT 0,
  budget_amount REAL NOT NULL DEFAULT 0,
  spent_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  start_date TEXT,
  target_end_date TEXT,
  latitude REAL,
  longitude REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  maintenance_type TEXT NOT NULL DEFAULT 'PREVENTIVE',
  status TEXT NOT NULL DEFAULT 'OPEN',
  assigned_to TEXT,
  due_date TEXT,
  estimated_cost REAL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'OPEN',
  latitude REAL,
  longitude REAL,
  reported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS city_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  source_name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'SIMULATED',
  latitude REAL,
  longitude REAL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'THRESHOLD',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
  data_status TEXT NOT NULL DEFAULT 'SIMULATED',
  acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 7. Workflows, Approvals & Notifications
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED')),
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'SYSTEM',
  link_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 8. SMART GRID SHEETS
CREATE TABLE IF NOT EXISTS workbooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  division_code TEXT REFERENCES divisions(code),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  folder TEXT NOT NULL DEFAULT 'My Files',
  is_starred INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  data_status TEXT NOT NULL DEFAULT 'SIMULATED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workbook_sheets (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sheet_order INTEGER NOT NULL DEFAULT 0,
  is_protected INTEGER NOT NULL DEFAULT 0,
  cells_json TEXT NOT NULL DEFAULT '{}',
  column_widths_json TEXT NOT NULL DEFAULT '{}',
  transformations_json TEXT NOT NULL DEFAULT '[]',
  charts_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workbook_versions (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

-- 9. Reports, Dashboards, Documents, GIS Layers & Scenarios
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  division_code TEXT REFERENCES divisions(code),
  title TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'DIVISION',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED')),
  content_markdown TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  is_public INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  widgets_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  division_code TEXT REFERENCES divisions(code),
  title TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT 'General',
  category TEXT NOT NULL DEFAULT 'Policy',
  mime_type TEXT NOT NULL DEFAULT 'text/markdown',
  content_text TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  classification TEXT NOT NULL DEFAULT 'INTERNAL',
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gis_layers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT REFERENCES divisions(code),
  name TEXT NOT NULL,
  layer_type TEXT NOT NULL,
  crs TEXT NOT NULL DEFAULT 'EPSG:4326',
  source_name TEXT NOT NULL,
  data_status TEXT NOT NULL DEFAULT 'SIMULATED',
  geojson TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  division_code TEXT REFERENCES divisions(code),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  baseline_label TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  assumptions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

-- 10. SMART GRID AI
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  division_code TEXT REFERENCES divisions(code),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  citations_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TEXT NOT NULL
);

-- 11. Developer, Governance, Procurement, Community & Audit
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL DEFAULT '["read:cities","read:divisions"]',
  rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  last_used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  event_types_json TEXT NOT NULL DEFAULT '["alert.created","incident.created"]',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'ENTERPRISE',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  seat_limit INTEGER NOT NULL DEFAULT 50,
  storage_limit_mb INTEGER NOT NULL DEFAULT 10240,
  ai_monthly_quota INTEGER NOT NULL DEFAULT 1000,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  compliance_status TEXT NOT NULL DEFAULT 'VERIFIED',
  contact_email TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  contract_value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  end_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  division_code TEXT REFERENCES divisions(code),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'INSPECTION',
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  location TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  city_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'general',
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_enquiries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  message TEXT NOT NULL,
  consent_accepted INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'SUCCESS',
  details_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS background_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  progress_pct INTEGER NOT NULL DEFAULT 100,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  result_summary TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

-- Indexes for tenant isolation & query speed
CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_datasets_org ON datasets(organization_id, division_code);
CREATE INDEX IF NOT EXISTS idx_observations_org_city ON observations(organization_id, city_id, division_code);
CREATE INDEX IF NOT EXISTS idx_assets_org_city ON assets(organization_id, city_id, division_code);
CREATE INDEX IF NOT EXISTS idx_workbooks_org ON workbooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_logs(organization_id, created_at);
