import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "SMART GRID AI" };

export default function PublicAiPage() {
  const configured = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
  return (
    <PublicSectionPage
      eyebrow="Governed Urban AI"
      title="SMART GRID AI"
      lead="One unified, permission-aware AI service spanning the Enterprise AI Workspace, Floating Contextual Assistant, Division Analytics, and SMART GRID SHEETS Copilot."
      status={configured ? "LIVE" : "INTEGRATION_REQUIRED"}
      primaryCta={{ href: "/app/ai", label: "Open AI Workspace" }}
      secondaryCta={{ href: "/security", label: "AI Governance & Security" }}
      notice={
        configured
          ? "An external LLM provider key is configured in the server environment."
          : "Availability Notice: No external LLM provider key (GEMINI_API_KEY or OPENAI_API_KEY) is currently configured. SMART GRID AI enforces honest UNAVAILABLE / INTEGRATION REQUIRED status rather than simulating fake AI answers."
      }
      cards={[
        {
          eyebrow: "Access Boundaries",
          title: "Permission-Aware Retrieval",
          body: "Context retrieval runs strictly within the authenticated user's active organization and role permissions before any prompt reaches a model.",
        },
        {
          eyebrow: "Traceability",
          title: "Source Citations & Explicit Uncertainty",
          body: "Responses cite exact dataset IDs, timestamps, and data status tags. AI-generated reports remain DRAFT until human approval.",
        },
        {
          eyebrow: "Security",
          title: "Prompt Injection & Data Masking",
          body: "Imported files and datasets are treated strictly as untrusted data, never system instructions. Credentials and secrets are never included in prompts.",
        },
        {
          eyebrow: "Fail-Safe",
          title: "Honest Unavailable Handling",
          body: "When an external provider is unconfigured or unreachable, SMART GRID preserves user input, discloses the outage, and never fabricates answers.",
        },
      ]}
    />
  );
}
