import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { AlertsClient } from "@/components/enterprise/AlertsClient";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const ctx = await requirePageAuth();
  const db = getDb();

  const alerts = normalizeRows<{
    id: string;
    title: string;
    message: string;
    alert_type: string;
    priority: string;
    status: string;
    data_status: string;
    created_at: string;
  }>(
    db.prepare("SELECT * FROM alerts WHERE organization_id = ? ORDER BY created_at DESC").all(ctx.organizationId)
  );

  const notifications = normalizeRows<{
    id: string;
    title: string;
    body: string;
    category: string;
    is_read: number;
    created_at: string;
  }>(
    db
      .prepare("SELECT * FROM notifications WHERE organization_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 30")
      .all(ctx.organizationId, ctx.userId)
  );

  return (
    <AlertsClient
      initialAlerts={alerts}
      initialNotifications={notifications}
      canWrite={ctx.permissions.includes("operations:write")}
    />
  );
}
