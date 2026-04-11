import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backendDir = resolve(process.cwd());
const wranglerPath = resolve(backendDir, 'wrangler.toml');
const dryRun = process.argv.includes('--dry-run');

function run(command) {
  console.log(`\n> ${command}`);
  if (dryRun) {
    return '{"result":{"uuid":"dry-run-d1-id","id":"dry-run-kv-id"}}';
  }
  return execSync(command, {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

function parseJsonOutput(raw) {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith('{') || line.startsWith('[')) {
      try {
        return JSON.parse(line);
      } catch {
        // keep searching
      }
    }
  }
  throw new Error(`Cannot parse JSON from output: ${raw}`);
}

function updateWranglerToml({ d1Id, kvId }) {
  let content = readFileSync(wranglerPath, 'utf8');

  content = content.replace(
    /database_id\s*=\s*"[^"]*"/,
    `database_id = "${d1Id}"`
  );

  content = content.replace(
    /\[\[kv_namespaces\]\][\s\S]*?id\s*=\s*"[^"]*"/,
    (block) => block.replace(/id\s*=\s*"[^"]*"/, `id = "${kvId}"`)
  );

  writeFileSync(wranglerPath, content, 'utf8');
}

function main() {
  const dbNameArg = process.argv.find((value) => !value.startsWith('--') && value !== process.argv[0] && value !== process.argv[1]);
  const dbName = dbNameArg || 'coin-planet-db';

  console.log('Starting Cloudflare bootstrap...');
  console.log(`Backend dir: ${backendDir}`);
  console.log(`D1 database name: ${dbName}`);
  if (dryRun) {
    console.log('Running in dry-run mode (no remote changes).');
  }

  const d1Raw = run(`npx wrangler d1 create ${dbName} --json`);
  const d1Json = parseJsonOutput(d1Raw);
  const d1Id = d1Json?.result?.uuid;
  if (!d1Id) {
    throw new Error(`Failed to get D1 database id. Output: ${d1Raw}`);
  }

  const kvRaw = run('npx wrangler kv namespace create CACHE --json');
  const kvJson = parseJsonOutput(kvRaw);
  const kvId = kvJson?.result?.id;
  if (!kvId) {
    throw new Error(`Failed to get KV namespace id. Output: ${kvRaw}`);
  }

  if (!dryRun) {
    updateWranglerToml({ d1Id, kvId });
  }

  run(`npx wrangler d1 execute ${dbName} --file=./db/schema.sql`);

  console.log('\nBootstrap finished successfully.');
  console.log(`- D1 ID: ${d1Id}`);
  console.log(`- KV ID: ${kvId}`);
  console.log(dryRun ? '- wrangler.toml not modified (dry-run)' : '- wrangler.toml updated');
  console.log('- schema.sql applied');
}

main();
