import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <PublicSectionPage
      eyebrow="Legal & Governance"
      title="Terms of Use"
      lead="Operational scope, safety boundaries, and responsible use guidelines for SMART GRID."
      notice="Legal Review Notice: Review with institutional legal counsel prior to external production deployment."
      cards={[
        {
          title: "Intelligence & Coordination Scope",
          body: "SMART GRID provides analytical and operational coordination tools. It is not a certified statutory accounting ledger, clinical EHR, 911/CAD emergency dispatch system, or direct utility SCADA controller.",
        },
        {
          title: "Data Provenance & User Responsibility",
          body: "Organizations remain responsible for verifying licensing, accuracy, and legal authority before connecting external APIs or publishing datasets to the Open Data Center.",
        },
        {
          title: "Human Accountability",
          body: "Outputs from SMART GRID AI and Scenario Laboratory are decision-support aids and require human review before policy or operational execution.",
        },
        {
          title: "Acceptable Use & Security",
          body: "Authorized users must protect credentials, enable MFA where required, and avoid bypassing tenant or permission boundaries.",
        },
      ]}
    />
  );
}
