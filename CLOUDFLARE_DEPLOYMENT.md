# Cloudflare Deployment Guide

Coin Planet uses Cloudflare Pages for the Web build and Cloudflare Workers + D1 for the backend API.

## Web Deployment

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Deploy with Wrangler:

```bash
npm run deploy:cf
```

## Backend Deployment

Deploy the Worker:

```bash
npm run deploy:api
```

Apply D1 schema:

```bash
npm --prefix backend run db:migrate
```

If the environment has old exchange naming data, apply:

```bash
wrangler d1 execute coin-planet-db --file=./backend/db/patch-exchange-naming.sql
```

## Required Web Variables

```env
VITE_CHAIN_ID=56
VITE_RPC_URL=https://bsc-dataseed.binance.org/
VITE_MINING_POOL_ADDRESS=0x...
VITE_SUPER_ADDRESS=0x...
VITE_USDT_ADDRESS=0x...
VITE_API_BASE_URL=https://api.coinplanets.net
VITE_ANDROID_DOWNLOAD_URL=https://api.coinplanets.net/api/downloads/android
VITE_IOS_DOWNLOAD_URL=https://testflight.apple.com/join/example
```

## Required Backend Variables

Configure these in Wrangler/Cloudflare secrets or environment settings as appropriate:

```env
RPC_URL=https://bsc-dataseed.binance.org/
OWNER_ADDRESS=0x...
OWNER_PRIVATE_KEY=0x...
MINING_POOL_ADDRESS=0x...
SUPER_TOKEN_ADDRESS=0x...
USDT_TOKEN_ADDRESS=0x...
```

## Verification

```bash
npm run test:deprecated-swaprouter
npm run lint
npm run build
npm --prefix backend run typecheck
npm --prefix backend test -- --run
```

## Operational Checks

- Maintenance mode is configured.
- Owner/admin wallets are configured.
- Exchange price is set.
- Payout wallets are configured.
- Android/iOS download URLs are valid.
- Worker routes respond under the production API domain.
