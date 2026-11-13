import { z } from "zod";
import { getDb, normalizeRow, withTransaction } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { hashPassword, sha256Hex } from "@/lib/auth/password";
import { assertMutationSecurity, getClientIp } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const ConfirmResetSchema = z.object({
  token: z.string().min(20).max(256),
  newPassword: z.string().min(10).max(200),
});

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ip = await getClientIp();
  const rl = checkRateLimit(`pwdreset:confirm:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError("RATE_LIMITED", "Too many password reset confirmation attempts.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = ConfirmResetSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Valid reset token and new password (minimum 10 characters) are required.",
      400
    );
  }

  const tokenHash = sha256Hex(parsed.data.token.trim());
  const db = getDb();
  const nowIso = new Date().toISOString();

  const outcome = withTransaction((tx) => {
    const tokenRow = normalizeRow<{
      id: string;
      user_id: string;
      expires_at: string;
      used_at: string | null;
      user_status: string;
    }>(
      tx
        .prepare(
          `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.status AS user_status
           FROM password_reset_tokens t
           JOIN users u ON u.id = t.user_id
           WHERE t.token_hash = ?`
        )
        .get(tokenHash)
    );

    if (
      !tokenRow ||
      tokenRow.used_at !== null ||
      new Date(tokenRow.expires_at).getTime() <= Date.now()
    ) {
      return { ok: false as const, code: "INVALID_OR_EXPIRED_TOKEN", status: 400 };
    }

    if (tokenRow.user_status !== "ACTIVE") {
      return { ok: false as const, code: "ACCOUNT_DISABLED", status: 403 };
    }

    const consume = tx
      .prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL")
      .run(nowIso, tokenRow.id);
    if (consume.changes !== 1) {
      return { ok: false as const, code: "INVALID_OR_EXPIRED_TOKEN", status: 400 };
    }

    tx.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      hashPassword(parsed.data.newPassword),
      nowIso,
      tokenRow.user_id
    );

    // Revoke ALL active sessions for the user across all devices immediately
    const revoked = tx
      .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
      .run(nowIso, tokenRow.user_id);

    return {
      ok: true as const,
      userId: tokenRow.user_id,
      revokedSessions: Number(revoked.changes ?? 0),
    };
  });

  if (!outcome.ok) {
    writeAuditLog({
      action: "PASSWORD_RESET_FAILED",
      resourceType: "PASSWORD_RESET",
      outcome: "DENIED",
      details: { reason: outcome.code },
      ipAddress: ip,
    });
    return apiError(
      outcome.code,
      outcome.code === "ACCOUNT_DISABLED"
        ? "This user account is disabled."
        : "Password reset link is invalid, expired, or already used.",
      outcome.status
    );
  }

  writeAuditLog({
    userId: outcome.userId,
    action: "PASSWORD_RESET_COMPLETED",
    resourceType: "USER",
    resourceId: outcome.userId,
    outcome: "SUCCESS",
    details: { revokedSessions: outcome.revokedSessions },
    ipAddress: ip,
  });

  return apiSuccess({
    reset: true,
    revokedSessions: outcome.revokedSessions,
    message: "Password updated and all prior active sessions were revoked. Sign in with your new password.",
  });
}
