import crypto from "node:crypto";
import { getDb } from "@/lib/db";

export interface AuditInput {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: "SUCCESS" | "DENIED" | "ERROR";
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export function writeAuditLog(input: AuditInput): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, action, resource_type, resource_id,
        outcome, details_json, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `aud_${crypto.randomUUID()}`,
      input.organizationId ?? null,
      input.userId ?? null,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      input.outcome ?? "SUCCESS",
      JSON.stringify(input.details ?? {}),
      input.ipAddress ?? null,
      new Date().toISOString()
    );
  } catch {
    // Never crash core requests on non-fatal audit write errors
  }
}
