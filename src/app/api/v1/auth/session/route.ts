import { z } from "zod";
import { getDb, normalizeRow } from "@/lib/db";
import { requireAuth, assertMutationSecurity } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const SwitchContextSchema = z.object({
  organizationId: z.string().optional(),
  cityId: z.string().nullable().optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  return apiSuccess(auth.ctx);
}

export async function PATCH(req: Request) {
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = SwitchContextSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid context selection.", 400);
  }

  const db = getDb();
  let nextOrgId = auth.ctx.organizationId;

  if (parsed.data.organizationId) {
    if (
      auth.ctx.isCareerFestVisitor &&
      parsed.data.organizationId !== auth.ctx.organizationId
    ) {
      return apiError(
        "FORBIDDEN",
        "Career Fest visitor sessions cannot switch organizations.",
        403
      );
    }
    const member = auth.ctx.memberships.find(
      (m) => m.organizationId === parsed.data.organizationId
    );
    if (!member) {
      writeAuditLog({
        organizationId: auth.ctx.organizationId,
        userId: auth.ctx.userId,
        action: "ORG_SWITCH",
        resourceType: "ORGANIZATION",
        resourceId: parsed.data.organizationId,
        outcome: "DENIED",
      });
      return apiError("FORBIDDEN", "Not a member of the requested organization.", 403);
    }
    nextOrgId = member.organizationId;
  }

  let nextCityId = auth.ctx.activeCityId;
  if (parsed.data.cityId !== undefined) {
    if (parsed.data.cityId === null) {
      nextCityId = null;
    } else {
      const city = normalizeRow<{ id: string }>(
        db
          .prepare(
            "SELECT id FROM cities WHERE id = ? AND (organization_id = ? OR is_public = 1)"
          )
          .get(parsed.data.cityId, nextOrgId)
      );
      if (!city) {
        return apiError("NOT_FOUND", "Permitted city not found.", 404);
      }
      nextCityId = city.id;
    }
  }

  db.prepare(
    "UPDATE sessions SET active_organization_id = ?, active_city_id = ? WHERE id = ?"
  ).run(nextOrgId, nextCityId, auth.ctx.sessionId);

  return apiSuccess({ organizationId: nextOrgId, activeCityId: nextCityId });
}
