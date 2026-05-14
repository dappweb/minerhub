# Coin Planet Mobile Client

Expo + React Native mobile app for Coin Planet.

## Run

```bash
npm install
npm run start
```

Device targets:

```bash
npm run android
npm run ios
npm run web
```

## Environment

Configure public Expo variables before starting the app:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.coinplanets.net
EXPO_PUBLIC_CHAIN_ID=56
EXPO_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org/
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SUPER_ADDRESS=0x...
EXPO_PUBLIC_USDT_ADDRESS=0x...
EXPO_PUBLIC_WALLET_PRIVATE_KEY=0x...
```

`EXPO_PUBLIC_WALLET_PRIVATE_KEY` is for controlled test wallets only. Do not ship production user private keys in the app.

## Current Capabilities

- Create or load wallet identity.
- Sync user identity with the backend.
- Read profile, rewards, devices, announcements, agreements, and system status.
- Register miners through `MiningPool`.
- Claim mining rewards where supported.
- Stake, unstake, transfer, and inspect SUPER.
- Submit exchange requests through the backend operations workflow.
- Persist and recover in-flight transactions.

## Structure

```text
app-client/
  src/App.tsx
  src/components/mobile/
  src/hooks/
  src/services/api.ts
  src/services/blockchain.ts
  src/services/wallet.ts
  app.json
  package.json
```

## Verification

Run from `app-client/`:

```bash
npx tsc --noEmit
```
