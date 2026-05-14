# App Deployment Checklist

This file summarizes the current mobile deployment state and checks.

## Current App Stack

- Expo SDK 52
- React Native 0.76
- Viem for chain calls
- Backend API through `EXPO_PUBLIC_API_BASE_URL`
- BSC by default

## Required Environment

```env
EXPO_PUBLIC_API_BASE_URL=https://api.coinplanets.net
EXPO_PUBLIC_CHAIN_ID=56
EXPO_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org/
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SUPER_ADDRESS=0x...
EXPO_PUBLIC_USDT_ADDRESS=0x...
```

For controlled internal testing only:

```env
EXPO_PUBLIC_WALLET_PRIVATE_KEY=0x...
```

## Supported Flows

- User identity and wallet bootstrap.
- Backend user sync.
- System status, announcement, agreement, and profile reads.
- Miner registration and reward actions through `MiningPool`.
- SUPER stake, unstake, transfer, and balance reads.
- Exchange request submission through backend operations.
- Transaction persistence and recovery.

## Build / Run

```bash
cd app-client
npm install
npm run start
npm run android
```

## Verification

```bash
cd app-client
npx tsc --noEmit
```

Project-level checks:

```bash
npm run test:deprecated-swaprouter
npm run lint
npm run build
```

## Release Notes

- Confirm API base URL points to the intended backend Worker.
- Confirm contract addresses match the intended BSC deployment.
- Confirm exchange price and payout settings are configured in admin before enabling production exchange requests.
- Do not embed production user private keys in the app bundle.
