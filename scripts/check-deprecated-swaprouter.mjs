import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const targets = [
  '.env.example',
  'app-client/README.md',
  'README.md',
  'ANDROID_RUN_GUIDE.md',
  'APP_DEPLOYMENT_COMPLETE.md',
  'CLOUDFLARE_DEPLOYMENT.md',
  'SYSTEM_DEPLOYMENT_GUIDE.md',
  'USDT_DEPLOYMENT_GUIDE.md',
  'contracts/README.md',
  'backend/db',
  'docs',
  'app-client/app.json',
  'app-client/src',
  'backend/wrangler.toml',
  'src',
  'backend/src',
  'contracts/.env.example',
  'contracts/contracts',
  'contracts/scripts',
  'contracts/test',
  'contracts/deployment.json',
  'contracts/typechain-types',
  'contracts/artifacts/contracts',
];

const blocked = /\b(SwapRouter|SwapPool|swapRouter|swapContractAddress|SWAP_ROUTER|VITE_SWAP|EXPO_PUBLIC_SWAP|swapSuperToUsdt|swapUsdtToSuper|initializeLiquidity|addLiquidity|removeLiquidity|FEE_BIPS)\b/;
const allowedMissing = new Set();

function collectFiles(path) {
  const fullPath = join(root, path);
  let stat;
  try {
    stat = statSync(fullPath);
  } catch {
    if (!allowedMissing.has(path)) throw new Error(`Missing scan target: ${path}`);
    return [];
  }

  if (stat.isFile()) return [fullPath];
  return readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return collectFiles(child);
    return [join(root, child)];
  });
}

const offenders = [];
for (const file of targets.flatMap(collectFiles)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (blocked.test(line)) {
      offenders.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (offenders.length) {
  console.error('Deprecated SwapRouter references remain:');
  for (const offender of offenders.slice(0, 80)) {
    console.error(`- ${offender}`);
  }
  if (offenders.length > 80) {
    console.error(`...and ${offenders.length - 80} more`);
  }
  process.exit(1);
}

console.log('No deprecated SwapRouter references found.');
