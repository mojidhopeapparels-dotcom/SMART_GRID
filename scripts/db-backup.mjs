#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

function parseArgs(argv) {
  const args = {
    dbPath: process.env.SMART_GRID_DB_PATH?.trim() || path.resolve(process.cwd(), "data", "smart_grid.db"),
    outDir: path.resolve(process.cwd(), "backups"),
    outFile: "",
    json: false,
    readOnlySource: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--db" && argv[i + 1]) args.dbPath = path.resolve(argv[++i]);
    else if (a === "--out-dir" && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else if (a === "--out" && argv[i + 1]) args.outFile = path.resolve(argv[++i]);
    else if (a === "--json") args.json = true;
    else if (a === "--read-only-source") args.readOnlySource = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/db-backup.mjs [--db <path>] [--out-dir <dir>] [--out <file>] [--read-only-source] [--json]"
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

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.dbPath)) {
    throw new Error(`Source SQLite database does not exist: ${args.dbPath}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile =
    args.outFile || path.join(args.outDir, `smart_grid_backup_${stamp}.db`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tempOut = `${outFile}.tmp.${process.pid}`;

  const sourceDb = new DatabaseSync(args.dbPath, {
    readOnly: args.readOnlySource,
  });
  let totalPages = 0;
  try {
    sourceDb.exec("PRAGMA busy_timeout = 5000;");
    totalPages = await backup(sourceDb, tempOut);
  } finally {
    sourceDb.close();
  }

  // Validate backup snapshot integrity & foreign keys read-only before committing filename
  const verifyDb = new DatabaseSync(tempOut, { readOnly: true });
  let integrityResult = "unknown";
  let fkViolations = [];
  let userTables = 0;
  let migrations = [];
  try {
    const ic = verifyDb.prepare("PRAGMA integrity_check").get();
    integrityResult = ic?.integrity_check ?? "unknown";
    fkViolations = verifyDb.prepare("PRAGMA foreign_key_check").all();
    const tbl = verifyDb
      .prepare(
        "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .get();
    userTables = tbl?.cnt ?? 0;
    const hasMig = verifyDb
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    if (hasMig) {
      migrations = verifyDb
        .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
        .all()
        .map((r) => r.version);
    }
  } finally {
    verifyDb.close();
  }

  if (integrityResult !== "ok" || fkViolations.length > 0) {
    fs.rmSync(tempOut, { force: true });
    throw new Error(
      `Backup verification failed (integrity=${integrityResult}, fkViolations=${fkViolations.length}).`
    );
  }

  if (fs.existsSync(outFile)) fs.rmSync(outFile, { force: true });
  fs.renameSync(tempOut, outFile);

  const { sha256, bytes } = sha256File(outFile);
  const shaPath = `${outFile}.sha256`;
  fs.writeFileSync(shaPath, `${sha256}  ${path.basename(outFile)}\n`, "utf8");

  const report = {
    status: "VERIFIED_BACKUP_CREATED",
    sourceDb: args.dbPath,
    backupFile: outFile,
    checksumFile: shaPath,
    sha256,
    sizeBytes: bytes,
    pagesCopied: totalPages,
    integrityCheck: integrityResult,
    foreignKeyViolations: fkViolations.length,
    tableCount: userTables,
    migrations,
    createdAt: new Date().toISOString(),
  };

  const metaPath = `${outFile}.meta.json`;
  fs.writeFileSync(metaPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[OK] Backup created & verified: ${outFile} (${bytes} bytes, sha256=${sha256}, tables=${userTables}, integrity=${integrityResult})`
    );
  }
}

main().catch((err) => {
  console.error(`[ERROR] db-backup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
