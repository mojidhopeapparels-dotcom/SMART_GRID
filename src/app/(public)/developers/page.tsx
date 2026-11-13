import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Developer Portal" };

export default function DevelopersPage() {
  return (
    <PublicSectionPage
      eyebrow="API Ecosystem"
      title="SMART GRID Developer Portal"
      lead="Versioned /api/v1 REST endpoints, scoped API keys, webhook subscriptions, rate limiting, and consistent error envelopes."
      primaryCta={{ href: "/app/developer", label: "Manage API Keys (Enterprise)" }}
      secondaryCta={{ href: "/status", label: "Check API Health" }}
      cards={[
        {
          eyebrow: "Versioned Endpoints",
          title: "Core /api/v1 Resource Families",
          body: "Structured JSON envelopes with requestId correlation, pagination, and strict Zod schema validation.",
          points: [
            "GET / POST /api/v1/cities",
            "GET /api/v1/divisions",
            "GET / POST /api/v1/datasets",
            "GET / POST /api/v1/workbooks & /export",
            "GET / POST /api/v1/operations",
            "POST /api/v1/ai/chat",
          ],
        },
        {
          eyebrow: "Authentication",
          title: "Session Cookies & Scoped API Keys",
          body: "Browser sessions use HMAC-signed HTTP-only cookies; programmatic integrations can mint SHA-256 hashed API keys with explicit scopes inside the Enterprise Developer Portal.",
        },
        {
          eyebrow: "Error Envelope",
          title: "Standardized Error Contracts",
          body: "Errors return { error: { code, message, requestId } } without leaking stack traces, database paths, or environment secrets.",
        },
        {
          eyebrow: "Webhooks & Limits",
          title: "Rate Limiting & Webhook Registry",
          body: "Sliding-window rate limiting protects auth and public endpoints. Organizations can register event webhook targets for alerts and incidents.",
        },
      ]}
    />
  );
}
