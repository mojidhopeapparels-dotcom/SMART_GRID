import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { isTrustedProxyEnabled } from "@/lib/config/env";
import { logEvent } from "@/lib/observability/logger";
import { generateOpaqueToken, sha256Hex } from "@/lib/auth/password";
import { getRolePermissions, hasPermission } from "@/lib/auth/rbac";
import { resolveClientIpFromHeaders } from "@/lib/auth/guards";
import { apiError } from "@/lib/domain/statuses";

export {
  assertMutationSecurity,
  assertPermittedCity,
  assertValidDivision,
  assertTenantAsset,
  resolveClientIpFromHeaders,
} from "@/lib/auth/guards";
import {
  CAREER_FEST_ORG_ID,
  CAREER_FEST_ROLE_CODE,
  CAREER_FEST_SESSION_TTL_SECONDS,
} from "@/lib/careerFest/constants";
import {
  resolveEffectiveSessionExpiryMs,
  revokeSessionIfNeeded,
} from "@/lib/careerFest/service";

export const SESSION_COOKIE_NAME = "sg_session";
const SESSION_TTL_HOURS = 24 * 7;

export interface AuthContext {
  sessionId: string;
  userId: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  mfaEnabled: boolean;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  roleCode: string;
  permissions: string[];
  activeCityId: string | null;
  isCareerFestVisitor: boolean;
  sessionCreatedAt: string;
  sessionExpiresAt: string;
  sessionRemainingSeconds: number;
  memberships: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    roleCode: string;
  }[];
}

let runtimeRandomSecret: string | null = null;

function getSigningSecret(): string {
  const configured = process.env.SMART_GRID_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (!runtimeRandomSecret) {
    runtimeRandomSecret = crypto.randomBytes(32).toString("hex");
    if (process.env.NODE_ENV === "production") {
      logEvent("warn", "EPHEMERAL_SESSION_SECRET_GENERATED", {
        message:
          "SMART_GRID_SESSION_SECRET is not configured in production; an ephemeral 256-bit key was generated for this process lifecycle.",
      });
    }
  }
  return runtimeRandomSecret;
}

function signToken(token: string): string {
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(token)
    .digest("base64url");
  return `${token}.${sig}`;
}

function verifySignedToken(cookieValue: string): string | null {
  const idx = cookieValue.lastIndexOf(".");
  if (idx <= 0) return null;
  const rawToken = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(rawToken)
    .digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  return rawToken;
}

export async function createSession(params: {
  userId: string;
  organizationId: string;
  cityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isCareerFest?: boolean;
  ttlSeconds?: number;
}): Promise<{ sessionId: string; cookieValue: string; expiresAt: string }> {
  const db = getDb();
  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256Hex(rawToken);
  const sessionId = `${params.isCareerFest ? "cf" : "ses"}_${crypto.randomUUID()}`;
  const now = new Date();
  const isCareerFest = Boolean(params.isCareerFest);
  const effectiveTtlSeconds = isCareerFest
    ? Math.min(params.ttlSeconds ?? CAREER_FEST_SESSION_TTL_SECONDS, CAREER_FEST_SESSION_TTL_SECONDS)
    : params.ttlSeconds ?? SESSION_TTL_HOURS * 3600;
  const expiresAt = new Date(now.getTime() + Math.max(1, effectiveTtlSeconds) * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (
      id, user_id, active_organization_id, active_city_id, token_hash,
      ip_address, user_agent, is_career_fest, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    params.userId,
    params.organizationId,
    params.cityId ?? null,
    tokenHash,
    params.ipAddress ?? null,
    params.userAgent ?? null,
    isCareerFest ? 1 : 0,
    expiresAt,
    now.toISOString()
  );

  return {
    sessionId,
    cookieValue: signToken(rawToken),
    expiresAt,
  };
}

async function shouldUseSecureCookie(): Promise<boolean> {
  const override = process.env.SMART_GRID_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  try {
    const hdr = await headers();
    const proto = hdr.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    if (proto === "https") return true;
    if (proto === "http") return false;
    const origin = hdr.get("origin") || "";
    if (origin.startsWith("https://")) return true;
  } catch {
    // Fall through to false when headers are unavailable outside request context
  }
  return false;
}

export async function setSessionCookie(cookieValue: string, expiresAt: string) {
  const jar = await cookies();
  const isSecure = await shouldUseSecureCookie();
  jar.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

export async function revokeCurrentSession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (raw) {
    const token = verifySignedToken(raw);
    if (token) {
      const db = getDb();
      db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?").run(
        new Date().toISOString(),
        sha256Hex(token)
      );
    }
  }
  jar.delete(SESSION_COOKIE_NAME);
}

export async function getAuthContextFromCookieValue(
  cookieValue: string | undefined
): Promise<AuthContext | null> {
  if (!cookieValue) return null;
  const token = verifySignedToken(cookieValue);
  if (!token) return null;

  const db = getDb();
  const tokenHash = sha256Hex(token);
  const row = normalizeRow<{
    session_id: string;
    user_id: string;
    email: string;
    full_name: string;
    job_title: string | null;
    user_status: string;
    mfa_enabled: number;
    active_organization_id: string | null;
    active_city_id: string | null;
    is_career_fest: number;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
  }>(
    db
      .prepare(
        `SELECT s.id AS session_id, s.user_id, s.active_organization_id, s.active_city_id,
                s.is_career_fest, s.created_at, s.expires_at, s.revoked_at,
                u.email, u.full_name, u.job_title, u.status AS user_status, u.mfa_enabled
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash)
  );

  if (!row || row.revoked_at || row.user_status !== "ACTIVE") {
    return null;
  }

  const isCareerFest = Boolean(row.is_career_fest);
  const effectiveExpiryMs = resolveEffectiveSessionExpiryMs({
    isCareerFest,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  });

  if (effectiveExpiryMs <= Date.now()) {
    revokeSessionIfNeeded(db, row.session_id, isCareerFest);
    return null;
  }

  const memberships = normalizeRows<{
    organization_id: string;
    organization_name: string;
    organization_slug: string;
    role_code: string;
  }>(
    db
      .prepare(
        `SELECT m.organization_id, o.name AS organization_name, o.slug AS organization_slug, m.role_code
         FROM organization_memberships m
         JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = ? AND m.status = 'ACTIVE'
         ORDER BY m.created_at ASC`
      )
      .all(row.user_id)
  );

  if (memberships.length === 0) return null;

  const active =
    memberships.find((m) => m.organization_id === row.active_organization_id) ??
    memberships[0];

  // Strict server-side binding: Career Fest visitor sessions and role may only operate together inside the isolated showcase org
  if (
    isCareerFest &&
    (active.role_code !== CAREER_FEST_ROLE_CODE || active.organization_id !== CAREER_FEST_ORG_ID)
  ) {
    return null;
  }
  if (!isCareerFest && active.role_code === CAREER_FEST_ROLE_CODE) {
    return null;
  }

  const remainingSeconds = Math.max(0, Math.floor((effectiveExpiryMs - Date.now()) / 1000));

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    mfaEnabled: Boolean(row.mfa_enabled),
    organizationId: active.organization_id,
    organizationName: active.organization_name,
    organizationSlug: active.organization_slug,
    roleCode: active.role_code,
    permissions: getRolePermissions(active.role_code),
    activeCityId: row.active_city_id,
    isCareerFestVisitor: isCareerFest,
    sessionCreatedAt: row.created_at,
    sessionExpiresAt: new Date(effectiveExpiryMs).toISOString(),
    sessionRemainingSeconds: remainingSeconds,
    memberships: isCareerFest
      ? [
          {
            organizationId: active.organization_id,
            organizationName: active.organization_name,
            organizationSlug: active.organization_slug,
            roleCode: active.role_code,
          },
        ]
      : memberships.map((m) => ({
          organizationId: m.organization_id,
          organizationName: m.organization_name,
          organizationSlug: m.organization_slug,
          roleCode: m.role_code,
        })),
  };
}

export function isExpiredCareerFestCookie(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const token = verifySignedToken(cookieValue);
  if (!token) return false;
  const db = getDb();
  const row = normalizeRow<{ is_career_fest: number }>(
    db.prepare("SELECT is_career_fest FROM sessions WHERE token_hash = ?").get(sha256Hex(token))
  );
  return Boolean(row?.is_career_fest);
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const jar = await cookies();
  const cookieVal = jar.get(SESSION_COOKIE_NAME)?.value;
  return getAuthContextFromCookieValue(cookieVal);
}

export async function requirePageAuth(): Promise<AuthContext> {
  const jar = await cookies();
  const cookieVal = jar.get(SESSION_COOKIE_NAME)?.value;
  const ctx = await getAuthContextFromCookieValue(cookieVal);
  if (!ctx) {
    if (isExpiredCareerFestCookie(cookieVal)) {
      redirect("/career-fest?expired=1");
    }
    redirect("/sign-in");
  }
  return ctx;
}

export async function getClientIp(): Promise<string> {
  try {
    const hdr = await headers();
    return resolveClientIpFromHeaders(hdr);
  } catch {
    return isTrustedProxyEnabled() ? "127.0.0.1" : "direct-unproxied";
  }
}

export function revokeAllUserSessions(userId: string): number {
  const db = getDb();
  const res = db
    .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), userId);
  return Number(res.changes ?? 0);
}

export async function requireAuth(permission?: string): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: Response }
> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      ok: false,
      response: apiError("UNAUTHORIZED", "Authentication required.", 401),
    };
  }
  if (permission && !hasPermission(ctx.permissions, permission)) {
    return {
      ok: false,
      response: apiError(
        "FORBIDDEN",
        `Missing required permission: ${permission}`,
        403
      ),
    };
  }
  return { ok: true, response: undefined as never, ctx } as { ok: true; ctx: AuthContext };
}
