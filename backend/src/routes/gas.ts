import { JsonRpcProvider, parseEther, Wallet } from 'ethers';
import { extractAndVerifyAuth } from '../lib/auth';
import { createId, nowIso } from '../lib/id';
import { badRequest, internalError, json, unauthorized } from '../lib/response';
import { isMaintenanceEnabled } from '../lib/system';
import type { Env } from '../types/env';

type PayToken = 'SUPER' | 'USDT';
type RelayMode = 'auto-transfer' | 'credit-only';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parsePayToken(value: unknown): PayToken | null {
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  if (upper === 'SUPER' || upper === 'USDT') return upper;
  return null;
}

function isValidWalletAddress(wallet: string): boolean {
  return EVM_ADDRESS_REGEX.test(wallet.trim());
}

function addMinutes(isoBase: string, minutes: number): string {
  return new Date(new Date(isoBase).getTime() + minutes * 60_000).toISOString();
}

function firstErrorLine(input: string): string {
  return input.split('\n').map((line) => line.trim()).find(Boolean) ?? input;
}

function getPricing(env: Env) {
  const feeRate = toNumber(env.GAS_FEE_RATE, 0.02);
  const bnbUsd = toNumber(env.BNB_USD_PRICE, 600);
  const superUsd = toNumber(env.SUPER_USD_PRICE, 0.1);
  const usdtUsd = toNumber(env.USDT_USD_PRICE, 1);

  return {
    feeRate,
    bnbUsd,
    superUsd,
    usdtUsd,
  };
}

function getTokenUsdPrice(token: PayToken, pricing: ReturnType<typeof getPricing>): number {
  return token === 'SUPER' ? pricing.superUsd : pricing.usdtUsd;
}

async function transferBnbFromTreasury(env: Env, to: string, amountBnb: string): Promise<{ mode: RelayMode; txHash?: string; errorMessage?: string }> {
  if (!env.GAS_TREASURY_PRIVATE_KEY) {
    return { mode: 'credit-only' };
  }

  try {
    const provider = new JsonRpcProvider(env.RPC_URL);
    const wallet = new Wallet(env.GAS_TREASURY_PRIVATE_KEY, provider);
    const tx = await wallet.sendTransaction({
      to,
      value: parseEther(amountBnb),
    });

    const receipt = await tx.wait(1);
    if (!receipt) {
      return {
        mode: 'auto-transfer',
        txHash: tx.hash,
        errorMessage: 'No transaction receipt returned',
      };
    }

    return {
      mode: 'auto-transfer',
      txHash: tx.hash,
    };
  } catch (error) {
    const message = error instanceof Error ? firstErrorLine(error.message) : 'Unknown transfer error';
    return {
      mode: 'auto-transfer',
      errorMessage: message,
    };
  }
}

async function updateWalletCredit(env: Env, wallet: string, fundedBnb: string): Promise<void> {
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO gas_wallet_credits (wallet, total_bnb_funded, total_orders, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(wallet) DO UPDATE SET
       total_bnb_funded = CAST(total_bnb_funded AS REAL) + CAST(excluded.total_bnb_funded AS REAL),
       total_orders = total_orders + 1,
       updated_at = excluded.updated_at`
  )
    .bind(wallet.toLowerCase(), fundedBnb, now)
    .run();
}

async function handleQuote(request: Request, env: Env): Promise<Response> {
  if (await isMaintenanceEnabled(env)) {
    return json({ error: 'System is under maintenance' }, 503);
  }

  const body = (await request.json().catch(() => null)) as
    | { wallet?: string; payToken?: string; payAmount?: string }
    | null;

  if (!body?.wallet || !body.payToken || !body.payAmount) {
    return badRequest('wallet, payToken, payAmount are required');
  }

  if (!isValidWalletAddress(body.wallet)) {
    return badRequest('wallet format is invalid');
  }

  const payToken = parsePayToken(body.payToken);
  if (!payToken) {
    return badRequest('payToken must be SUPER or USDT');
  }

  const payAmountNum = Number(body.payAmount);
  if (!Number.isFinite(payAmountNum) || payAmountNum <= 0) {
    return badRequest('payAmount must be a positive number');
  }

  if (payAmountNum > 1_000_000) {
    return badRequest('payAmount is too large');
  }

  const pricing = getPricing(env);
  const tokenUsdPrice = getTokenUsdPrice(payToken, pricing);
  const grossUsdValue = payAmountNum * tokenUsdPrice;
  const netUsdValue = grossUsdValue * (1 - pricing.feeRate);
  const bnbAmount = netUsdValue / pricing.bnbUsd;

  if (!Number.isFinite(bnbAmount) || bnbAmount <= 0) {
    return internalError('failed to calculate bnb quote');
  }

  const quoteId = createId('gq');
  const createdAt = nowIso();
  const expiresAt = addMinutes(createdAt, 1);

  const priceSnapshot = JSON.stringify({
    bnbUsd: pricing.bnbUsd,
    superUsd: pricing.superUsd,
    usdtUsd: pricing.usdtUsd,
  });

  await env.DB.prepare(
    `INSERT INTO gas_quotes (id, wallet, pay_token, pay_amount, bnb_amount, fee_rate, price_snapshot, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  )
    .bind(
      quoteId,
      body.wallet.toLowerCase(),
      payToken,
      body.payAmount,
      bnbAmount.toFixed(8),
      pricing.feeRate.toString(),
      priceSnapshot,
      expiresAt,
      createdAt,
    )
    .run();

  return json({
    quoteId,
    wallet: body.wallet.toLowerCase(),
    payToken,
    payAmount: body.payAmount,
    estimatedBnb: bnbAmount.toFixed(8),
    feeRate: pricing.feeRate,
    expiresAt,
    quoteVersion: 'v1-phase1',
  }, 201);
}

async function handlePurchase(request: Request, env: Env): Promise<Response> {
  if (await isMaintenanceEnabled(env)) {
    return json({ error: 'System is under maintenance' }, 503);
  }

  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || 'Signature verification failed');
  }

  const body = (await request.json().catch(() => null)) as
    | { quoteId?: string; wallet?: string; userId?: string }
    | null;

  if (!body?.quoteId || !body.wallet) {
    return badRequest('quoteId and wallet are required');
  }

  if (!isValidWalletAddress(body.wallet)) {
    return badRequest('wallet format is invalid');
  }

  if (body.wallet.toLowerCase() !== auth.wallet?.toLowerCase()) {
    return badRequest('Wallet mismatch');
  }

  const quote = await env.DB.prepare(
    'SELECT id, wallet, pay_token, pay_amount, bnb_amount, expires_at, used FROM gas_quotes WHERE id = ?'
  )
    .bind(body.quoteId)
    .first<{
      id: string;
      wallet: string;
      pay_token: string;
      pay_amount: string;
      bnb_amount: string;
      expires_at: string;
      used: number;
    }>();

  if (!quote) {
    return badRequest('Quote not found');
  }

  if (quote.wallet.toLowerCase() !== body.wallet.toLowerCase()) {
    return badRequest('Quote wallet mismatch');
  }

  if (quote.used === 1) {
    return badRequest('Quote already used');
  }

  if (new Date(quote.expires_at).getTime() < Date.now()) {
    return badRequest('Quote expired');
  }

  const existingOrder = await env.DB.prepare(
    `SELECT id, quote_id, wallet, status, relay_mode, relay_tx_hash, error_message, bnb_amount
     FROM gas_orders WHERE quote_id = ? AND wallet = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(quote.id, body.wallet.toLowerCase())
    .first<{
      id: string;
      quote_id: string;
      wallet: string;
      status: string;
      relay_mode: string;
      relay_tx_hash: string | null;
      error_message: string | null;
      bnb_amount: string;
    }>();

  if (existingOrder && existingOrder.status === 'done') {
    return json({
      orderId: existingOrder.id,
      quoteId: existingOrder.quote_id,
      wallet: existingOrder.wallet,
      status: existingOrder.status,
      relayMode: existingOrder.relay_mode,
      relayTxHash: existingOrder.relay_tx_hash,
      errorMessage: existingOrder.error_message,
      fundedBnb: existingOrder.bnb_amount,
    });
  }

  const orderId = createId('go');
  const now = nowIso();

  const transferResult = await transferBnbFromTreasury(env, body.wallet, quote.bnb_amount);
  const status = transferResult.errorMessage ? 'failed' : 'done';

  await env.DB.prepare(
    `INSERT INTO gas_orders (
      id, quote_id, wallet, user_id, pay_token, pay_amount, bnb_amount,
      status, relay_mode, relay_tx_hash, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      orderId,
      quote.id,
      body.wallet.toLowerCase(),
      body.userId ?? null,
      quote.pay_token,
      quote.pay_amount,
      quote.bnb_amount,
      status,
      transferResult.mode,
      transferResult.txHash ?? null,
      transferResult.errorMessage ?? null,
      now,
      now,
    )
    .run();

  if (!transferResult.errorMessage) {
    await env.DB.prepare('UPDATE gas_quotes SET used = 1 WHERE id = ?').bind(quote.id).run();
    await updateWalletCredit(env, body.wallet, quote.bnb_amount);
  }

  return json({
    orderId,
    quoteId: quote.id,
    wallet: body.wallet.toLowerCase(),
    status,
    relayMode: transferResult.mode,
    relayTxHash: transferResult.txHash ?? null,
    errorMessage: transferResult.errorMessage ?? null,
    fundedBnb: quote.bnb_amount,
  }, transferResult.errorMessage ? 500 : 201);
}

async function handleOrderGet(env: Env, orderId: string): Promise<Response> {
  const order = await env.DB.prepare(
    `SELECT id, quote_id, wallet, user_id, pay_token, pay_amount, bnb_amount, status,
            relay_mode, relay_tx_hash, error_message, created_at, updated_at
     FROM gas_orders WHERE id = ?`
  )
    .bind(orderId)
    .first();

  if (!order) {
    return json({ error: 'Gas order not found' }, 404);
  }

  return json(order);
}

async function handleWalletCredit(request: Request, env: Env): Promise<Response> {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!wallet) {
    return badRequest('wallet query param is required');
  }

  const row = await env.DB.prepare(
    'SELECT wallet, total_bnb_funded, total_orders, updated_at FROM gas_wallet_credits WHERE wallet = ?'
  )
    .bind(wallet.toLowerCase())
    .first();

  return json(row ?? {
    wallet: wallet.toLowerCase(),
    total_bnb_funded: '0',
    total_orders: 0,
    updated_at: nowIso(),
  });
}

async function handleIntentCreate(request: Request, env: Env): Promise<Response> {
  if (await isMaintenanceEnabled(env)) {
    return json({ error: 'System is under maintenance' }, 503);
  }

  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || 'Signature verification failed');
  }

  const body = (await request.json().catch(() => null)) as
    | {
        wallet?: string;
        userId?: string;
        payToken?: string;
        maxTokenSpend?: string;
        action?: string;
        actionPayload?: Record<string, unknown>;
      }
    | null;

  if (!body?.wallet || !body.payToken || !body.maxTokenSpend || !body.action) {
    return badRequest('wallet, payToken, maxTokenSpend, action are required');
  }

  const payToken = parsePayToken(body.payToken);
  if (!payToken) {
    return badRequest('payToken must be SUPER or USDT');
  }

  if (body.wallet.toLowerCase() !== auth.wallet?.toLowerCase()) {
    return badRequest('Wallet mismatch');
  }

  const intentId = createId('gi');
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO gas_intents (id, wallet, user_id, pay_token, max_token_spend, action, action_payload, status, relay_order_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      intentId,
      body.wallet.toLowerCase(),
      body.userId ?? null,
      payToken,
      body.maxTokenSpend,
      body.action,
      JSON.stringify(body.actionPayload ?? {}),
      'pending',
      null,
      now,
      now,
    )
    .run();

  return json({
    intentId,
    status: 'pending',
    relayMode: env.GAS_TREASURY_PRIVATE_KEY ? 'auto-transfer' : 'credit-only',
    phase: 'phase2-intent',
  }, 201);
}

async function handleIntentRelay(request: Request, env: Env): Promise<Response> {
  if (await isMaintenanceEnabled(env)) {
    return json({ error: 'System is under maintenance' }, 503);
  }

  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || 'Signature verification failed');
  }

  const body = (await request.json().catch(() => null)) as { intentId?: string; wallet?: string } | null;
  if (!body?.intentId || !body.wallet) {
    return badRequest('intentId and wallet are required');
  }

  if (body.wallet.toLowerCase() !== auth.wallet?.toLowerCase()) {
    return badRequest('Wallet mismatch');
  }

  const intent = await env.DB.prepare(
    'SELECT id, wallet, status FROM gas_intents WHERE id = ?'
  )
    .bind(body.intentId)
    .first<{ id: string; wallet: string; status: string }>();

  if (!intent) {
    return badRequest('Intent not found');
  }

  if (intent.wallet.toLowerCase() !== body.wallet.toLowerCase()) {
    return badRequest('Intent wallet mismatch');
  }

  if (intent.status !== 'pending') {
    return badRequest(`Intent status is ${intent.status}, expected pending`);
  }

  const now = nowIso();
  await env.DB.prepare('UPDATE gas_intents SET status = ?, updated_at = ? WHERE id = ?')
    .bind('accepted', now, intent.id)
    .run();

  return json({
    intentId: intent.id,
    status: 'accepted',
    relayType: 'paymaster-ready',
    note: 'Intent accepted for relay pipeline. Hook real paymaster executor in next rollout.',
  });
}

async function handleIntentGet(env: Env, intentId: string): Promise<Response> {
  const intent = await env.DB.prepare(
    `SELECT id, wallet, user_id, pay_token, max_token_spend, action, action_payload,
            status, relay_order_id, created_at, updated_at
     FROM gas_intents WHERE id = ?`
  )
    .bind(intentId)
    .first();

  if (!intent) {
    return json({ error: 'Gas intent not found' }, 404);
  }

  return json(intent);
}

export async function handleGas(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'quote') {
    return handleQuote(request, env);
  }

  if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'purchase') {
    return handlePurchase(request, env);
  }

  if (request.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'orders') {
    return handleOrderGet(env, pathParts[1]);
  }

  if (request.method === 'GET' && pathParts.length === 1 && pathParts[0] === 'balance') {
    return handleWalletCredit(request, env);
  }

  if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'intent') {
    return handleIntentCreate(request, env);
  }

  if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'relay') {
    return handleIntentRelay(request, env);
  }

  if (request.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'intent') {
    return handleIntentGet(env, pathParts[1]);
  }

  return json({ error: 'Unsupported gas route' }, 404);
}
