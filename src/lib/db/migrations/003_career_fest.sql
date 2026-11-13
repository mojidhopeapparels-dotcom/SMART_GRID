-- SMART GRID Career Fest 2026 Visitor Sandbox & 30-Minute Session Architecture
-- Migration 003 (additive & idempotent for both fresh and upgraded SQLite databases)

ALTER TABLE sessions ADD COLUMN is_career_fest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workbooks ADD COLUMN owner_session_id TEXT;
ALTER TABLE ai_sessions ADD COLUMN owner_session_id TEXT;

-- Privacy-conscious Career Fest event counter (strictly no IP, user-agent, cookies, or PII)
CREATE TABLE IF NOT EXISTS career_fest_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('LANDING_VIEW', 'VISITOR_ENTER', 'VISITOR_EXIT', 'VISITOR_EXPIRED', 'FEATURE_OPEN')),
  division_code TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_career_fest ON sessions(is_career_fest, expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS idx_workbooks_org_session ON workbooks(organization_id, owner_session_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_org_session ON ai_sessions(organization_id, owner_session_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_career_fest_events_type_time ON career_fest_events(event_type, created_at);
