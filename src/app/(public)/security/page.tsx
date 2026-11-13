import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Security & Data Trust" };

export default function SecurityPage() {
  return (
    <PublicSectionPage
      eyebrow="Security & Governance"
      title="Security & Data Trust"
      lead="Server-side authorization, tenant isolation, cryptographic authentication, and full auditability built as core infrastructure."
      primaryCta={{ href: "/app/security", label: "Enterprise Security Center" }}
      secondaryCta={{ href: "/privacy", label: "Privacy Policy" }}
      notice="Control Transparency: This page describes controls implemented in the current codebase (scrypt password hashing, TOTP MFA, HTTP-only signed sessions, server-side RBAC, organization isolation, and audit logs) separately from external enterprise deployment requirements (managed KMS, WAF, external SOC audits)."
      cards={[
        {
          eyebrow: "Implemented Control",
          title: "Authentication & TOTP MFA",
          body: "Passwords are hashed with per-user random salts via scrypt and verified in constant time. Users can enroll RFC 6238 TOTP multi-factor authentication.",
        },
        {
          eyebrow: "Implemented Control",
          title: "Server-Side RBAC & Tenant Isolation",
          body: "Every enterprise API endpoint verifies session validity, role permissions, and organization membership before querying or mutating records.",
        },
        {
          eyebrow: "Implemented Control",
          title: "Audit Logging & Security Headers",
          body: "Authentication, role changes, API key creation, dataset ingestion, exports, and workflow approvals write immutable audit records. Security headers (X-Frame-Options, nosniff, Referrer-Policy) are enforced.",
        },
        {
          eyebrow: "Planned / External Deployment",
          title: "Production Hardening Scope",
          body: "Production deployments should pair this application with managed PostgreSQL/PostGIS, TLS termination, external secret managers (KMS/Vault), and independent penetration testing.",
        },
      ]}
    />
  );
}
