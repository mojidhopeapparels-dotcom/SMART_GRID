import { redirect } from "next/navigation";
import { getDb, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { getAuthContext } from "@/lib/auth/session";
import { EnterpriseShell } from "@/components/enterprise/EnterpriseShell";

export const dynamic = "force-dynamic";

export default async function EnterpriseLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureSeeded();
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/sign-in");
  }

  const db = getDb();
  const cities = normalizeRows<{ id: string; name: string; slug: string }>(
    db
      .prepare(
        "SELECT id, name, slug FROM cities WHERE organization_id = ? OR is_public = 1 ORDER BY name ASC"
      )
      .all(ctx.organizationId)
  );

  return (
    <EnterpriseShell ctx={ctx} cities={cities}>
      {children}
    </EnterpriseShell>
  );
}
