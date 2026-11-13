import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { getAiProviderStatus } from "@/lib/ai/provider";
import { AiWorkspaceClient } from "@/components/enterprise/AiWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function EnterpriseAiPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const sessions = ctx.isCareerFestVisitor
    ? normalizeRows<{
        id: string;
        title: string;
        division_code: string | null;
        updated_at: string;
      }>(
        db
          .prepare(
            "SELECT id, title, division_code, updated_at FROM ai_sessions WHERE organization_id = ? AND user_id = ? AND owner_session_id = ? ORDER BY updated_at DESC LIMIT 20"
          )
          .all(ctx.organizationId, ctx.userId, ctx.sessionId)
      )
    : normalizeRows<{
        id: string;
        title: string;
        division_code: string | null;
        updated_at: string;
      }>(
        db
          .prepare(
            "SELECT id, title, division_code, updated_at FROM ai_sessions WHERE organization_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 20"
          )
          .all(ctx.organizationId, ctx.userId)
      );

  const cities = normalizeRows<{ id: string; name: string }>(
    db
      .prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC")
      .all(ctx.organizationId)
  );

  return (
    <AiWorkspaceClient
      providerStatus={getAiProviderStatus()}
      initialSessions={sessions}
      cities={cities}
    />
  );
}
