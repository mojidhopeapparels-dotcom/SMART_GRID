import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb, normalizeRow } from "../db";
import { DIVISIONS } from "../domain/divisions";
import {
  CAREER_FEST_MAX_AI_TURNS_PER_SESSION,
  CAREER_FEST_MAX_WORKBOOKS_PER_SESSION,
  CAREER_FEST_SESSION_TTL_MS,
} from "./constants";

export type CareerFestEventType =
  | "LANDING_VIEW"
  | "VISITOR_ENTER"
  | "VISITOR_EXIT"
  | "VISITOR_EXPIRED"
  | "FEATURE_OPEN";

export function recordCareerFestEvent(
  eventType: CareerFestEventType,
  divisionCode?: string | null
): void {
  try {
    const db = getDb();
    const safeDivision =
      divisionCode && DIVISIONS.some((d) => d.code === divisionCode)
        ? divisionCode
        : null;
    db.prepare(
      `INSERT INTO career_fest_events (id, event_type, division_code, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      `cfe_${crypto.randomUUID().slice(0, 12)}`,
      eventType,
      safeDivision,
      new Date().toISOString()
    );
  } catch {
    // Non-blocking analytics helper: never break visitor experience if schema not yet migrated in edge tests
  }
}

export function resolveEffectiveSessionExpiryMs(params: {
  isCareerFest: boolean;
  createdAt: string;
  expiresAt: string;
}): number {
  const storedExpiry = Date.parse(params.expiresAt);
  if (!Number.isFinite(storedExpiry)) return 0;
  if (!params.isCareerFest) return storedExpiry;

  const createdMs = Date.parse(params.createdAt);
  if (!Number.isFinite(createdMs)) return 0;

  return Math.min(storedExpiry, createdMs + CAREER_FEST_SESSION_TTL_MS);
}

export function revokeSessionIfNeeded(db: DatabaseSync, sessionId: string, isCareerFest: boolean): void {
  const nowIso = new Date().toISOString();
  const res = db
    .prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .run(nowIso, sessionId);
  if (isCareerFest && Number(res.changes ?? 0) > 0) {
    try {
      db.prepare(
        "INSERT INTO career_fest_events (id, event_type, division_code, created_at) VALUES (?, 'VISITOR_EXPIRED', NULL, ?)"
      ).run(`cfe_${crypto.randomUUID().slice(0, 12)}`, nowIso);
    } catch {
      // ignore if career_fest_events unavailable
    }
  }
}

export function canVisitorAccessWorkbook(
  workbook: { owner_session_id?: string | null },
  ctx: { isCareerFestVisitor: boolean; sessionId: string },
  mode: "read" | "write"
):
  | { allowed: true }
  | { allowed: false; status: 403 | 404; code: string; message: string } {
  if (!ctx.isCareerFestVisitor) {
    return { allowed: true };
  }

  const ownerSession = workbook.owner_session_id ?? null;
  if (ownerSession === ctx.sessionId) {
    return { allowed: true };
  }

  if (ownerSession === null) {
    if (mode === "read") {
      return { allowed: true };
    }
    return {
      allowed: false,
      status: 403,
      code: "VISITOR_TEMPLATE_READONLY",
      message:
        "The shared Career Fest starter template is read-only. Create your own workbook in SMART GRID SHEETS to save edits in your private session.",
    };
  }

  return {
    allowed: false,
    status: 404,
    code: "NOT_FOUND",
    message: "Workbook not found in your active session.",
  };
}

export function getCareerFestSessionWorkbookCount(
  db: DatabaseSync,
  organizationId: string,
  sessionId: string
): number {
  const row = normalizeRow<{ cnt: number }>(
    db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM workbooks WHERE organization_id = ? AND owner_session_id = ? AND is_archived = 0"
      )
      .get(organizationId, sessionId)
  );
  return row?.cnt ?? 0;
}

export function getCareerFestSessionAiTurnCount(
  db: DatabaseSync,
  organizationId: string,
  sessionId: string
): number {
  const row = normalizeRow<{ cnt: number }>(
    db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM ai_messages m
         JOIN ai_sessions s ON s.id = m.session_id
         WHERE s.organization_id = ? AND s.owner_session_id = ? AND m.role = 'user'`
      )
      .get(organizationId, sessionId)
  );
  return row?.cnt ?? 0;
}

export function isCareerFestWorkbookQuotaReached(
  db: DatabaseSync,
  organizationId: string,
  sessionId: string
): boolean {
  return (
    getCareerFestSessionWorkbookCount(db, organizationId, sessionId) >=
    CAREER_FEST_MAX_WORKBOOKS_PER_SESSION
  );
}

export function isCareerFestAiLimitReached(
  db: DatabaseSync,
  organizationId: string,
  sessionId: string
): boolean {
  return (
    getCareerFestSessionAiTurnCount(db, organizationId, sessionId) >=
    CAREER_FEST_MAX_AI_TURNS_PER_SESSION
  );
}
