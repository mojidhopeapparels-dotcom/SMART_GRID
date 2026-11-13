-- SMART GRID Stage 5 Security, Recovery, Atomicity & Schema Hardening
-- Migration 002 (additive & idempotent for both fresh and upgraded databases)

-- 1. Password reset tokens (SHA-256 hashed, single-use, short TTL)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  requested_ip TEXT,
  created_at TEXT NOT NULL
);

-- 2. Single-use MFA recovery backup codes (SHA-256 hashed at rest)
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

-- 3. Server-bound pending MFA enrollment challenges (prevents unverified client secret tampering)
CREATE TABLE IF NOT EXISTS mfa_pending_enrollments (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 4. Transactional AI quota reservations (prevents concurrent overshoot & unbilled/double-billed charges)
CREATE TABLE IF NOT EXISTS ai_quota_reservations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'COMMITTED', 'RELEASED')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

-- 5. Seed version metadata (decouples schema/reference seed tracking from table count heuristics)
CREATE TABLE IF NOT EXISTS seed_metadata (
  seed_key TEXT PRIMARY KEY,
  seed_version INTEGER NOT NULL,
  mode TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- 6. Stage 5 Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_alerts_org_city_div ON alerts(organization_id, city_id, division_code, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_org_user ON ai_sessions(organization_id, user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_usage_org_metric_time ON usage_records(organization_id, metric_type, recorded_at);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_mfa_rec_user ON mfa_recovery_codes(user_id, used_at);
CREATE INDEX IF NOT EXISTS idx_ai_quota_res_org_month ON ai_quota_reservations(organization_id, month_key, status);
