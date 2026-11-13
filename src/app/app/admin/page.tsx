import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/auth/rbac";
import { AdminClient } from "@/components/enterprise/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await requirePageAuth();
  if (!ctx.permissions.includes("org:manage") && !ctx.permissions.includes("users:manage")) {
    return (
      <div className="sg-card">
        <span className="sg-badge sg-badge-error">FORBIDDEN (403)</span>
        <h1 style={{ fontSize: "1.4rem", marginTop: "0.5rem" }}>Administration Access Required</h1>
        <p className="sg-muted" style={{ marginTop: "0.35rem" }}>
          Your assigned role (<code>{ctx.roleCode}</code>) does not hold <code>org:manage</code> or <code>users:manage</code> permissions.
        </p>
      </div>
    );
  }

  const db = getDb();
  const orgId = ctx.organizationId;
  const organization = normalizeRow<{ id: string; name: string; slug: string; plan_code: string; verification_status: string }>(
    db.prepare("SELECT id, name, slug, plan_code, verification_status FROM organizations WHERE id = ?").get(orgId)
  )!;

  const members = normalizeRows<{
    membership_id: string;
    role_code: string;
    department: string;
    membership_status: string;
    user_id: string;
    email: string;
    full_name: string;
    job_title: string | null;
    mfa_enabled: number;
  }>(
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

  return (
    <AdminClient
      organization={organization}
      initialMembers={members}
      roles={SYSTEM_ROLES}
      permissions={PERMISSIONS}
      canManageUsers={ctx.permissions.includes("users:manage")}
    />
  );
}
