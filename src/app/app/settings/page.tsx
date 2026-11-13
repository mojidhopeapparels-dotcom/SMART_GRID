import Link from "next/link";
import { requirePageAuth } from "@/lib/auth/session";
import { getAiProviderStatus } from "@/lib/ai/provider";
import { SettingsMfaClient } from "@/components/enterprise/SettingsMfaClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requirePageAuth();
  if (ctx.isCareerFestVisitor) {
    return (
      <div className="sg-card">
        <span className="sg-badge sg-badge-danger">FORBIDDEN · HTTP 403</span>
        <h1 style={{ fontSize: "1.4rem", marginTop: "0.5rem" }}>
          Account Security &amp; Settings Restricted
        </h1>
        <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
          Career Fest 2026 visitor sessions operate inside an ephemeral 30-minute sandbox and cannot
          view or modify account credentials, MFA secrets, or administrative workspace settings.
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <Link href="/app" className="sg-btn sg-btn-primary">
            Return to Workspace Home
          </Link>
          <Link href="/app/divisions" className="sg-btn sg-btn-outline">
            Explore 24 Divisions
          </Link>
        </div>
      </div>
    );
  }
  const aiStatus = getAiProviderStatus();

  return (
    <SettingsMfaClient
      email={ctx.email}
      fullName={ctx.fullName}
      jobTitle={ctx.jobTitle}
      roleCode={ctx.roleCode}
      organizationName={ctx.organizationName}
      initialMfaEnabled={ctx.mfaEnabled}
      aiProviderSummary={{
        configured: aiStatus.configured,
        label: aiStatus.configured ? `${aiStatus.provider} (LIVE)` : "INTEGRATION_REQUIRED",
        model: aiStatus.model,
      }}
    />
  );
}
