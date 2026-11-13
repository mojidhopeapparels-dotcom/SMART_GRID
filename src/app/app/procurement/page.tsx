import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { ProcurementClient } from "@/components/enterprise/ProcurementClient";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const vendors = normalizeRows<{
    id: string;
    name: string;
    category: string;
    compliance_status: string;
    contact_email: string | null;
    created_at: string;
  }>(db.prepare("SELECT * FROM vendors WHERE organization_id = ? ORDER BY name ASC").all(orgId));

  const contracts = normalizeRows<{
    id: string;
    title: string;
    contract_value: number;
    currency: string;
    status: string;
    end_date: string | null;
    vendor_name: string | null;
  }>(
    db
      .prepare(
        `SELECT c.*, v.name AS vendor_name
         FROM contracts c
         LEFT JOIN vendors v ON v.id = c.vendor_id
         WHERE c.organization_id = ?
         ORDER BY c.created_at DESC`
      )
      .all(orgId)
  );

  return (
    <ProcurementClient
      initialVendors={vendors}
      initialContracts={contracts}
      canWrite={ctx.permissions.includes("operations:write")}
    />
  );
}
