import { logEvent } from "../observability/logger";

export interface PasswordResetEmailPayload {
  toEmail: string;
  fullName: string;
  resetUrl: string;
  expiresAt: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  status: "DELIVERED" | "INTEGRATION_REQUIRED" | "DELIVERY_FAILED";
  channel: "webhook" | "smtp_unwired" | "test_sink" | "none";
  detail: string;
}

type TestEmailSink = (payload: PasswordResetEmailPayload) => void | Promise<void>;

function getTestEmailSink(): TestEmailSink | null {
  const g = globalThis as unknown as { __SMART_GRID_EMAIL_SINK__?: TestEmailSink };
  return typeof g.__SMART_GRID_EMAIL_SINK__ === "function" ? g.__SMART_GRID_EMAIL_SINK__ : null;
}

/**
 * Sends transactional password reset instructions via an explicit external delivery boundary.
 * Never logs or echoes plaintext reset tokens in API responses.
 */
export async function sendPasswordResetEmail(
  payload: PasswordResetEmailPayload
): Promise<EmailDeliveryResult> {
  const testSink = getTestEmailSink();
  if (testSink) {
    await testSink(payload);
    return {
      delivered: true,
      status: "DELIVERED",
      channel: "test_sink",
      detail: "Dispatched to registered test email sink.",
    };
  }

  const webhookUrl = process.env.SMART_GRID_EMAIL_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      if (parsed.protocol !== "https:") {
        logEvent("warn", "EMAIL_WEBHOOK_INSECURE_PROTOCOL", { protocol: parsed.protocol });
        return {
          delivered: false,
          status: "INTEGRATION_REQUIRED",
          channel: "webhook",
          detail: "SMART_GRID_EMAIL_WEBHOOK_URL must use https://.",
        };
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const bearer = process.env.SMART_GRID_EMAIL_WEBHOOK_TOKEN?.trim();
      if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
      }
      const res = await fetch(parsed.toString(), {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          template: "password_reset",
          to: payload.toEmail,
          recipientName: payload.fullName,
          resetUrl: payload.resetUrl,
          expiresAt: payload.expiresAt,
          from: process.env.SMART_GRID_SMTP_FROM?.trim() || "no-reply@smartgrid.local",
        }),
      });
      if (!res.ok) {
        logEvent("warn", "EMAIL_WEBHOOK_FAILED", { status: res.status });
        return {
          delivered: false,
          status: "DELIVERY_FAILED",
          channel: "webhook",
          detail: `Configured email relay returned HTTP ${res.status}.`,
        };
      }
      return {
        delivered: true,
        status: "DELIVERED",
        channel: "webhook",
        detail: "Delivered via configured HTTPS email relay.",
      };
    } catch {
      logEvent("warn", "EMAIL_WEBHOOK_ERROR", { message: "Network failure sending password reset email." });
      return {
        delivered: false,
        status: "DELIVERY_FAILED",
        channel: "webhook",
        detail: "Network error reaching configured HTTPS email relay.",
      };
    }
  }

  if (process.env.SMART_GRID_SMTP_HOST?.trim()) {
    logEvent("warn", "SMTP_TRANSPORT_REQUIRES_RELAY", {
      host: process.env.SMART_GRID_SMTP_HOST.trim(),
    });
    return {
      delivered: false,
      status: "INTEGRATION_REQUIRED",
      channel: "smtp_unwired",
      detail:
        "SMART_GRID_SMTP_HOST is declared, but native SMTP socket transport is not bundled in this runtime; configure SMART_GRID_EMAIL_WEBHOOK_URL or attach an external SMTP relay worker.",
    };
  }

  logEvent("info", "PASSWORD_RESET_EMAIL_NOT_DISPATCHED_INTEGRATION_REQUIRED");
  return {
    delivered: false,
    status: "INTEGRATION_REQUIRED",
    channel: "none",
    detail: "No external email relay is configured (set SMART_GRID_EMAIL_WEBHOOK_URL).",
  };
}
