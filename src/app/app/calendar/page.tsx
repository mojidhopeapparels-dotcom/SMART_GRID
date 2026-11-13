import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { CalendarCollabClient } from "@/components/enterprise/CalendarCollabClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const events = normalizeRows<{
    id: string;
    title: string;
    event_type: string;
    division_code: string | null;
    start_at: string;
    end_at: string;
    location: string | null;
  }>(db.prepare("SELECT * FROM calendar_events WHERE organization_id = ? ORDER BY start_at ASC").all(orgId));

  const messages = normalizeRows<{
    id: string;
    channel: string;
    author_name: string;
    body: string;
    created_at: string;
  }>(db.prepare("SELECT * FROM team_messages WHERE organization_id = ? ORDER BY created_at DESC LIMIT 60").all(orgId));

  const cities = normalizeRows<{ id: string; name: string }>(
    db.prepare("SELECT id, name FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC").all(orgId)
  );

  return (
    <CalendarCollabClient
      initialEvents={events}
      initialMessages={messages}
      cities={cities}
      canWrite={ctx.permissions.includes("operations:write")}
    />
  );
}
