# Android Run Guide

This guide is for running the Coin Planet Expo app on Android.

## Prerequisites

- Node.js and npm installed.
- Android Studio installed.
- Android SDK and platform tools available.
- An emulator or physical Android device.

## Install

```bash
cd app-client
npm install
```

## Environment

Set the mobile public environment variables before running:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.coinplanets.net
EXPO_PUBLIC_CHAIN_ID=56
EXPO_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org/
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SUPER_ADDRESS=0x...
EXPO_PUBLIC_USDT_ADDRESS=0x...
EXPO_PUBLIC_WALLET_PRIVATE_KEY=0x...
```

Use a controlled test wallet only for `EXPO_PUBLIC_WALLET_PRIVATE_KEY`.

## Start Android

```bash
npm run android
```

For Metro only:

```bash
npm run start
```

## Verify

Run TypeScript check:

```bash
npx tsc --noEmit
```

Basic smoke flow:

1. App starts without a redbox.
2. Wallet identity loads or is created.
3. API status loads.
4. User profile sync succeeds.
5. Mining and exchange screens render.
6. No missing contract-address errors appear.

## Notes

Exchange requests are submitted to the backend operations workflow. The active on-chain contract used for mining is `MiningPool`.
