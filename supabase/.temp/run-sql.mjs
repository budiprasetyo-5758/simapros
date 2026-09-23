// Jalankan file SQL atau query ke DB beta via session pooler.
// Usage:
//   BETA_DB_PW=... node run-sql.mjs <file.sql>
//   BETA_DB_PW=... node run-sql.mjs -q "<sql>"
import { readFileSync } from 'node:fs';
import pg from 'pg';

const args = process.argv.slice(2);
let sql;
let label;
if (args[0] === '-q') {
  sql = args.slice(1).join(' ');
  label = 'query';
} else {
  const file = args[0];
  if (!file) {
    console.error('usage: node run-sql.mjs <file.sql> | -q "<sql>"');
    process.exit(1);
  }
  sql = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  label = file;
}
if (!process.env.BETA_DB_PW) {
  console.error('BETA_DB_PW env var is required');
  process.exit(1);
}

const client = new pg.Client({
  host: 'aws-0-ap-southeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.blitdxwxaztjaujxfrfe',
  password: process.env.BETA_DB_PW,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const t0 = Date.now();
try {
  const res = await client.query(sql);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.rows && res.rows.length > 0) {
    console.log(JSON.stringify(res.rows, null, 2));
  } else {
    console.log(`OK: ${label} (${secs}s)`);
  }
} catch (err) {
  console.error(`FAILED: ${label}`);
  console.error(err.message);
  for (const k of ['code', 'detail', 'hint', 'where', 'schema', 'table', 'column', 'constraint']) {
    if (err[k]) console.error(`${k}: ${err[k]}`);
  }
  if (err.position && Number.isFinite(Number(err.position))) {
    const pos = Number(err.position);
    console.error('--- context around error position ---');
    console.error(sql.slice(Math.max(0, pos - 400), pos + 300));
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
