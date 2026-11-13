import type { Metadata } from "next";
import { ensureSeeded } from "@/lib/db/seed";
import { getAuthContext } from "@/lib/auth/session";
import { recordCareerFestEvent } from "@/lib/careerFest/service";
import { CareerFestLandingClient } from "@/components/public/CareerFestLandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Career Fest 2026 Showcase — WELCOME TO SMART GRID",
  description:
    "Explore SMART GRID — The Intelligence Behind Tomorrow's Cities. Launch a 30-minute guided visitor session across 24 Intelligence Divisions, Digital Twin GIS, SMART GRID AI, and SMART GRID SHEETS.",
};

export default async function CareerFestPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; ended?: string }>;
}) {
  ensureSeeded();
  recordCareerFestEvent("LANDING_VIEW");
  const sp = await searchParams;
  const ctx = await getAuthContext();

  const statusNotice =
    sp.expired === "1" ? "expired" : sp.ended === "1" ? "ended" : null;

  const activeSession =
    ctx && ctx.isCareerFestVisitor && ctx.sessionRemainingSeconds > 0
      ? {
          expiresAt: ctx.sessionExpiresAt,
          remainingSeconds: ctx.sessionRemainingSeconds,
        }
      : null;

  return (
    <CareerFestLandingClient
      activeSession={activeSession}
      statusNotice={statusNotice}
    />
  );
}
