import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRow, normalizeRows, withTransaction } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { requireAuth, assertMutationSecurity } from "@/lib/auth/session";
import { generateOpaqueToken, hashPassword, sha256Hex } from "@/lib/auth/password";
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";
import { isSafeExternalHttpsUrl } from "@/lib/security/sanitize";

const AdminPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("INVITE_USER"),
    fullName: z.string().min(2).max(120),
    email: z.string().email().max(200),
    roleCode: z.string().min(2),
    department: z.string().max(100).default("General"),
    temporaryPassword: z.string().min(10).max(200),
  }),
  z.object({
    action: z.literal("CREATE_API_KEY"),
    name: z.string().min(2).max(100),
    scopes: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal("REVOKE_API_KEY"),
    keyId: z.string().min(1),
  }),
  z.object({
    action: z.literal("CREATE_WEBHOOK"),
    name: z.string().min(2).max(100),
    targetUrl: z.string().url(),
    eventTypes: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal("UPDATE_PLAN"),
    planCode: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE", "CITY_NETWORK"]),
  }),
]);

export async function GET(req: Request) {
  ensureSeeded();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "overview";

  const requiredPerm =
    scope === "audit"
      ? "audit:read"
      : scope === "developer"
        ? "developer:manage"
        : scope === "billing"
          ? "billing:manage"
          : "org:manage";

  const auth = await requireAuth(requiredPerm);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const orgId = auth.ctx.organizationId;

  if (scope === "audit") {
    const logs = normalizeRows(
      db
        .prepare(
          `SELECT a.*, u.email AS user_email
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
           WHERE a.organization_id = ?
           ORDER BY a.created_at DESC LIMIT 100`
        )
        .all(orgId)
    );
    return apiSuccess({ logs });
  }

  if (scope === "developer") {
    const keys = normalizeRows(
      db
        .prepare("SELECT id, name, key_prefix, scopes_json, rate_limit_per_min, status, last_used_at, created_at FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC")
        .all(orgId)
    );
    const webhooks = normalizeRows(
      db.prepare("SELECT * FROM webhooks WHERE organization_id = ? ORDER BY created_at DESC").all(orgId)
    );
    return apiSuccess({ keys, webhooks });
  }

  if (scope === "billing") {
    const subscription = normalizeRow(
      db.prepare("SELECT * FROM subscriptions WHERE organization_id = ?").get(orgId)
    );
    const usage = normalizeRows(
      db
        .prepare("SELECT metric_type, SUM(quantity) AS total FROM usage_records WHERE organization_id = ? GROUP BY metric_type")
        .all(orgId)
    );
    const memberCount = (
      db.prepare("SELECT COUNT(*) AS cnt FROM organization_memberships WHERE organization_id = ? AND status = 'ACTIVE'").get(orgId) as { cnt: number }
    ).cnt;
    return apiSuccess({ subscription, usage, memberCount });
  }

  const members = normalizeRows(
    db
      .prepare(
        `SELECT m.id AS membership_id, m.role_code, m.department, m.status AS membership_status,
                u.id AS user_id, u.email, u.full_name, u.job_title, u.mfa_enabled
         FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = ?
         ORDER BY m.created_at ASC`
      )
      .all(orgId)
  );
  const org = normalizeRow(db.prepare("SELECT * FROM organizations WHERE id = ?").get(orgId));
  return apiSuccess({ organization: org, members, roles: SYSTEM_ROLES, permissions: PERMISSIONS });
}

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = AdminPostSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid administration request.", 400, parsed.error.flatten());
  }

  const d = parsed.data;
  const requiredPerm =
    d.action === "INVITE_USER"
      ? "users:manage"
      : d.action === "UPDATE_PLAN"
        ? "billing:manage"
        : "developer:manage";

  const auth = await requireAuth(requiredPerm);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const orgId = auth.ctx.organizationId;
  const now = new Date().toISOString();

  if (d.action === "INVITE_USER") {
    const validRole = SYSTEM_ROLES.some((r) => r.code === d.roleCode);
    if (!validRole) return apiError("VALIDATION_ERROR", "Unknown role code.", 400);

    const privilegedTarget = d.roleCode === "ORG_OWNER" || d.roleCode === "SUPER_ADMIN";
    const actorCanGrantPrivileged =
      auth.ctx.roleCode === "ORG_OWNER" || auth.ctx.roleCode === "SUPER_ADMIN";
    if (privilegedTarget && !actorCanGrantPrivileged) {
      return apiError(
        "FORBIDDEN",
        "Only Organization Owners or Super Admins can assign Owner or Super Admin roles.",
        403
      );
    }

    const email = d.email.trim().toLowerCase();
    const existing = normalizeRow<{ id: string }>(db.prepare("SELECT id FROM users WHERE email = ?").get(email));
    if (existing) return apiError("USER_EXISTS", "A user with this email already exists.", 409);

    const sub = normalizeRow<{ seat_limit: number }>(
      db.prepare("SELECT seat_limit FROM subscriptions WHERE organization_id = ?").get(orgId)
    );
    const activeCount = normalizeRow<{ cnt: number }>(
      db
        .prepare(
          "SELECT COUNT(*) AS cnt FROM organization_memberships WHERE organization_id = ? AND status = 'ACTIVE'"
        )
        .get(orgId)
    );
    if (sub && activeCount && activeCount.cnt >= sub.seat_limit) {
      return apiError(
        "SEAT_LIMIT_REACHED",
        `Active seat limit (${sub.seat_limit}) reached for your current plan.`,
        409
      );
    }

    const userId = `usr_${crypto.randomUUID().slice(0, 12)}`;
    withTransaction((tx) => {
      tx.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, job_title, status, mfa_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)`
      ).run(userId, email, hashPassword(d.temporaryPassword), d.fullName.trim(), d.department, now, now);

      tx.prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, role_code, department, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`
      ).run(`mem_${crypto.randomUUID().slice(0, 12)}`, orgId, userId, d.roleCode, d.department, now);
    });

    writeAuditLog({
      organizationId: orgId,
      userId: auth.ctx.userId,
      action: "USER_INVITED",
      resourceType: "USER",
      resourceId: userId,
      details: { roleCode: d.roleCode },
    });
    return apiSuccess({ userId, email, roleCode: d.roleCode }, undefined, 201);
  }

  if (d.action === "CREATE_API_KEY") {
    const rawSecret = `sg_live_${generateOpaqueToken(24)}`;
    const prefix = rawSecret.slice(0, 14);
    const id = `key_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO api_keys (id, organization_id, created_by, name, key_prefix, key_hash, scopes_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`
    ).run(id, orgId, auth.ctx.userId, d.name.trim(), prefix, sha256Hex(rawSecret), JSON.stringify(d.scopes), now);

    writeAuditLog({
      organizationId: orgId,
      userId: auth.ctx.userId,
      action: "API_KEY_CREATED",
      resourceType: "API_KEY",
      resourceId: id,
    });
    return apiSuccess({ id, prefix, plaintextKeyOnce: rawSecret }, undefined, 201);
  }

  if (d.action === "REVOKE_API_KEY") {
    const res = db
      .prepare("UPDATE api_keys SET status = 'REVOKED' WHERE id = ? AND organization_id = ?")
      .run(d.keyId, orgId);
    if (res.changes === 0) return apiError("NOT_FOUND", "API key not found.", 404);
    writeAuditLog({
      organizationId: orgId,
      userId: auth.ctx.userId,
      action: "API_KEY_REVOKED",
      resourceType: "API_KEY",
      resourceId: d.keyId,
    });
    return apiSuccess({ revoked: true });
  }

  if (d.action === "CREATE_WEBHOOK") {
    if (!isSafeExternalHttpsUrl(d.targetUrl)) {
      return apiError("VALIDATION_ERROR", "Webhook target URL must be a valid public HTTPS endpoint.", 400);
    }
    const id = `wh_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      "INSERT INTO webhooks (id, organization_id, name, target_url, event_types_json, status, created_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)"
    ).run(id, orgId, d.name.trim(), d.targetUrl, JSON.stringify(d.eventTypes), now);
    writeAuditLog({
      organizationId: orgId,
      userId: auth.ctx.userId,
      action: "WEBHOOK_CREATED",
      resourceType: "WEBHOOK",
      resourceId: id,
    });
    return apiSuccess({ id }, undefined, 201);
  }

  const limits: Record<string, { seats: number; storage: number; ai: number }> = {
    STARTER: { seats: 10, storage: 2048, ai: 250 },
    PROFESSIONAL: { seats: 30, storage: 5120, ai: 600 },
    ENTERPRISE: { seats: 100, storage: 25600, ai: 2500 },
    CITY_NETWORK: { seats: 500, storage: 102400, ai: 10000 },
  };
  const cfg = limits[d.planCode];
  const periodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
  withTransaction((tx) => {
    tx.prepare(
      `INSERT INTO subscriptions (id, organization_id, plan_code, status, seat_limit, storage_limit_mb, ai_monthly_quota, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
       ON CONFLICT(organization_id) DO UPDATE SET
         plan_code = excluded.plan_code,
         seat_limit = excluded.seat_limit,
         storage_limit_mb = excluded.storage_limit_mb,
         ai_monthly_quota = excluded.ai_monthly_quota`
    ).run(
      `sub_${crypto.randomUUID().slice(0, 12)}`,
      orgId,
      d.planCode,
      cfg.seats,
      cfg.storage,
      cfg.ai,
      now,
      periodEnd
    );
    tx.prepare("UPDATE organizations SET plan_code = ?, updated_at = ? WHERE id = ?").run(d.planCode, now, orgId);
  });
  writeAuditLog({
    organizationId: orgId,
    userId: auth.ctx.userId,
    action: "SUBSCRIPTION_PLAN_UPDATED",
    resourceType: "SUBSCRIPTION",
    resourceId: orgId,
    details: { planCode: d.planCode },
  });
  return apiSuccess({ planCode: d.planCode });
}
