import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRow, withTransaction } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { hashPassword } from "@/lib/auth/password";
import {
  createSession,
  getClientIp,
  setSessionCookie,
  assertMutationSecurity,
} from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const SignUpSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(200),
  password: z.string().min(10).max(200),
  organizationName: z.string().min(2).max(160),
  organizationType: z
    .enum(["MUNICIPALITY", "GOVERNMENT_AGENCY", "UTILITY", "RESEARCH_INSTITUTE", "ENTERPRISE"])
    .default("MUNICIPALITY"),
});

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ip = await getClientIp();
  const rl = checkRateLimit(`signup:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError("RATE_LIMITED", "Too many registration attempts.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = SignUpSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Please provide valid name, email, 10+ character password, and organization name.",
      400
    );
  }

  const db = getDb();
  const email = parsed.data.email.trim().toLowerCase();
  const existing = normalizeRow<{ id: string }>(
    db.prepare("SELECT id FROM users WHERE email = ?").get(email)
  );
  if (existing) {
    return apiError("EMAIL_EXISTS", "An account with this email already exists.", 409);
  }

  const now = new Date().toISOString();
  const userId = `usr_${crypto.randomUUID()}`;
  const orgId = `org_${crypto.randomUUID()}`;
  const slugBase = parsed.data.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "org";
  const orgSlug = `${slugBase}-${crypto.randomBytes(3).toString("hex")}`;

  withTransaction((tx) => {
    tx.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, job_title, locale, timezone, status, mfa_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Organization Owner', 'en', 'UTC', 'ACTIVE', 0, ?, ?)`
    ).run(userId, email, hashPassword(parsed.data.password), parsed.data.fullName.trim(), now, now);

    tx.prepare(
      `INSERT INTO organizations (id, slug, name, org_type, country_code, verification_status, plan_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'GLOBAL', 'PENDING', 'STARTER', ?, ?)`
    ).run(orgId, orgSlug, parsed.data.organizationName.trim(), parsed.data.organizationType, now, now);

    tx.prepare(
      `INSERT INTO workspaces (id, organization_id, name, slug, description, status, created_at)
       VALUES (?, ?, 'Default Workspace', 'default', 'Primary organization workspace.', 'ACTIVE', ?)`
    ).run(`ws_${crypto.randomUUID()}`, orgId, now);

    tx.prepare(
      `INSERT INTO organization_memberships (id, organization_id, user_id, role_code, department, status, created_at)
       VALUES (?, ?, ?, 'ORG_OWNER', 'Administration', 'ACTIVE', ?)`
    ).run(`mem_${crypto.randomUUID()}`, orgId, userId, now);

    tx.prepare(
      `INSERT INTO subscriptions (id, organization_id, plan_code, status, seat_limit, storage_limit_mb, ai_monthly_quota, current_period_start, current_period_end)
       VALUES (?, ?, 'STARTER', 'ACTIVE', 10, 2048, 250, ?, ?)`
    ).run(`sub_${crypto.randomUUID()}`, orgId, now, new Date(Date.now() + 30 * 86400_000).toISOString());
  });

  const session = await createSession({
    userId,
    organizationId: orgId,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  });
  await setSessionCookie(session.cookieValue, session.expiresAt);

  writeAuditLog({
    organizationId: orgId,
    userId,
    action: "ORG_AND_USER_REGISTERED",
    resourceType: "ORGANIZATION",
    resourceId: orgId,
    outcome: "SUCCESS",
    ipAddress: ip,
  });

  return apiSuccess(
    {
      userId,
      email,
      organizationId: orgId,
      organizationSlug: orgSlug,
    },
    undefined,
    201
  );
}
