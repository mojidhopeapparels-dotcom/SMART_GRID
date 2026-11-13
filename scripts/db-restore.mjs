#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function parseArgs(argv) {
  const args = {
    backupFile: "",
    targetDb: process.env.SMART_GRID_DB_PATH?.trim() || path.resolve(process.cwd(), "data", "smart_grid.db"),
    force: false,
    json: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--backup" && argv[i + 1]) args.backupFile = path.resolve(argv[++i]);
    else if (a === "--target" && argv[i + 1]) args.targetDb = path.resolve(argv[++i]);
    else if (a === "--force") args.force = true;
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/db-restore.mjs --backup <file> [--target <dbPath>] [--force] [--json]"
      );
      process.exit(0);
    }
  }
  return args;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const buf = fs.readFileSync(filePath);
  hash.update(buf);
  return { sha256: hash.digest("hex"), bytes: buf.length };
}

function verifySqliteReadOnly(filePath) {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const ic = db.prepare("PRAGMA integrity_check").get();
    const fk = db.prepare("PRAGMA foreign_key_check").all();
    const tables = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .get();
    return {
      integrityCheck: ic?.integrity_check ?? "unknown",
      foreignKeyViolations: fk.length,
      tableCount: tables?.cnt ?? 0,
    };
  } finally {
    db.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.backupFile) {
    throw new Error("Missing required --backup <file> argument.");
  }
  if (!fs.existsSync(args.backupFile)) {
    throw new Error(`Backup file not found: ${args.backupFile}`);
  }

  // 1. Verify optional companion .sha256 file if present
  const actual = sha256File(args.backupFile);
  const shaSidecar = `${args.backupFile}.sha256`;
  let checksumVerified = false;
  if (fs.existsSync(shaSidecar)) {
    const line = fs.readFileSync(shaSidecar, "utf8").trim();
    const expected = line.split(/\s+/)[0]?.toLowerCase();
    if (!expected || expected !== actual.sha256.toLowerCase()) {
      throw new Error(
        `SHA-256 checksum mismatch for ${args.backupFile} (expected=${expected}, actual=${actual.sha256}).`
      );
    }
    checksumVerified = true;
  }

  // 2. Verify backup SQLite health before overwriting target
  const sourceCheck = verifySqliteReadOnly(args.backupFile);
  if (sourceCheck.integrityCheck !== "ok" || sourceCheck.foreignKeyViolations > 0) {
    throw new Error(
      `Backup file failed SQLite integrity/FK verification (integrity=${sourceCheck.integrityCheck}, fk=${sourceCheck.foreignKeyViolations}).`
    );
  }

  // 3. Refuse to overwrite existing DB unless --force is explicitly supplied
  let preRestoreBackup = null;
  if (fs.existsSync(args.targetDb)) {
    if (!args.force) {
      throw new Error(
        `Target DB already exists (${args.targetDb}). Pass --force to create a pre-restore safety copy and overwrite.`
      );
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    preRestoreBackup = `${args.targetDb}.pre-restore-${stamp}.bak`;
    fs.copyFileSync(args.targetDb, preRestoreBackup);
  }

  // 4. Clean WAL/SHM sidecars at target & perform atomic replace
  fs.mkdirSync(path.dirname(args.targetDb), { recursive: true });
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    if (fs.existsSync(`${args.targetDb}${suffix}`)) {
      fs.rmSync(`${args.targetDb}${suffix}`, { force: true });
    }
  }
  const staged = `${args.targetDb}.restoring.${process.pid}`;
  fs.copyFileSync(args.backupFile, staged);
  if (fs.existsSync(args.targetDb)) {
    fs.rmSync(args.targetDb, { force: true });
  }
  fs.renameSync(staged, args.targetDb);

  // 5. Re-verify restored database read-only
  const targetCheck = verifySqliteReadOnly(args.targetDb);
  if (targetCheck.integrityCheck !== "ok" || targetCheck.foreignKeyViolations > 0) {
    throw new Error(
      `Restored DB failed post-restore check (integrity=${targetCheck.integrityCheck}, fk=${targetCheck.foreignKeyViolations}). Pre-restore safety copy: ${preRestoreBackup ?? "none"}`
    );
  }

  const report = {
    status: "VERIFIED_RESTORE_COMPLETE",
    backupFile: args.backupFile,
    targetDb: args.targetDb,
    preRestoreBackup,
    checksumVerified,
    sha256: actual.sha256,
    sizeBytes: actual.bytes,
    integrityCheck: targetCheck.integrityCheck,
    foreignKeyViolations: targetCheck.foreignKeyViolations,
    tableCount: targetCheck.tableCount,
    restoredAt: new Date().toISOString(),
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[OK] Database restored & verified at ${args.targetDb} (tables=${targetCheck.tableCount}, integrity=${targetCheck.integrityCheck}, checksumVerified=${checksumVerified})`
    );
  }
}

main().catch((err) => {
  console.error(`[ERROR] db-restore failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
