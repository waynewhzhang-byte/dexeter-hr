import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("production migration includes submission persistence table", () => {
  const migrationPath = resolve(
    process.cwd(),
    "infra/db/migrations/0002_config_center_submission.sql",
  );
  const sql = readFileSync(migrationPath, "utf8").toLowerCase();

  expect(sql).toContain("create table if not exists pack_version_submission");
  expect(sql).toContain("unique (pack_version_id)");
});
