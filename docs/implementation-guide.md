# Coin Planet Implementation Guide

This guide describes the current implementation in this repository.

## Architecture

```text
Web / Admin Console
        |
        v
Cloudflare Worker API
        |
        v
Cloudflare D1

Mobile App
        |
        +--> Backend API
        |
        +--> BSC contracts: SUPER, USDT, MiningPool
```

The on-chain surface is focused on mining and token controls. Exchange settlement is an operations workflow in the backend, not a dedicated on-chain exchange contract.

## Contracts

Contract source lives in `contracts/contracts/`.

- `SUPER.sol`: upgradeable token with owner/admin/minter permissions.
- `USDT_Mock.sol`: test/demo token.
- `MiningPool.sol`: mining registration, hashrate, reward claim, stake threshold, and admin functions.

Deploy with:

```bash
npm --prefix contracts run deploy:bsc
```

Verify locally with:

```bash
npm --prefix contracts test
```

## Backend

Backend source lives in `backend/src/`.

Important routes:

- `users`: wallet/user bootstrap and profile lookup.
- `devices`: device registration, heartbeat, online status, and reward accrual.
- `claims`: reward withdrawal and exchange request submission.
- `operations`: operator exchange order approval, completion, logs, pricing, and payout batches.
- `owner`: owner-only token, distribution, payout, and audit actions.
- `system`: maintenance mode, agreement/contract settings, support contacts, and exchange price.
- `admin`: admin dashboard data and customer/device management.

Important D1 tables:

- `users`
- `devices`
- `customer_profiles`
- `reward_ledger`
- `exchange_orders`
- `exchange_trade_logs`
- `exchange_price_history`
- `payout_batches`
- `payout_batch_items`
- `super_distributions`
- `token_locks`
- `reward_withdrawals`
- `owner_sessions`
- `owner_audit_logs`

Run backend checks:

```bash
npm --prefix backend run typecheck
npm --prefix backend test -- --run
```

## Web App

Web source lives in `src/`.

Key areas:

- Public site and routing: `src/App.tsx`
- Admin console: `src/components/AdminDashboard.tsx`
- Owner console: `src/components/OwnerConsole.tsx`
- Chain utilities: `src/lib/blockchain.ts`
- Wallet setup: `src/lib/wallet.ts`
- I18n text: `src/lib/i18n.tsx`

Run:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Type-check:

```bash
npm run lint
```

## Mobile App

Mobile source lives in `app-client/`.

Key areas:

- App shell and flows: `app-client/src/App.tsx`
- Mobile tabs: `app-client/src/components/mobile/`
- API client: `app-client/src/services/api.ts`
- Chain utilities: `app-client/src/services/blockchain.ts`
- Transaction persistence: `app-client/src/hooks/useTransactionManager.ts`

Run:

```bash
npm --prefix app-client run start
```

Type-check:

```bash
npx tsc --noEmit
```

Run that command from `app-client/`.

## Exchange Workflow

1. Admin configures `exchange_price_super_per_usdt`.
2. User requests a reward withdrawal or exchange from the app.
3. User-side SUPER transfer hash is recorded when available.
4. Backend creates an `exchange_orders` row.
5. Global and per-user `exchange_auto_enabled` flags decide auto/manual handling.
6. Operator approves or completes the order.
7. USDT payout transaction hash is recorded as `usdt_tx_hash`.
8. Payout batches group approved orders for operational settlement.
9. Logs and history remain queryable for audit.

## Environment Variables

Web:

```env
VITE_CHAIN_ID=56
VITE_RPC_URL=https://bsc-dataseed.binance.org/
VITE_MINING_POOL_ADDRESS=0x...
VITE_SUPER_ADDRESS=0x...
VITE_USDT_ADDRESS=0x...
VITE_API_BASE_URL=https://api.coinplanets.net
```

Mobile:

```env
EXPO_PUBLIC_CHAIN_ID=56
EXPO_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org/
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SUPER_ADDRESS=0x...
EXPO_PUBLIC_USDT_ADDRESS=0x...
EXPO_PUBLIC_API_BASE_URL=https://api.coinplanets.net
```

Contracts:

```env
RPC_URL=https://bsc-dataseed.binance.org/
BSC_RPC_URL=https://bsc-dataseed.binance.org/
DEPLOYER_PRIVATE_KEY=0x...
DEPLOY_ADMIN_ADDRESSES=0x...
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
```

## Release Checklist

```bash
npm run test:deprecated-swaprouter
npm run lint
npm run build
npm --prefix backend run typecheck
npm --prefix backend test -- --run
npm --prefix contracts test
```

Before deploying, also confirm:

- D1 schema migrations are applied.
- Contract addresses match the intended network.
- Owner/admin wallets are configured.
- Exchange price is set.
- Payout wallets and support contacts are configured.
- App download links are valid.
