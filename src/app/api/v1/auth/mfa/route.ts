import { z } from "zod";
import { getDb, normalizeRow, withTransaction } from "@/lib/db";
import { requireAuth, assertMutationSecurity } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { buildTotpUri, generateTotpSecret, verifyTotpCode } from "@/lib/auth/totp";
import {
  issueRecoveryCodesForUser,
  verifyAndConsumeRecoveryCode,
} from "@/lib/auth/mfaRecovery";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const MfaActionSchema = z.object({
  action: z.enum(["setup", "enable", "disable", "regenerate_recovery"]),
  currentPassword: z.string().min(1).max(200),
  secret: z.string().optional(),
  code: z.string().optional(),
});

const PENDING_TTL_MS = 10 * 60_000;

export async function POST(req: Request) {
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  if (auth.ctx.isCareerFestVisitor) {
    return apiError(
      "FORBIDDEN",
      "Career Fest visitor sessions cannot modify account security or MFA settings.",
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = MfaActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Valid MFA action and current account password are required.",
      400
    );
  }

  const db = getDb();
  const userRow = normalizeRow<{
    id: string;
    password_hash: string;
    mfa_enabled: number;
    mfa_secret: string | null;
  }>(
    db
      .prepare("SELECT id, password_hash, mfa_enabled, mfa_secret FROM users WHERE id = ?")
      .get(auth.ctx.userId)
  );

  if (!userRow || !verifyPassword(parsed.data.currentPassword, userRow.password_hash)) {
    writeAuditLog({
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
      action: "MFA_REAUTH_FAILED",
      resourceType: "USER",
      resourceId: auth.ctx.userId,
      outcome: "DENIED",
    });
    return apiError(
      "INVALID_CREDENTIALS",
      "Current password verification failed.",
      401
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (parsed.data.action === "setup") {
    if (userRow.mfa_enabled) {
      return apiError(
        "MFA_ALREADY_ENABLED",
        "MFA is already active. Disable your current authenticator before enrolling a new one.",
        409
      );
    }
    const secret = generateTotpSecret();
    const expiresAt = new Date(now.getTime() + PENDING_TTL_MS).toISOString();
    db.prepare(
      `INSERT INTO mfa_pending_enrollments (user_id, secret, expires_at, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET secret = excluded.secret, expires_at = excluded.expires_at, created_at = excluded.created_at`
    ).run(auth.ctx.userId, secret, expiresAt, nowIso);

    return apiSuccess({
      secret,
      otpauthUri: buildTotpUri(auth.ctx.email, secret),
      expiresAt,
    });
  }

  if (parsed.data.action === "enable") {
    if (userRow.mfa_enabled) {
      return apiError(
        "MFA_ALREADY_ENABLED",
        "MFA is already active. Disable your current authenticator before enrolling a new one.",
        409
      );
    }
    const pending = normalizeRow<{ secret: string; expires_at: string }>(
      db
        .prepare("SELECT secret, expires_at FROM mfa_pending_enrollments WHERE user_id = ?")
        .get(auth.ctx.userId)
    );
    if (!pending || new Date(pending.expires_at).getTime() <= Date.now()) {
      return apiError(
        "MFA_CHALLENGE_EXPIRED",
        "MFA setup challenge expired or not initiated. Generate a new enrollment secret.",
        400
      );
    }
    if (parsed.data.secret && parsed.data.secret.trim() !== pending.secret) {
      return apiError(
        "MFA_SECRET_MISMATCH",
        "Submitted secret does not match the active server enrollment challenge.",
        400
      );
    }
    if (!parsed.data.code || !verifyTotpCode(pending.secret, parsed.data.code)) {
      return apiError("INVALID_MFA_CODE", "Verification code did not match.", 400);
    }

    const recoveryCodes = withTransaction((tx) => {
      tx.prepare(
        "UPDATE users SET mfa_enabled = 1, mfa_secret = ?, updated_at = ? WHERE id = ?"
      ).run(pending.secret, nowIso, auth.ctx.userId);
      tx.prepare("DELETE FROM mfa_pending_enrollments WHERE user_id = ?").run(auth.ctx.userId);
      return issueRecoveryCodesForUser(tx, auth.ctx.userId);
    });

    writeAuditLog({
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
      action: "MFA_ENABLED",
      resourceType: "USER",
      resourceId: auth.ctx.userId,
    });
    return apiSuccess({ mfaEnabled: true, recoveryCodes });
  }

  if (parsed.data.action === "regenerate_recovery") {
    if (!userRow.mfa_enabled || !userRow.mfa_secret) {
      return apiError("MFA_NOT_ENABLED", "Enable TOTP MFA before generating backup codes.", 400);
    }
    if (!parsed.data.code || !verifyTotpCode(userRow.mfa_secret, parsed.data.code)) {
      return apiError(
        "INVALID_MFA_CODE",
        "Valid current 6-digit authenticator code required to regenerate backup codes.",
        400
      );
    }
    const recoveryCodes = withTransaction((tx) => issueRecoveryCodesForUser(tx, auth.ctx.userId));
    writeAuditLog({
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
      action: "MFA_RECOVERY_REGENERATED",
      resourceType: "USER",
      resourceId: auth.ctx.userId,
    });
    return apiSuccess({ mfaEnabled: true, recoveryCodes });
  }

  // disable
  if (!userRow.mfa_enabled) {
    return apiError("MFA_NOT_ENABLED", "MFA is already disabled.", 400);
  }
  const suppliedCode = parsed.data.code?.trim() || "";
  const totpValid =
    Boolean(userRow.mfa_secret) && verifyTotpCode(userRow.mfa_secret!, suppliedCode);
  const recoveryValid =
    !totpValid && suppliedCode.length >= 8
      ? verifyAndConsumeRecoveryCode(db, auth.ctx.userId, suppliedCode)
      : false;

  if (userRow.mfa_secret && !totpValid && !recoveryValid) {
    return apiError(
      "INVALID_MFA_CODE",
      "Valid current authenticator code or backup recovery code required to disable MFA.",
      400
    );
  }

  withTransaction((tx) => {
    tx.prepare(
      "UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, updated_at = ? WHERE id = ?"
    ).run(nowIso, auth.ctx.userId);
    tx.prepare("DELETE FROM mfa_recovery_codes WHERE user_id = ?").run(auth.ctx.userId);
    tx.prepare("DELETE FROM mfa_pending_enrollments WHERE user_id = ?").run(auth.ctx.userId);
  });

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "MFA_DISABLED",
    resourceType: "USER",
    resourceId: auth.ctx.userId,
  });
  return apiSuccess({ mfaEnabled: false });
}
