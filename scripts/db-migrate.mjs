// Applies every SQL file in supabase/migrations (sorted) to the Supabase
// Postgres database, idempotently. Each file runs in its own transaction.
//
// Connection: parses .env.local for the project URL + DB password and builds a
// direct connection string. If you pass --db-url "postgresql://..." it uses that
// instead (e.g. the session pooler string from the Supabase dashboard).
//
// Usage:
//   node scripts/db-migrate.mjs
//   node scripts/db-migrate.mjs --db-url "postgresql://postgres.ref:pw@aws-0-...pooler.supabase.com:5432/postgres"

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function buildConnString() {
  const argIdx = process.argv.indexOf("--db-url");
  if (argIdx !== -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1];

  const env = parseEnv(resolve(root, ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  // Key name is misspelled in .env.local ("PASSORD"); match loosely.
  const pwKey = Object.keys(env).find((k) => /SUPABASE_DB_PASS/i.test(k));
  const pw = pwKey ? env[pwKey] : undefined;
  if (!url || !pw) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or DB password in .env.local");

  const ref = new URL(url).hostname.split(".")[0];
  return `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`;
}

async function main() {
  const connectionString = buildConnString();
  const safe = connectionString.replace(/:[^:@/]+@/, ":****@");
  console.log(`[migrate] connecting -> ${safe}`);

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  const dir = resolve(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  console.log(`[migrate] ${files.length} migration file(s)`);

  for (const f of files) {
    const sql = readFileSync(resolve(dir, f), "utf8");
    process.stdout.write(`[migrate] applying ${f} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      console.log("FAILED");
      console.error(e.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("[migrate] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
