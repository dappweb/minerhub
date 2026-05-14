# System Deployment Guide

This guide describes the active deployment model.

## Components

```text
Web app        -> Cloudflare Pages
Backend API    -> Cloudflare Worker
Database       -> Cloudflare D1
Mobile app     -> Expo / native builds
Contracts      -> BSC
```

Active contracts:

- `SUPER`
- `USDT` or `USDT_Mock`
- `MiningPool`

Exchange settlement is handled by backend operations tables and APIs.

## Deployment Order

1. Deploy or confirm contracts.
2. Sync addresses into Web, backend, and mobile environments.
3. Apply D1 schema.
4. Apply exchange naming patch if old data exists.
5. Deploy backend Worker.
6. Build and deploy Web app.
7. Build and publish mobile app.
8. Configure system settings in admin.
9. Run end-to-end smoke tests.

## Contract Addresses

`contracts/deployment.json` should contain:

```json
{
  "contracts": {
    "SUPER": "0x...",
    "USDT": "0x...",
    "MiningPool": "0x..."
  }
}
```

## Web Environment

```env
VITE_CHAIN_ID=56
VITE_RPC_URL=https://bsc-dataseed.binance.org/
VITE_MINING_POOL_ADDRESS=0x...
VITE_SUPER_ADDRESS=0x...
VITE_USDT_ADDRESS=0x...
VITE_API_BASE_URL=https://api.coinplanets.net
```

## Mobile Environment

```env
EXPO_PUBLIC_API_BASE_URL=https://api.coinplanets.net
EXPO_PUBLIC_CHAIN_ID=56
EXPO_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org/
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SUPER_ADDRESS=0x...
EXPO_PUBLIC_USDT_ADDRESS=0x...
```

## Backend Environment

```env
RPC_URL=https://bsc-dataseed.binance.org/
OWNER_ADDRESS=0x...
OWNER_PRIVATE_KEY=0x...
MINING_POOL_ADDRESS=0x...
SUPER_TOKEN_ADDRESS=0x...
USDT_TOKEN_ADDRESS=0x...
```

## Database

Apply schema:

```bash
npm --prefix backend run db:migrate
```

For environments with pre-existing exchange records using older naming:

```bash
wrangler d1 execute coin-planet-db --file=./backend/db/patch-exchange-naming.sql
```

## Verification

```bash
npm run test:deprecated-swaprouter
npm run lint
npm run build
npm --prefix backend run typecheck
npm --prefix backend test -- --run
npm --prefix contracts test
cd app-client
npx tsc --noEmit
```

## Smoke Test

1. Open Web app.
2. Login as owner/admin.
3. Confirm system status loads.
4. Confirm contract addresses display correctly.
5. Open mobile app.
6. Sync a test user.
7. Register a miner.
8. Submit a small exchange request in a staging account.
9. Approve and complete the exchange order.
10. Confirm payout transaction hash and audit logs are recorded.
