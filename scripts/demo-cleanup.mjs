#!/usr/bin/env node
/**
 * Safe Demo & Evaluation Seed Cleanup Utility for SMART GRID.
 * Default mode is strict READ-ONLY --dry-run.
 * Mutating execution requires BOTH `--confirm-execute` AND `--backup <verifiedBackupFile>`.
 * Core system taxonomy tables (divisions, countries, permissions, roles, role_permissions,
 * global KPIs where organization_id IS NULL, schema_migrations) are always preserved.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEMO_ORG_IDS = ["org_demo_global", "org_partner_metro"];
const DEMO_USER_IDS = [
  "usr_demo_admin",
  "usr_demo_analyst",
  "usr_demo_viewer",
  "usr_partner_admin",
];
const DEMO_EMAILS = [
  "admin@smartgrid.local",
  "analyst@smartgrid.local",
  "viewer@smartgrid.local",
  "partner@smartgrid.local",
];

function parseArgs(argv) {
  const args = {
    dbPath: process.env.SMART_GRID_DB_PATH?.trim() || path.resolve(process.cwd(), "data", "smart_grid.db"),
    backupFile: "",
    confirmExecute: false,
    forceOrgs: false,
    json: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--db" && argv[i + 1]) args.dbPath = path.resolve(argv[++i]);
    else if (a === "--backup" && argv[i + 1]) args.backupFile = path.resolve(argv[++i]);
    else if (a === "--confirm-execute") args.confirmExecute = true;
    else if (a === "--force-orgs") args.forceOrgs = true;
    else if (a === "--dry-run") args.confirmExecute = false;
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/demo-cleanup.mjs [--db <path>] [--dry-run | --confirm-execute --backup <file>] [--force-orgs] [--json]"
      );
      process.exit(0);
    }
  }
  return args;
}

function placeholders(arr) {
  return arr.map(() => "?").join(", ");
}

function tableExists(db, name) {
  const r = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return Boolean(r);
}

function discoverTargets(db) {
  const demoOrgs = db
    .prepare(
      `SELECT id, slug, name FROM organizations WHERE id IN (${placeholders(DEMO_ORG_IDS)})`
    )
    .all(...DEMO_ORG_IDS)
    .map((r) => ({ ...r }));

  const demoUsers = db
    .prepare(
      `SELECT id, email, full_name FROM users WHERE id IN (${placeholders(DEMO_USER_IDS)}) OR LOWER(email) IN (${placeholders(DEMO_EMAILS)})`
    )
    .all(...DEMO_USER_IDS, ...DEMO_EMAILS)
    .map((r) => ({ ...r }));

  const demoUserIds = Array.from(new Set(demoUsers.map((u) => u.id)));
  const demoOrgIds = demoOrgs.map((o) => o.id);

  // Check if any non-demo user belongs to a demo org so we never accidentally destroy live tenant members
  let nonDemoMembersInDemoOrgs = [];
  if (demoOrgIds.length > 0) {
    const excludeClause =
      demoUserIds.length > 0
        ? `AND u.id NOT IN (${placeholders(demoUserIds)})`
        : "";
    nonDemoMembersInDemoOrgs = db
      .prepare(
        `SELECT m.organization_id, u.id AS user_id, u.email
         FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id IN (${placeholders(demoOrgIds)}) ${excludeClause}`
      )
      .all(...demoOrgIds, ...demoUserIds)
      .map((r) => ({ ...r }));
  }

  return { demoOrgs, demoUsers, demoOrgIds, demoUserIds, nonDemoMembersInDemoOrgs };
}

function buildPlan(orgIds, userIds, deleteOrgs) {
  const steps = [];
  const pUser = userIds.length > 0 ? placeholders(userIds) : null;
  const pOrg = orgIds.length > 0 ? placeholders(orgIds) : null;

  const addStep = (table, clauses, params) => {
    const validClauses = clauses.filter(Boolean);
    if (validClauses.length === 0 || params.length === 0) return;
    steps.push({ table, whereSql: validClauses.join(" OR "), params });
  };

  if (deleteOrgs && pOrg) {
    addStep(
      "sessions",
      [pUser ? `user_id IN (${pUser})` : "", `active_organization_id IN (${pOrg})`],
      [...(pUser ? userIds : []), ...orgIds]
    );
    addStep(
      "ai_quota_reservations",
      [pUser ? `user_id IN (${pUser})` : "", `organization_id IN (${pOrg})`],
      [...(pUser ? userIds : []), ...orgIds]
    );
    addStep("ai_messages", [`session_id IN (SELECT id FROM ai_sessions WHERE organization_id IN (${pOrg}))`], [...orgIds]);
    addStep("ai_sessions", [`organization_id IN (${pOrg})`, pUser ? `user_id IN (${pUser})` : ""], [...orgIds, ...(pUser ? userIds : [])]);
    addStep("workbook_versions", [`workbook_id IN (SELECT id FROM workbooks WHERE organization_id IN (${pOrg}))`], [...orgIds]);
    addStep("workbook_sheets", [`workbook_id IN (SELECT id FROM workbooks WHERE organization_id IN (${pOrg}))`], [...orgIds]);
    addStep("workbooks", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("workflow_runs", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("workflows", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep(
      "notifications",
      [pUser ? `user_id IN (${pUser})` : "", `organization_id IN (${pOrg})`],
      [...(pUser ? userIds : []), ...orgIds]
    );
    addStep("alerts", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("city_events", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("incidents", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("work_orders", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("projects", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("sensors", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("assets", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("observations", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("integration_runs", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("datasets", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("data_sources", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("contracts", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("vendors", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("calendar_events", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("team_messages", [`organization_id IN (${pOrg})`, pUser ? `author_id IN (${pUser})` : ""], [...orgIds, ...(pUser ? userIds : [])]);
    addStep("documents", [`organization_id IN (${pOrg})`, pUser ? `uploaded_by IN (${pUser})` : ""], [...orgIds, ...(pUser ? userIds : [])]);
    addStep(
      "reports",
      [`organization_id IN (${pOrg})`, pUser ? `created_by IN (${pUser})` : "", pUser ? `approved_by IN (${pUser})` : ""],
      [...orgIds, ...(pUser ? userIds : []), ...(pUser ? userIds : [])]
    );
    addStep("gis_layers", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("scenarios", [`organization_id IN (${pOrg})`, pUser ? `created_by IN (${pUser})` : ""], [...orgIds, ...(pUser ? userIds : [])]);
    addStep("dashboards", [`organization_id IN (${pOrg})`, pUser ? `created_by IN (${pUser})` : ""], [...orgIds, ...(pUser ? userIds : [])]);
    addStep("kpi_definitions", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("api_keys", [`organization_id IN (${pOrg})`, pUser ? `created_by IN (${pUser})` : ""], [...orgIds, ...(pUser ? userIds : [])]);
    addStep("webhooks", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("usage_records", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("subscriptions", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("background_jobs", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep(
      "audit_logs",
      [`organization_id IN (${pOrg})`, pUser ? `user_id IN (${pUser})` : ""],
      [...orgIds, ...(pUser ? userIds : [])]
    );
    addStep("administrative_areas", [`city_id IN (SELECT id FROM cities WHERE organization_id IN (${pOrg}))`], [...orgIds]);
    addStep(
      "organization_memberships",
      [pUser ? `user_id IN (${pUser})` : "", `organization_id IN (${pOrg})`],
      [...(pUser ? userIds : []), ...orgIds]
    );
    addStep("cities", [`organization_id IN (${pOrg})`], [...orgIds]);
    addStep("workspaces", [`organization_id IN (${pOrg})`], [...orgIds]);
  } else if (pUser) {
    addStep("sessions", [`user_id IN (${pUser})`], [...userIds]);
    addStep("ai_quota_reservations", [`user_id IN (${pUser})`], [...userIds]);
    addStep("notifications", [`user_id IN (${pUser})`], [...userIds]);
    addStep("organization_memberships", [`user_id IN (${pUser})`], [...userIds]);
    addStep("audit_logs", [`user_id IN (${pUser})`], [...userIds]);
  }

  if (pUser) {
    addStep("password_reset_tokens", [`user_id IN (${pUser})`], [...userIds]);
    addStep("mfa_recovery_codes", [`user_id IN (${pUser})`], [...userIds]);
    addStep("mfa_pending_enrollments", [`user_id IN (${pUser})`], [...userIds]);
    addStep("users", [`id IN (${pUser})`], [...userIds]);
  }
  if (deleteOrgs && pOrg) {
    addStep("organizations", [`id IN (${pOrg})`], [...orgIds]);
  }

  return steps;
}

function summarizePreserved(db) {
  const taxonomy = {};
  for (const tbl of ["divisions", "countries", "permissions", "roles", "role_permissions", "schema_migrations"]) {
    if (tableExists(db, tbl)) {
      taxonomy[tbl] = db.prepare(`SELECT COUNT(*) AS cnt FROM ${tbl}`).get().cnt;
    }
  }
  if (tableExists(db, "kpi_definitions")) {
    taxonomy.global_kpi_definitions = db
      .prepare("SELECT COUNT(*) AS cnt FROM kpi_definitions WHERE organization_id IS NULL")
      .get().cnt;
  }
  return taxonomy;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.dbPath)) {
    throw new Error(`Target database not found: ${args.dbPath}`);
  }

  // Verify backup prerequisite BEFORE opening RW database in execute mode
  if (args.confirmExecute) {
    if (!args.backupFile) {
      throw new Error(
        "Refusing --confirm-execute without --backup <verifiedBackupFile>. Run scripts/db-backup.mjs first."
      );
    }
    if (!fs.existsSync(args.backupFile)) {
      throw new Error(`Backup file does not exist: ${args.backupFile}`);
    }
    const bdb = new DatabaseSync(args.backupFile, { readOnly: true });
    try {
      const bic = bdb.prepare("PRAGMA integrity_check").get();
      if (bic?.integrity_check !== "ok") {
        throw new Error(`Provided backup failed integrity_check: ${bic?.integrity_check}`);
      }
    } finally {
      bdb.close();
    }
  }

  const db = new DatabaseSync(args.dbPath, { readOnly: !args.confirmExecute });
  try {
    if (args.confirmExecute) {
      db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    }

    const targets = discoverTargets(db);
    if (targets.nonDemoMembersInDemoOrgs.length > 0 && !args.forceOrgs) {
      if (args.confirmExecute) {
        throw new Error(
          `Aborted: ${targets.nonDemoMembersInDemoOrgs.length} non-demo member(s) exist inside demo organizations. Pass --force-orgs only after migrating them.`
        );
      }
    }

    const deleteOrgs = targets.nonDemoMembersInDemoOrgs.length === 0 || args.forceOrgs;
    const plan = buildPlan(targets.demoOrgIds, targets.demoUserIds, deleteOrgs);

    const plannedDeletes = [];
    for (const step of plan) {
      if (!tableExists(db, step.table)) continue;
      const cnt = db
        .prepare(`SELECT COUNT(*) AS cnt FROM ${step.table} WHERE ${step.whereSql}`)
        .get(...step.params).cnt;
      if (cnt > 0) {
        plannedDeletes.push({ table: step.table, whereSql: step.whereSql, params: step.params, count: cnt });
      }
    }

    if (!args.confirmExecute) {
      const report = {
        mode: "DRY_RUN_READ_ONLY",
        database: args.dbPath,
        demoUsersFound: targets.demoUsers.map((u) => ({ id: u.id, email: u.email })),
        demoOrgsFound: targets.demoOrgs.map((o) => ({ id: o.id, slug: o.slug })),
        nonDemoMembersBlockingOrgDelete: targets.nonDemoMembersInDemoOrgs.length,
        willDeleteDemoOrgs: deleteOrgs,
        plannedDeletes: plannedDeletes.map((d) => ({ table: d.table, rows: d.count })),
        totalRowsPlannedForRemoval: plannedDeletes.reduce((acc, d) => acc + d.count, 0),
        preservedReferenceCounts: summarizePreserved(db),
      };
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    // Mutating transactional cleanup
    const executedDeletes = [];
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const step of plan) {
        if (!tableExists(db, step.table)) continue;
        const info = db
          .prepare(`DELETE FROM ${step.table} WHERE ${step.whereSql}`)
          .run(...step.params);
        if (info.changes > 0) {
          executedDeletes.push({ table: step.table, rowsRemoved: Number(info.changes) });
        }
      }
      if (tableExists(db, "seed_metadata")) {
        db.prepare("DELETE FROM seed_metadata WHERE seed_key = 'demo_seed'").run();
        db.prepare(
          `INSERT OR REPLACE INTO seed_metadata (seed_key, seed_version, mode, applied_at)
           VALUES ('demo_cleanup', 1, 'production_cleaned', ?)`
        ).run(new Date().toISOString());
      }
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore rollback error
      }
      throw err;
    }

    const ic = db.prepare("PRAGMA integrity_check").get();
    const fk = db.prepare("PRAGMA foreign_key_check").all();

    const report = {
      mode: "EXECUTED_CLEANUP",
      database: args.dbPath,
      verifiedBackupUsed: args.backupFile,
      executedDeletes,
      totalRowsRemoved: executedDeletes.reduce((acc, d) => acc + d.rowsRemoved, 0),
      integrityCheck: ic?.integrity_check ?? "unknown",
      foreignKeyViolations: fk.length,
      preservedReferenceCounts: summarizePreserved(db),
      completedAt: new Date().toISOString(),
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(`[ERROR] demo-cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
