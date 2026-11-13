import { revokeCurrentSession, getAuthContext, assertMutationSecurity } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiSuccess } from "@/lib/domain/statuses";

export async function POST(req: Request) {
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ctx = await getAuthContext();
  await revokeCurrentSession();
  if (ctx) {
    writeAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "AUTH_SIGN_OUT",
      resourceType: "SESSION",
      resourceId: ctx.sessionId,
    });
  }
  return apiSuccess({ signedOut: true });
}
