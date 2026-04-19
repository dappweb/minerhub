import { JsonRpcProvider, Wallet, formatEther, parseEther } from 'ethers';
import { readFileSync } from 'node:fs';

// minimal .env loader (no dotenv dep)
try {
  const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
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
} catch {
  // ignore
}

const TO = process.argv[2];
const AMOUNT = process.argv[3];
if (!TO || !AMOUNT) {
  console.error('Usage: node scripts/send-bnb.mjs <to> <amountBNB>');
  process.exit(1);
}

const pk = process.env.DEPLOYER_PRIVATE_KEY;
const rpc = process.env.BSC_TESTNET_RPC_URL || process.env.VITE_RPC_URL;
if (!pk) {
  console.error('Missing DEPLOYER_PRIVATE_KEY in .env');
  process.exit(1);
}

const provider = new JsonRpcProvider(rpc);
const wallet = new Wallet(pk.startsWith('0x') ? pk : `0x${pk}`, provider);

console.log(`From:   ${wallet.address}`);
console.log(`To:     ${TO}`);
console.log(`Amount: ${AMOUNT} BNB`);
console.log(`RPC:    ${rpc}`);

const balanceBefore = await provider.getBalance(wallet.address);
console.log(`Sender balance: ${formatEther(balanceBefore)} BNB`);

const tx = await wallet.sendTransaction({
  to: TO,
  value: parseEther(AMOUNT),
});
console.log(`Tx hash: ${tx.hash}`);
console.log('Waiting for confirmation...');
const receipt = await tx.wait();
console.log(`Confirmed in block ${receipt.blockNumber}, status=${receipt.status}`);

const balanceAfter = await provider.getBalance(TO);
console.log(`Recipient balance: ${formatEther(balanceAfter)} BNB`);
console.log(`Explorer: https://testnet.bscscan.com/tx/${tx.hash}`);
