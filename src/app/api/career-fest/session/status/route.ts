import { cookies } from "next/headers";
import { ensureSeeded } from "@/lib/db/seed";
import {
  clearSessionCookie,
  getAuthContext,
  isExpiredCareerFestCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { CAREER_FEST_SESSION_TTL_SECONDS } from "@/lib/careerFest/constants";
import { apiSuccess } from "@/lib/domain/statuses";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureSeeded();
  const jar = await cookies();
  const rawCookie = jar.get(SESSION_COOKIE_NAME)?.value;
  const ctx = await getAuthContext();

  if (!ctx || !ctx.isCareerFestVisitor) {
    const expired = isExpiredCareerFestCookie(rawCookie);
    if (expired && rawCookie) {
      await clearSessionCookie();
    }
    return apiSuccess({
      active: false,
      expired,
      remainingSeconds: 0,
      durationSeconds: CAREER_FEST_SESSION_TTL_SECONDS,
      serverTime: new Date().toISOString(),
    });
  }

  return apiSuccess({
    active: true,
    expired: false,
    roleCode: ctx.roleCode,
    organizationName: ctx.organizationName,
    createdAt: ctx.sessionCreatedAt,
    expiresAt: ctx.sessionExpiresAt,
    remainingSeconds: ctx.sessionRemainingSeconds,
    durationSeconds: CAREER_FEST_SESSION_TTL_SECONDS,
    serverTime: new Date().toISOString(),
  });
}
