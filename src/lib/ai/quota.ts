import crypto from "node:crypto";
import { getDb, normalizeRow, withTransaction } from "../db";

export type ReserveQuotaResult =
  | { ok: true; reservationId: string; usedAfterReserve: number; quota: number }
  | { ok: false; used: number; quota: number };

const STALE_RESERVATION_TTL_MS = 5 * 60_000;

export function reserveAiQuotaSlot(params: {
  organizationId: string;
  userId: string;
  nowIso?: string;
}): ReserveQuotaResult {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const monthKey = nowIso.slice(0, 7);
  const monthStart = `${monthKey}-01T00:00:00.000Z`;
  const staleBeforeIso = new Date(Date.parse(nowIso) - STALE_RESERVATION_TTL_MS).toISOString();

  return withTransaction((tx) => {
    tx.prepare(
      "UPDATE ai_quota_reservations SET status = 'RELEASED', resolved_at = ? WHERE organization_id = ? AND status = 'RESERVED' AND created_at < ?"
    ).run(nowIso, params.organizationId, staleBeforeIso);

    const sub = normalizeRow<{ ai_monthly_quota: number }>(
      tx
        .prepare("SELECT ai_monthly_quota FROM subscriptions WHERE organization_id = ?")
        .get(params.organizationId)
    );
    const quota = sub?.ai_monthly_quota ?? 250;

    const usageRow = tx
      .prepare(
        "SELECT COUNT(*) AS cnt FROM usage_records WHERE organization_id = ? AND metric_type = 'AI_REQUEST' AND recorded_at >= ?"
      )
      .get(params.organizationId, monthStart) as { cnt: number };

    const reservedRow = tx
      .prepare(
        "SELECT COUNT(*) AS cnt FROM ai_quota_reservations WHERE organization_id = ? AND month_key = ? AND status = 'RESERVED'"
      )
      .get(params.organizationId, monthKey) as { cnt: number };

    const used = usageRow.cnt + reservedRow.cnt;
    if (used >= quota) {
      return { ok: false, used, quota };
    }

    const reservationId = `aiq_${crypto.randomUUID().slice(0, 12)}`;
    tx.prepare(
      `INSERT INTO ai_quota_reservations (id, organization_id, user_id, month_key, status, created_at)
       VALUES (?, ?, ?, ?, 'RESERVED', ?)`
    ).run(reservationId, params.organizationId, params.userId, monthKey, nowIso);

    return { ok: true, reservationId, usedAfterReserve: used + 1, quota };
  });
}

export function releaseAiQuotaReservation(reservationId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE ai_quota_reservations SET status = 'RELEASED', resolved_at = ? WHERE id = ? AND status = 'RESERVED'"
  ).run(new Date().toISOString(), reservationId);
}

export function commitAiTurnAndUsage(params: {
  reservationId: string;
  organizationId: string;
  userId: string;
  ownerSessionId?: string | null;
  sessionId: string;
  isNewSession: boolean;
  cityId: string | null;
  divisionCode: string | null;
  prompt: string;
  replyText: string;
  provider: string;
  model: string;
  citationsJson: string;
}): { userMsgId: string; assistantMsgId: string } {
  const now = new Date().toISOString();
  const userMsgId = `aim_${crypto.randomUUID().slice(0, 12)}`;
  const assistantMsgId = `aim_${crypto.randomUUID().slice(0, 12)}`;

  return withTransaction((tx) => {
    const resUpd = tx
      .prepare(
        "UPDATE ai_quota_reservations SET status = 'COMMITTED', resolved_at = ? WHERE id = ? AND status = 'RESERVED'"
      )
      .run(now, params.reservationId);

    if (resUpd.changes === 1) {
      tx.prepare(
        "INSERT OR IGNORE INTO usage_records (id, organization_id, metric_type, quantity, recorded_at) VALUES (?, ?, 'AI_REQUEST', 1, ?)"
      ).run(`usg_${params.reservationId}`, params.organizationId, now);
    }

    if (params.isNewSession) {
      tx.prepare(
        `INSERT INTO ai_sessions (id, organization_id, user_id, owner_session_id, city_id, division_code, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        params.sessionId,
        params.organizationId,
        params.userId,
        params.ownerSessionId ?? null,
        params.cityId,
        params.divisionCode,
        params.prompt.slice(0, 65),
        now,
        now
      );
    } else {
      tx.prepare("UPDATE ai_sessions SET updated_at = ? WHERE id = ?").run(now, params.sessionId);
    }

    tx.prepare(
      "INSERT INTO ai_messages (id, session_id, role, content, status, created_at) VALUES (?, ?, 'user', ?, 'COMPLETED', ?)"
    ).run(userMsgId, params.sessionId, params.prompt, now);

    tx.prepare(
      `INSERT INTO ai_messages (id, session_id, role, content, provider, model, citations_json, status, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?, 'COMPLETED', ?)`
    ).run(
      assistantMsgId,
      params.sessionId,
      params.replyText,
      params.provider,
      params.model,
      params.citationsJson,
      now
    );

    return { userMsgId, assistantMsgId };
  });
}
