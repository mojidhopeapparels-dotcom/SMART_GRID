import { ensureSeeded } from "@/lib/db/seed";
import {
  assertMutationSecurity,
  createSession,
  getAuthContext,
  getClientIp,
  setSessionCookie,
} from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  CAREER_FEST_ORG_ID,
  CAREER_FEST_ROLE_CODE,
  CAREER_FEST_SESSION_TTL_SECONDS,
  CAREER_FEST_USER_ID,
} from "@/lib/careerFest/constants";
import { recordCareerFestEvent } from "@/lib/careerFest/service";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ip = await getClientIp();
  // Generous 60/min limit accommodates shared event booth Wi-Fi while throttling automated floods
  const rl = checkRateLimit(`cf:session:start:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many Career Fest session requests from this network. Please wait a moment and try again.",
      429
    );
  }

  // Do not silently extend an already-active visitor session timer when clicked again
  const existing = await getAuthContext();
  if (existing?.isCareerFestVisitor && existing.sessionRemainingSeconds > 0) {
    return apiSuccess({
      sessionId: existing.sessionId,
      roleCode: existing.roleCode,
      organizationId: existing.organizationId,
      expiresAt: existing.sessionExpiresAt,
      remainingSeconds: existing.sessionRemainingSeconds,
      durationSeconds: CAREER_FEST_SESSION_TTL_SECONDS,
      alreadyActive: true,
      redirectTo: "/app",
    });
  }

  const session = await createSession({
    userId: CAREER_FEST_USER_ID,
    organizationId: CAREER_FEST_ORG_ID,
    cityId: "city_dhaka",
    ipAddress: null, // Strictly privacy-conscious: do not persist visitor IP
    userAgent: null,
    isCareerFest: true,
    ttlSeconds: CAREER_FEST_SESSION_TTL_SECONDS,
  });

  await setSessionCookie(session.cookieValue, session.expiresAt);
  recordCareerFestEvent("VISITOR_ENTER");

  writeAuditLog({
    organizationId: CAREER_FEST_ORG_ID,
    userId: CAREER_FEST_USER_ID,
    action: "CAREER_FEST_SESSION_START",
    resourceType: "SESSION",
    resourceId: session.sessionId,
    outcome: "SUCCESS",
    details: { durationSeconds: CAREER_FEST_SESSION_TTL_SECONDS },
  });

  return apiSuccess(
    {
      sessionId: session.sessionId,
      roleCode: CAREER_FEST_ROLE_CODE,
      organizationId: CAREER_FEST_ORG_ID,
      expiresAt: session.expiresAt,
      remainingSeconds: CAREER_FEST_SESSION_TTL_SECONDS,
      durationSeconds: CAREER_FEST_SESSION_TTL_SECONDS,
      alreadyActive: false,
      redirectTo: "/app",
    },
    undefined,
    201
  );
}
