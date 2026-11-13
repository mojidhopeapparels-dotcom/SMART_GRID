import type { Metadata } from "next";
import { DIVISIONS } from "@/lib/domain/divisions";
import { DivisionsDirectoryClient } from "@/components/public/DivisionsDirectoryClient";

export const metadata: Metadata = {
  title: "24 Intelligence Divisions",
  description: "Explore all 24 urban intelligence divisions of the SMART GRID ecosystem.",
};

export default function PublicDivisionsPage() {
  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem" }}>
      <div className="sg-eyebrow">Standardized Urban Taxonomy</div>
      <h1 className="sg-h1">24 City Intelligence Divisions</h1>
      <p className="sg-muted" style={{ maxWidth: "740px", marginBottom: "2rem" }}>
        Every city inside SMART GRID organizes datasets, KPIs, spatial layers, assets, alerts,
        reports, and AI assistance across these 24 domain divisions.
      </p>
      <DivisionsDirectoryClient divisions={DIVISIONS} />
    </div>
  );
}
