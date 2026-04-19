import { Wallet } from '../backend/node_modules/ethers/lib.esm/index.js';

const API = 'https://coin-planet-api.dappweb.workers.dev';
const PK = '4f3b2b7388daa9fbafede197e8c629cb7882a3af942a87aa0988dde7d73d03d2';

(async () => {
  const wallet = new Wallet(PK);
  console.log('Owner wallet:', wallet.address);

  // --- login ---
  const nonce = 'login-' + Date.now();
  const ts = Date.now();
  const loginMsg = `coinplanet-owner|login|${nonce}|${ts}`;
  const sig = await wallet.signMessage(loginMsg);
  const loginRes = await fetch(`${API}/api/owner/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: wallet.address, signature: sig, nonce, ts }),
  });
  const loginData = await loginRes.json();
  console.log('login:', loginRes.status, loginData);
  if (!loginData.token) process.exit(1);

  const token = loginData.token;

  // --- overview (Bearer only) ---
  const ov = await fetch(`${API}/api/owner/overview`, {
    headers: { authorization: `Bearer ${token}` },
  });
  console.log('overview:', ov.status, JSON.stringify(await ov.json(), null, 2));

  // --- super/supply (Bearer) ---
  const sup = await fetch(`${API}/api/owner/super/supply`, { headers: { authorization: `Bearer ${token}` } });
  console.log('supply:', sup.status, await sup.text());

  // --- super/balance (Bearer) ---
  const bal = await fetch(`${API}/api/owner/super/balance?wallet=${wallet.address}`, { headers: { authorization: `Bearer ${token}` } });
  console.log('balance:', bal.status, await bal.text());

  // --- sensitive op: super/mint (Bearer + signature) --- DRY: just 1 SUPER to self
  const sensitiveTest = async () => {
    const nonce2 = 'op-' + Date.now();
    const path = '/api/owner/super/mint';
    const payload = { to: wallet.address, amount: '0.01' };
    const message = `coinplanet|${nonce2}|${path}|${JSON.stringify(payload)}`;
    const sig2 = await wallet.signMessage(message);
    const r = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-signature': sig2,
        'x-nonce': nonce2,
        'x-wallet': wallet.address,
      },
      body: JSON.stringify(payload),
    });
    console.log('mint 0.01 -> self:', r.status, await r.text());
  };
  await sensitiveTest();

  // --- audit list ---
  const aud = await fetch(`${API}/api/owner/audit?limit=5`, { headers: { authorization: `Bearer ${token}` } });
  console.log('audit:', aud.status, (await aud.json()).items?.map(x => ({ action: x.action, tx: x.txHash, status: x.status })));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
