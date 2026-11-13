import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRow, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import {
  requireAuth,
  getClientIp,
  assertMutationSecurity,
  assertPermittedCity,
  assertValidDivision,
} from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/auth/audit";
import { CAREER_FEST_MAX_AI_TURNS_PER_SESSION } from "@/lib/careerFest/constants";
import { isCareerFestAiLimitReached } from "@/lib/careerFest/service";
import {
  getAiProviderStatus,
  invokeConfiguredAiProvider,
  retrievePermittedContext,
} from "@/lib/ai/provider";
import {
  commitAiTurnAndUsage,
  releaseAiQuotaReservation,
  reserveAiQuotaSlot,
} from "@/lib/ai/quota";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const ChatSchema = z.object({
  sessionId: z.string().optional(),
  cityId: z.string().nullable().optional(),
  divisionCode: z.string().nullable().optional(),
  prompt: z.string().min(2).max(4000),
  mode: z.enum(["WORKSPACE", "ASSISTANT", "SHEETS_COPILOT", "REPORT_DRAFT"]).default("WORKSPACE"),
  extraContext: z.string().max(4000).optional(),
});

export async function GET() {
  ensureSeeded();
  const auth = await requireAuth("ai:use");
  if (!auth.ok) return auth.response;

  const db = getDb();
  const sessions = auth.ctx.isCareerFestVisitor
    ? normalizeRows(
        db
          .prepare(
            `SELECT * FROM ai_sessions
             WHERE organization_id = ? AND user_id = ? AND owner_session_id = ?
             ORDER BY updated_at DESC LIMIT 25`
          )
          .all(auth.ctx.organizationId, auth.ctx.userId, auth.ctx.sessionId)
      )
    : normalizeRows(
        db
          .prepare(
            `SELECT * FROM ai_sessions
             WHERE organization_id = ? AND user_id = ?
             ORDER BY updated_at DESC LIMIT 25`
          )
          .all(auth.ctx.organizationId, auth.ctx.userId)
      );

  return apiSuccess({
    providerStatus: getAiProviderStatus(),
    sessions,
  });
}

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("ai:use");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Prompt is required (2-4000 chars).", 400);
  }

  const db = getDb();
  if (
    parsed.data.cityId &&
    !assertPermittedCity(db, parsed.data.cityId, auth.ctx.organizationId)
  ) {
    return apiError(
      "FORBIDDEN",
      "The specified city does not exist or is not accessible to your organization.",
      403
    );
  }

  if (
    parsed.data.divisionCode &&
    !assertValidDivision(parsed.data.divisionCode)
  ) {
    return apiError("VALIDATION_ERROR", "Unknown division code.", 400);
  }

  const existingSessionId = parsed.data.sessionId;
  const isNewSession = !existingSessionId;
  const sessionId = existingSessionId || `ais_${crypto.randomUUID().slice(0, 12)}`;

  if (existingSessionId) {
    const owned = auth.ctx.isCareerFestVisitor
      ? normalizeRow<{ id: string }>(
          db
            .prepare(
              "SELECT id FROM ai_sessions WHERE id = ? AND organization_id = ? AND user_id = ? AND owner_session_id = ?"
            )
            .get(existingSessionId, auth.ctx.organizationId, auth.ctx.userId, auth.ctx.sessionId)
        )
      : normalizeRow<{ id: string }>(
          db
            .prepare("SELECT id FROM ai_sessions WHERE id = ? AND organization_id = ? AND user_id = ?")
            .get(existingSessionId, auth.ctx.organizationId, auth.ctx.userId)
        );
    if (!owned) {
      return apiError("FORBIDDEN", "AI session not found in your organization context.", 403);
    }
  }

  if (auth.ctx.isCareerFestVisitor) {
    const ip = await getClientIp();
    const rl = checkRateLimit(`cf:ai:ip:${ip}`, 15, 60_000);
    if (!rl.allowed) {
      return apiError(
        "RATE_LIMITED",
        "Too many AI requests from this connection. Please wait a minute before trying again.",
        429
      );
    }
    if (isCareerFestAiLimitReached(db, auth.ctx.organizationId, auth.ctx.sessionId)) {
      return apiError(
        "VISITOR_AI_LIMIT",
        `Career Fest visitor sessions include up to ${CAREER_FEST_MAX_AI_TURNS_PER_SESSION} SMART GRID AI turns per 30-minute session.`,
        429
      );
    }
  }

  const reservation = reserveAiQuotaSlot({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
  });

  if (!reservation.ok) {
    return apiError(
      "AI_QUOTA_EXCEEDED",
      `Monthly AI request quota reached (${reservation.used}/${reservation.quota}). Upgrade plan or wait for the next billing cycle.`,
      429
    );
  }

  let committed = false;
  try {
    const retrieval = retrievePermittedContext({
      organizationId: auth.ctx.organizationId,
      cityId: parsed.data.cityId ?? null,
      divisionCode: parsed.data.divisionCode ?? null,
      query: parsed.data.prompt,
    });

    const combinedContext = parsed.data.extraContext
      ? `${retrieval.contextText}\n[SELECTED_WORKSPACE_CONTEXT]\n${parsed.data.extraContext}`
      : retrieval.contextText;

    const systemInstruction =
      parsed.data.mode === "REPORT_DRAFT"
        ? "You are SMART GRID AI drafting a structured urban intelligence report (Executive Summary, Scope, Datasets, Observations, Limitations, Suggested Actions). Label all drafts as requiring human approval."
        : parsed.data.mode === "SHEETS_COPILOT"
          ? "You are SMART GRID SHEETS Copilot. Explain formulas, suggest cleaning steps, and provide formula drafts without claiming live city telemetry."
          : "You are SMART GRID AI, an enterprise smart city intelligence assistant. Answer strictly from permitted records with source citations and explicit data status disclosure.";

    const aiResult = await invokeConfiguredAiProvider({
      systemInstruction,
      userPrompt: parsed.data.prompt,
      untrustedDataContext: combinedContext,
    });

    writeAuditLog({
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
      action: "AI_QUERY_EXECUTED",
      resourceType: "AI_SESSION",
      resourceId: existingSessionId ?? null,
      outcome: aiResult.ok ? "SUCCESS" : "ERROR",
      details: { mode: parsed.data.mode, citationsCount: retrieval.citations.length },
    });

    if (!aiResult.ok) {
      releaseAiQuotaReservation(reservation.reservationId);
      committed = true;
      return apiError(aiResult.code, aiResult.message, aiResult.status, {
        ...(existingSessionId ? { sessionId: existingSessionId } : {}),
        citations: retrieval.citations,
        providerStatus: getAiProviderStatus(),
      });
    }

    const { assistantMsgId } = commitAiTurnAndUsage({
      reservationId: reservation.reservationId,
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
      ownerSessionId: auth.ctx.isCareerFestVisitor ? auth.ctx.sessionId : null,
      sessionId,
      isNewSession,
      cityId: parsed.data.cityId ?? null,
      divisionCode: parsed.data.divisionCode ?? null,
      prompt: parsed.data.prompt,
      replyText: aiResult.text,
      provider: aiResult.provider,
      model: aiResult.model,
      citationsJson: JSON.stringify(retrieval.citations),
    });
    committed = true;

    return apiSuccess({
      sessionId,
      messageId: assistantMsgId,
      reply: aiResult.text,
      provider: aiResult.provider,
      model: aiResult.model,
      citations: retrieval.citations,
    });
  } finally {
    if (!committed) {
      releaseAiQuotaReservation(reservation.reservationId);
    }
  }
}
