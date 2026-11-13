import crypto from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { getClientIp, assertMutationSecurity } from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/domain/statuses";

const EnquirySchema = z.object({
  category: z.enum(["Enterprise Demo", "City Partnership", "Developer API", "Security & Privacy", "General"]),
  organizationName: z.string().min(2).max(160),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email().max(200),
  message: z.string().min(10).max(4000),
  consentAccepted: z.literal(true),
  websiteHoneypot: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const ip = await getClientIp();
  const rl = checkRateLimit(`enquiry:${ip}`, 8, 60_000);
  if (!rl.allowed) {
    return apiError("RATE_LIMITED", "Too many enquiry submissions. Please try again shortly.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = EnquirySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Please complete all required fields and accept the privacy notice.",
      400
    );
  }

  const id = `enq_${crypto.randomUUID()}`;
  const db = getDb();
  db.prepare(
    `INSERT INTO public_enquiries (id, category, organization_name, contact_name, contact_email, message, consent_accepted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    id,
    parsed.data.category,
    parsed.data.organizationName.trim(),
    parsed.data.contactName.trim(),
    parsed.data.contactEmail.trim().toLowerCase(),
    parsed.data.message.trim(),
    new Date().toISOString()
  );

  return apiSuccess({ enquiryId: id, submitted: true }, undefined, 201);
}
