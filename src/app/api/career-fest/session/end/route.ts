import {
  assertMutationSecurity,
  getAuthContext,
  revokeCurrentSession,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { recordCareerFestEvent } from "@/lib/careerFest/service";
import { apiSuccess } from "@/lib/domain/statuses";

export async function POST(req: Request) {
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ctx = await getAuthContext();
  await revokeCurrentSession();

  if (ctx?.isCareerFestVisitor) {
    recordCareerFestEvent("VISITOR_EXIT");
    writeAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CAREER_FEST_SESSION_END",
      resourceType: "SESSION",
      resourceId: ctx.sessionId,
      outcome: "SUCCESS",
    });
  }

  return apiSuccess({
    ended: true,
    redirectTo: "/career-fest?ended=1",
  });
}
