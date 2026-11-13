import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRow, withTransaction } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { generateOpaqueToken, sha256Hex } from "@/lib/auth/password";
import { assertMutationSecurity, getClientIp } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/auth/audit";
import { sendPasswordResetEmail } from "@/lib/email/mailer";
import { isEmailDeliveryConfigured } from "@/lib/config/env";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const RequestResetSchema = z.object({
  email: z.string().email().max(200),
});

const RESET_TTL_MINUTES = 15;

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ip = await getClientIp();
  const ipRl = checkRateLimit(`pwdreset:ip:${ip}`, 10, 60_000);
  if (!ipRl.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many password reset requests. Please wait before trying again.",
      429
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = RequestResetSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Please provide a valid email address.", 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const acctRl = checkRateLimit(`pwdreset:acct:${email}`, 5, 300_000);
  if (!acctRl.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many reset attempts for this email. Please wait 5 minutes.",
      429
    );
  }

  const db = getDb();
  const user = normalizeRow<{ id: string; email: string; full_name: string; status: string }>(
    db.prepare("SELECT id, email, full_name, status FROM users WHERE email = ?").get(email)
  );

  if (user && user.status === "ACTIVE" && user.id !== "usr_career_fest_visitor") {
    const rawToken = generateOpaqueToken(32);
    const tokenHash = sha256Hex(rawToken);
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + RESET_TTL_MINUTES * 60_000).toISOString();
    const tokenId = `prt_${crypto.randomUUID().slice(0, 12)}`;

    withTransaction((tx) => {
      tx.prepare(
        "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL"
      ).run(nowIso, user.id);
      tx.prepare(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(tokenId, user.id, tokenHash, expiresAt, ip, nowIso);
    });

    const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const reqOrigin = new URL(req.url).origin;
    const baseUrl = (configuredBase || reqOrigin).replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    const mailResult = await sendPasswordResetEmail({
      toEmail: user.email,
      fullName: user.full_name,
      resetUrl,
      expiresAt,
    });

    writeAuditLog({
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      resourceType: "USER",
      resourceId: user.id,
      outcome: mailResult.delivered ? "SUCCESS" : "ERROR",
      details: { expiresAt, deliveryStatus: mailResult.status, channel: mailResult.channel },
      ipAddress: ip,
    });
  } else {
    writeAuditLog({
      action: "PASSWORD_RESET_REQUESTED_UNKNOWN_OR_INACTIVE",
      resourceType: "USER",
      outcome: "DENIED",
      details: { emailDomain: email.split("@")[1] || "unknown" },
      ipAddress: ip,
    });
  }

  return apiSuccess({
    accepted: true,
    expiresInMinutes: RESET_TTL_MINUTES,
    message: !isEmailDeliveryConfigured()
      ? "If an active account matches that email address, your request was recorded; however, external SMTP/email relay integration is required on this server before reset links can be dispatched."
      : "If an active account matches that email address, password reset instructions have been processed.",
  });
}
