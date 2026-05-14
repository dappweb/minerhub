# USDT Deployment Guide

Coin Planet can use either a real USDT token address or a mock token for local/demo environments.

## Production

For BSC mainnet, use the official USDT token address:

```env
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
VITE_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
EXPO_PUBLIC_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
```

## Local / Demo

If `USDT_ADDRESS` is not provided, the contract deploy script can deploy `USDT_Mock` and write its address to `contracts/deployment.json`.

Use the generated mock address for local Web/mobile/backend testing only.

## Contract Deploy

```bash
npm --prefix contracts run deploy:bsc
```

Expected deployment output contains:

```json
{
  "contracts": {
    "SUPER": "0x...",
    "USDT": "0x...",
    "MiningPool": "0x..."
  }
}
```

## Backend Settlement Flow

USDT payouts are tracked by the backend:

- `exchange_orders`
- `exchange_trade_logs`
- `exchange_price_history`
- `payout_batches`
- `payout_batch_items`

Operators approve and complete exchange orders, then record the USDT payout transaction hash.

## Verification

```bash
npm run test:deprecated-swaprouter
npm --prefix contracts test
npm --prefix backend run typecheck
npm --prefix backend test -- --run
```

Before production payout, confirm:

- `USDT_TOKEN_ADDRESS` matches the intended network.
- Owner wallet has the required USDT balance.
- Payout wallet settings are configured.
- Exchange price is configured.
