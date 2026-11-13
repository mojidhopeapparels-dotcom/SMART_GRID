import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { sha256Hex } from "./password";

const RECOVERY_CODE_COUNT = 8;

export function normalizeRecoveryCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function hashRecoveryCode(userId: string, rawCode: string): string {
  return sha256Hex(`${userId}:${normalizeRecoveryCode(rawCode)}`);
}

export function generateRecoveryCodeBatch(
  count = RECOVERY_CODE_COUNT
): { displayCodes: string[]; normalizedCodes: string[] } {
  const displayCodes: string[] = [];
  const normalizedCodes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(6).toString("hex").toUpperCase(); // 12 hex chars (48 bits)
    displayCodes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`);
    normalizedCodes.push(raw);
  }
  return { displayCodes, normalizedCodes };
}

export function issueRecoveryCodesForUser(
  tx: DatabaseSync,
  userId: string,
  count = RECOVERY_CODE_COUNT
): string[] {
  tx.prepare("DELETE FROM mfa_recovery_codes WHERE user_id = ?").run(userId);
  const { displayCodes, normalizedCodes } = generateRecoveryCodeBatch(count);
  const now = new Date().toISOString();
  const ins = tx.prepare(
    "INSERT INTO mfa_recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)"
  );
  for (const code of normalizedCodes) {
    ins.run(`mrc_${crypto.randomUUID().slice(0, 12)}`, userId, hashRecoveryCode(userId, code), now);
  }
  return displayCodes;
}

export function verifyAndConsumeRecoveryCode(
  db: DatabaseSync,
  userId: string,
  rawCode: string
): boolean {
  const norm = normalizeRecoveryCode(rawCode);
  if (norm.length < 8) return false;
  const codeHash = hashRecoveryCode(userId, norm);
  const now = new Date().toISOString();
  const row = db
    .prepare(
      "SELECT id FROM mfa_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1"
    )
    .get(userId, codeHash) as { id: string } | undefined;
  if (!row) return false;
  const upd = db
    .prepare("UPDATE mfa_recovery_codes SET used_at = ? WHERE id = ? AND used_at IS NULL")
    .run(now, row.id);
  return upd.changes === 1;
}
