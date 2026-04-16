/**
 * sync-env.mjs
 * 
 * 从 contracts/deployment.json 读取已部署的合约地址，
 * 自动写入以下文件：
 *   - .env.local            (前端 Vite)
 *   - app-client/.env.local (Expo App)
 *   - backend/.env          (后端 Cloudflare Workers)
 * 
 * 用法：node scripts/sync-env.mjs
 *       node scripts/sync-env.mjs --dry-run  (仅预览，不写入)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEPLOYMENT_PATH = path.join(ROOT, 'contracts', 'deployment.json');

const RPC_URL = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const CHAIN_ID = '97';

const isDryRun = process.argv.includes('--dry-run');

// ── 读取 deployment.json ──────────────────────────────────────────────────────
if (!fs.existsSync(DEPLOYMENT_PATH)) {
  console.error('❌ contracts/deployment.json not found. Run deployment first.');
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'));
const { contracts } = deployment;

const missing = Object.entries(contracts).filter(([, v]) => !v);
if (missing.length > 0) {
  console.error('❌ Missing contract addresses:', missing.map(([k]) => k).join(', '));
  console.error('   Run: cd contracts && npx hardhat run scripts/deploy.ts --network bscTestnet');
  process.exit(1);
}

console.log('\n📋 Deployment info:');
console.log(`   Network:    ${deployment.network}`);
console.log(`   Deployer:   ${deployment.deployer}`);
console.log(`   Timestamp:  ${deployment.timestamp}`);
console.log(`   SUPER:      ${contracts.SUPER}`);
console.log(`   USDT_Mock:  ${contracts.USDT_Mock}`);
console.log(`   MiningPool: ${contracts.MiningPool}`);
console.log(`   SwapRouter: ${contracts.SwapRouter}`);

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 读取现有 .env 文件（如不存在则返回空字符串）
 * 解析为 key→value 映射，保留注释行和空行的顺序。
 */
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * 将一组 key=value 对合并/覆盖到现有 .env 文本中。
 * - 已存在的 key：替换其值
 * - 不存在的 key：追加到末尾
 */
function mergeEnvVars(existing, updates) {
  let content = existing;

  for (const [key, value] of Object.entries(updates)) {
    const escaped = value.replace(/"/g, '\\"');
    const line = `${key}="${escaped}"`;
    // 匹配 KEY= 或 KEY ="..."（含或不含引号）
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content = content.trimEnd() + '\n' + line + '\n';
    }
  }
  return content;
}

function writeEnvFile(filePath, content) {
  if (isDryRun) {
    console.log(`\n[dry-run] Would write to: ${filePath}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Written: ${filePath}`);
}

// ── 1. 前端 .env.local ────────────────────────────────────────────────────────
const frontendEnvPath = path.join(ROOT, '.env.local');
const frontendUpdates = {
  VITE_CHAIN_ID: CHAIN_ID,
  VITE_RPC_URL: RPC_URL,
  VITE_SUPER_ADDRESS: contracts.SUPER,
  VITE_MINING_POOL_ADDRESS: contracts.MiningPool,
  VITE_MINER_CONTRACT_ADDRESS: contracts.MiningPool,
  VITE_SWAP_ROUTER_ADDRESS: contracts.SwapRouter,
  VITE_SWAP_CONTRACT_ADDRESS: contracts.SwapRouter,
  VITE_USDT_ADDRESS: contracts.USDT || contracts.USDT_Mock,  // Support both real USDT and mock
};
const frontendContent = mergeEnvVars(readEnvFile(frontendEnvPath), frontendUpdates);
writeEnvFile(frontendEnvPath, frontendContent);

// ── 2. App .env.local ─────────────────────────────────────────────────────────
const appEnvPath = path.join(ROOT, 'app-client', '.env.local');
const appUpdates = {
  EXPO_PUBLIC_CHAIN_ID: CHAIN_ID,
  EXPO_PUBLIC_RPC_URL: RPC_URL,
  EXPO_PUBLIC_MINING_POOL_ADDRESS: contracts.MiningPool,
  EXPO_PUBLIC_SWAP_ROUTER_ADDRESS: contracts.SwapRouter,
  EXPO_PUBLIC_SUPER_ADDRESS: contracts.SUPER,
  EXPO_PUBLIC_USDT_ADDRESS: contracts.USDT || contracts.USDT_Mock,  // Support both real USDT and mock
};
const appContent = mergeEnvVars(readEnvFile(appEnvPath), appUpdates);
writeEnvFile(appEnvPath, appContent);

// ── 3. 后端 .dev.vars ─────────────────────────────────────────────────────────
// Cloudflare Workers dev 本地变量文件
const backendEnvPath = path.join(ROOT, 'backend', '.dev.vars');
const backendUpdates = {
  CHAIN_ID: CHAIN_ID,
  RPC_URL: RPC_URL,
  SUPER_TOKEN_ADDRESS: contracts.SUPER,
  MINING_POOL_ADDRESS: contracts.MiningPool,
  SWAP_ROUTER_ADDRESS: contracts.SwapRouter,
  USDT_ADDRESS: contracts.USDT || contracts.USDT_Mock,  // Support both real USDT and mock
};
const backendContent = mergeEnvVars(readEnvFile(backendEnvPath), backendUpdates);
writeEnvFile(backendEnvPath, backendContent);

console.log(`\n🎉 Env sync ${isDryRun ? 'preview' : 'complete'}!`);
if (!isDryRun) {
  console.log('\n📌 Next steps:');
  console.log('   1. Restart the Vite dev server for frontend changes to take effect');
  console.log('   2. Rebuild the Expo app: cd app-client && npm run android');
  console.log('   3. Update Cloudflare secrets: cd backend && npx wrangler secret put MINING_POOL_ADDRESS');
}
