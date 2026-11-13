import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { requireAuth, assertMutationSecurity } from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

export async function GET(req: Request) {
  ensureSeeded();
  const auth = await requireAuth("ai:use");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return apiError("VALIDATION_ERROR", "sessionId query parameter is required.", 400);
  }

  const db = getDb();
  const session = auth.ctx.isCareerFestVisitor
    ? normalizeRow(
        db
          .prepare(
            "SELECT * FROM ai_sessions WHERE id = ? AND organization_id = ? AND user_id = ? AND owner_session_id = ?"
          )
          .get(sessionId, auth.ctx.organizationId, auth.ctx.userId, auth.ctx.sessionId)
      )
    : normalizeRow(
        db
          .prepare("SELECT * FROM ai_sessions WHERE id = ? AND organization_id = ? AND user_id = ?")
          .get(sessionId, auth.ctx.organizationId, auth.ctx.userId)
      );
  if (!session) {
    return apiError("NOT_FOUND", "AI session not found.", 404);
  }

  const messages = normalizeRows(
    db
      .prepare("SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC")
      .all(sessionId)
  );

  return apiSuccess({ session, messages });
}

export async function DELETE(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("ai:use");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return apiError("VALIDATION_ERROR", "sessionId query parameter is required.", 400);
  }

  const db = getDb();
  const res = auth.ctx.isCareerFestVisitor
    ? db
        .prepare(
          "DELETE FROM ai_sessions WHERE id = ? AND organization_id = ? AND user_id = ? AND owner_session_id = ?"
        )
        .run(sessionId, auth.ctx.organizationId, auth.ctx.userId, auth.ctx.sessionId)
    : db
        .prepare("DELETE FROM ai_sessions WHERE id = ? AND organization_id = ? AND user_id = ?")
        .run(sessionId, auth.ctx.organizationId, auth.ctx.userId);

  if (res.changes === 0) {
    return apiError("NOT_FOUND", "AI session not found.", 404);
  }

  db.prepare("DELETE FROM ai_messages WHERE session_id = ?").run(sessionId);

  return apiSuccess({ deleted: true });
}
