# Coin Planet / MinerHub

Coin Planet is a Web, mobile, backend, and smart-contract project for a managed mining and reward workflow.

The current implementation has moved away from a dedicated on-chain exchange contract. Mining and reward claims remain on-chain through `MiningPool`; SUPER-to-USDT exchange is handled as a backend operations workflow with recorded orders, approvals, payout batches, and audit logs.

## Current Stack

- Web app: Vite + React + RainbowKit/Wagmi for the public site and admin console.
- Mobile app: Expo + React Native in `app-client/`.
- Backend API: Cloudflare Workers + D1 in `backend/`.
- Contracts: Hardhat project in `contracts/`.
- Chain: BSC by default.

## Main Workflows

- Wallet users register mining devices and claim rewards through `MiningPool`.
- The app can submit reward withdrawal and exchange requests to the backend.
- Exchange requests are stored in `exchange_orders`.
- Operators approve, complete, and batch USDT payouts through the operations/owner APIs.
- Admins manage system settings, exchange price, maintenance mode, customers, devices, rewards, agreements, and audit records.

## Local Setup

Install dependencies:

```bash
npm install
npm --prefix backend install
npm --prefix contracts install
npm --prefix app-client install
```

Copy and configure environment variables:

```bash
cp .env.example .env.local
```

Important Web/backend variables:

- `VITE_CHAIN_ID`
- `VITE_RPC_URL`
- `VITE_MINING_POOL_ADDRESS`
- `VITE_SUPER_ADDRESS`
- `VITE_USDT_ADDRESS`
- `VITE_API_BASE_URL`
- `VITE_ANDROID_DOWNLOAD_URL`
- `VITE_IOS_DOWNLOAD_URL`
- `RPC_URL`
- `DEPLOYER_PRIVATE_KEY`

Important mobile variables:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_CHAIN_ID`
- `EXPO_PUBLIC_RPC_URL`
- `EXPO_PUBLIC_MINING_POOL_ADDRESS`
- `EXPO_PUBLIC_SUPER_ADDRESS`
- `EXPO_PUBLIC_USDT_ADDRESS`
- `EXPO_PUBLIC_WALLET_PRIVATE_KEY`

## Run

Web:

```bash
npm run dev
```

Backend:

```bash
npm run dev:api
```

Mobile:

```bash
npm --prefix app-client run start
```

Contracts:

```bash
npm --prefix contracts run compile
npm --prefix contracts test
```

## Verification

Useful checks before shipping:

```bash
npm run lint
npm run build
npm run test:deprecated-swaprouter
npm --prefix backend run typecheck
npm --prefix backend test -- --run
npm --prefix contracts test
```

`npm run build` runs `scripts/pre-build.mjs`, which may sync app download metadata and upload the Android APK when the required deploy environment is present.

## Repository Layout

```text
minerhub/
  app-client/    Expo mobile app
  backend/       Cloudflare Worker API and D1 schema
  contracts/     Hardhat contracts, tests, deploy scripts
  docs/          Product, integration, and operations docs
  scripts/       Project automation scripts
  src/           Web app
```

## Deployment

Cloudflare Pages:

```bash
npm run deploy:cf
```

Backend Worker:

```bash
npm run deploy:api
```

Contracts:

```bash
npm run deploy:contracts
```
