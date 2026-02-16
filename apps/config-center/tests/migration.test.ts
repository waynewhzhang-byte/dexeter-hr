import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("config-center init migration defines core tables", () => {
  const migrationPath = resolve(
    process.cwd(),
    "infra/db/migrations/0001_config_center_init.sql",
  );
  const sql = readFileSync(migrationPath, "utf8").toLowerCase();

  expect(sql).toContain("create table if not exists domain_pack");
  expect(sql).toContain("create table if not exists domain_pack_version");
  expect(sql).toContain("create table if not exists release_binding");
  expect(sql).toContain("create table if not exists approval_record");
  expect(sql).toContain("create table if not exists config_audit_log");
});
