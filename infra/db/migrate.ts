import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const migrationsDir = join(process.cwd(), "infra/db/migrations");
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("DATABASE_URL is not set; skipping DB migrations.");
  process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await client.query(sql);
    console.log(`Applied migration ${file}`);
  }
} finally {
  await client.end();
}
