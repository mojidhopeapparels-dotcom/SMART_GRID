import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <PublicSectionPage
      eyebrow="Legal & Privacy"
      title="Privacy Policy"
      lead="Principles governing personal data minimization, organization tenant isolation, audit retention, and enquiry handling in SMART GRID."
      notice="Legal Review Notice: This template documents the technical privacy controls implemented in SMART GRID and should be reviewed by qualified legal counsel for jurisdiction-specific compliance (e.g., GDPR, CCPA, local municipal statutes) prior to production launch."
      cards={[
        {
          title: "Data Minimization & Purpose Limitation",
          body: "SMART GRID collects only account details, organization memberships, operational city records, and explicit enquiry submissions needed to operate authorized workflows.",
        },
        {
          title: "Prohibition on Identifiable Health & Student PHI",
          body: "Healthcare (Division 12) and Education (Division 21) modules store aggregate facility and capacity metadata only—identifiable patient or student records are out of scope.",
        },
        {
          title: "Tenant Isolation & Access Requests",
          body: "Private organization records are isolated per tenant. Administrators can export audit trails, deactivate accounts, and manage retention settings.",
        },
        {
          title: "AI Context Privacy",
          body: "AI queries execute strictly against permitted organization data and never cross tenant boundaries.",
        },
      ]}
    />
  );
}
