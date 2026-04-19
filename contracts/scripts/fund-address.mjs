import { Contract, formatEther, formatUnits, JsonRpcProvider, parseEther, parseUnits, Wallet } from 'ethers';
import { readFileSync } from 'node:fs';

// --- load .env ---
try {
  const envText = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {}

const TO = process.argv[2];
const BNB_AMOUNT = process.argv[3] ?? '0.05';
const SUPER_AMOUNT = process.argv[4] ?? '1000';

if (!TO) {
  console.error('Usage: node scripts/fund-address.mjs <to> [bnbAmount=0.05] [superAmount=1000]');
  process.exit(1);
}

const pk = process.env.DEPLOYER_PRIVATE_KEY;
const rpc = process.env.BSC_TESTNET_RPC_URL || process.env.VITE_RPC_URL;
const superAddr = process.env.VITE_SUPER_ADDRESS;
if (!pk || !rpc || !superAddr) {
  console.error('Missing DEPLOYER_PRIVATE_KEY / RPC / VITE_SUPER_ADDRESS in .env');
  process.exit(1);
}

const provider = new JsonRpcProvider(rpc);
const wallet = new Wallet(pk.startsWith('0x') ? pk : `0x${pk}`, provider);

console.log(`From:          ${wallet.address}`);
console.log(`To:            ${TO}`);
console.log(`BNB to send:   ${BNB_AMOUNT}`);
console.log(`SUPER to send: ${SUPER_AMOUNT}`);
console.log(`RPC:           ${rpc}`);
console.log(`SUPER:         ${superAddr}\n`);

const bnbBefore = await provider.getBalance(wallet.address);
console.log(`Sender BNB balance: ${formatEther(bnbBefore)} BNB`);

// --- 1. send BNB ---
console.log('\n[1/2] Sending BNB...');
const tx1 = await wallet.sendTransaction({ to: TO, value: parseEther(BNB_AMOUNT) });
console.log(`  tx: ${tx1.hash}`);
const r1 = await tx1.wait();
console.log(`  confirmed in block ${r1.blockNumber}, status=${r1.status}`);

// --- 2. send / mint SUPER ---
const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function owner() view returns (address)',
  'function minters(address) view returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'function mint(address,uint256)'
];
const superToken = new Contract(superAddr, erc20Abi, wallet);
const decimals = Number(await superToken.decimals());
const symbol = await superToken.symbol();
const amountWei = parseUnits(SUPER_AMOUNT, decimals);

const senderSuperBal = await superToken.balanceOf(wallet.address);
console.log(`\n[2/2] Sending ${SUPER_AMOUNT} ${symbol}`);
console.log(`  Sender ${symbol} balance: ${formatUnits(senderSuperBal, decimals)}`);

let tx2;
if (senderSuperBal >= amountWei) {
  console.log('  -> transfer from deployer');
  tx2 = await superToken.transfer(TO, amountWei);
} else {
  // try mint (deployer must be owner or minter)
  let canMint = false;
  try {
    const owner = await superToken.owner();
    canMint = owner.toLowerCase() === wallet.address.toLowerCase();
  } catch {}
  if (!canMint) {
    try { canMint = await superToken.minters(wallet.address); } catch {}
  }
  if (!canMint) {
    console.error('  balance not enough and deployer is neither owner nor minter. abort.');
    process.exit(1);
  }
  console.log('  -> mint to recipient (deployer is owner/minter)');
  tx2 = await superToken.mint(TO, amountWei);
}
console.log(`  tx: ${tx2.hash}`);
const r2 = await tx2.wait();
console.log(`  confirmed in block ${r2.blockNumber}, status=${r2.status}`);

// --- summary ---
const bnbAfter = await provider.getBalance(TO);
const superAfter = await superToken.balanceOf(TO);
console.log('\n=== Recipient balances ===');
console.log(`  BNB:   ${formatEther(bnbAfter)}`);
console.log(`  ${symbol}: ${formatUnits(superAfter, decimals)}`);
console.log('\nExplorer:');
console.log(`  https://testnet.bscscan.com/tx/${tx1.hash}`);
console.log(`  https://testnet.bscscan.com/tx/${tx2.hash}`);
console.log(`  https://testnet.bscscan.com/address/${TO}`);

