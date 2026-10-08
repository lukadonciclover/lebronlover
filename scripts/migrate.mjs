// Standalone migration runner. Applies the SQL files in ./drizzle to the
// configured libSQL database. The application also creates its schema lazily
// on first run, so this script is optional but useful for explicit deploys.
//
// Usage: node scripts/migrate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL || "file:./data/investment-pitch-copilot.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

const client = createClient({ url, authToken });
const migrationsDir = join(process.cwd(), "drizzle");

const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No SQL migrations found in ./drizzle");
  process.exit(0);
}

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await client.execute(statement);
  }
  console.log(`Applied ${file}`);
}

console.log("Migrations complete.");
client.close();