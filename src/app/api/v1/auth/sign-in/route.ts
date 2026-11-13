import { z } from "zod";
import { getDb, normalizeRow } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotpCode } from "@/lib/auth/totp";
import { verifyAndConsumeRecoveryCode } from "@/lib/auth/mfaRecovery";
import {
  createSession,
  getClientIp,
  setSessionCookie,
  assertMutationSecurity,
} from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/auth/audit";
import { CAREER_FEST_USER_EMAIL, CAREER_FEST_USER_ID } from "@/lib/careerFest/constants";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const SignInSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
  totpCode: z.string().optional(),
  recoveryCode: z.string().optional(),
});

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ip = await getClientIp();
  const rl = checkRateLimit(`signin:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError("RATE_LIMITED", "Too many sign-in attempts. Please wait a minute.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Valid email and password are required.", 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const acctRl = checkRateLimit(`signin:acct:${email}`, 10, 60_000);
  if (!acctRl.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many sign-in attempts for this account. Please wait a minute.",
      429
    );
  }
  const db = getDb();
  const user = normalizeRow<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    status: string;
    mfa_enabled: number;
    mfa_secret: string | null;
  }>(db.prepare("SELECT * FROM users WHERE email = ?").get(email));

  if (
    !user ||
    user.id === CAREER_FEST_USER_ID ||
    email === CAREER_FEST_USER_EMAIL ||
    !verifyPassword(parsed.data.password, user.password_hash)
  ) {
    writeAuditLog({
      action: "AUTH_SIGN_IN",
      resourceType: "USER",
      outcome: "DENIED",
      details: { email, reason: "invalid_credentials" },
      ipAddress: ip,
    });
    return apiError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
  }

  if (user.status !== "ACTIVE") {
    return apiError("ACCOUNT_DISABLED", "This user account is disabled.", 403);
  }

  if (user.mfa_enabled && user.mfa_secret) {
    const hasTotp = Boolean(parsed.data.totpCode?.trim());
    const hasRecovery = Boolean(parsed.data.recoveryCode?.trim());
    if (!hasTotp && !hasRecovery) {
      return apiError("MFA_REQUIRED", "Multi-factor authentication code is required.", 403, {
        mfaRequired: true,
      });
    }
    let mfaPassed = false;
    if (hasTotp && verifyTotpCode(user.mfa_secret, parsed.data.totpCode!.trim())) {
      mfaPassed = true;
    } else if (
      hasRecovery &&
      verifyAndConsumeRecoveryCode(db, user.id, parsed.data.recoveryCode!.trim())
    ) {
      mfaPassed = true;
      writeAuditLog({
        userId: user.id,
        action: "AUTH_MFA_RECOVERY_USED",
        resourceType: "USER",
        resourceId: user.id,
        outcome: "SUCCESS",
        ipAddress: ip,
      });
    }
    if (!mfaPassed) {
      writeAuditLog({
        userId: user.id,
        action: "AUTH_MFA_VERIFY",
        resourceType: "USER",
        resourceId: user.id,
        outcome: "DENIED",
        ipAddress: ip,
      });
      return apiError(
        "INVALID_MFA_CODE",
        "Invalid authenticator or backup recovery code.",
        401
      );
    }
  }

  const membership = normalizeRow<{ organization_id: string }>(
    db
      .prepare(
        "SELECT organization_id FROM organization_memberships WHERE user_id = ? AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1"
      )
      .get(user.id)
  );

  if (!membership) {
    return apiError("NO_ORGANIZATION", "User has no active organization membership.", 403);
  }

  const firstCity = normalizeRow<{ id: string }>(
    db
      .prepare("SELECT id FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC LIMIT 1")
      .get(membership.organization_id)
  );

  const session = await createSession({
    userId: user.id,
    organizationId: membership.organization_id,
    cityId: firstCity?.id ?? null,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  });

  await setSessionCookie(session.cookieValue, session.expiresAt);

  writeAuditLog({
    organizationId: membership.organization_id,
    userId: user.id,
    action: "AUTH_SIGN_IN",
    resourceType: "SESSION",
    resourceId: session.sessionId,
    outcome: "SUCCESS",
    ipAddress: ip,
  });

  return apiSuccess({
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    organizationId: membership.organization_id,
  });
}
