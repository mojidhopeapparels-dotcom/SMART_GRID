import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "About SMART GRID" };

export default function AboutPage() {
  return (
    <PublicSectionPage
      eyebrow="About SMART GRID"
      title="The Intelligence Behind Tomorrow's Cities."
      lead="SMART GRID is a global modular ecosystem designed to help municipal leaders, urban planners, infrastructure operators, and researchers understand city systems through traceable data and governed workflows."
      primaryCta={{ href: "/platform", label: "Explore Platform Overview" }}
      secondaryCta={{ href: "/contact", label: "Contact Us" }}
      notice="Truthfulness Commitment: SMART GRID does not invent client logos, municipal endorsements, or unverified uptime statistics. All sample datasets in evaluation mode are explicitly marked SIMULATED or HISTORICAL."
      cards={[
        {
          eyebrow: "Vision",
          title: "Global by Design",
          body: "Built to support cities across diverse countries, administrative hierarchies, currencies, timezones, and levels of digital infrastructure maturity.",
        },
        {
          eyebrow: "Integrity",
          title: "Evidence-Led Urban Intelligence",
          body: "Every KPI, chart, forecast, and AI summary exposes its source dataset, observation period, and known limitations.",
        },
        {
          eyebrow: "Accountability",
          title: "Human Control on Critical Actions",
          body: "SMART GRID is an intelligence and coordination platform. Important approvals, publications, and operational changes remain under authorized human oversight.",
        },
        {
          eyebrow: "Architecture",
          title: "Connected Modular Ecosystem",
          body: "Unifies the Public Transparency Portal and Multi-Tenant Enterprise Workspace over shared contracts for 24 divisions, AI, SHEETS, and GIS.",
        },
      ]}
    />
  );
}
