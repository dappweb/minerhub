# Coin Planet Token And Reward Model

This document describes the active token and reward model.

## Assets

- `SUPER`: platform token managed by the `SUPER` contract.
- `USDT`: payout and accounting asset. Production uses the configured BSC USDT address; tests and demos can use `USDT_Mock`.
- `MiningPool`: on-chain mining contract that gates registration, hashrate, reward claims, and staking thresholds.

## Token Controls

`SUPER` supports:

- owner/admin management
- minter management
- minting by approved minters
- burn flows
- upgradeable deployment

`MiningPool` is approved as a SUPER minter during deployment so it can support mining reward flows.

## Reward Accrual

The repository combines on-chain and backend accounting:

- On-chain `MiningPool` manages miner registration and reward claiming.
- Backend `reward_ledger` records hourly operational rewards based on device heartbeat, user rate, contract status, and activation state.
- Contract and monthly-card settings gate whether rewards continue accruing.
- Admins can adjust rewards through operations APIs, with audit records.

## Exchange Pricing

The active pricing key is:

```text
exchange_price_super_per_usdt
```

The backend exposes this value through system and operations APIs. The value is used when exchange orders, payout records, and distribution records need a SUPER/USDT conversion snapshot.

The backend keeps compatibility reads for older storage keys where needed, but new storage and documentation should use `exchange_*` naming.

## Exchange And Payout Workflow

1. User has available SUPER reward balance.
2. User requests exchange/withdrawal through the app.
3. The app/backend records the SUPER amount, expected USDT amount, wallet, request note, and optional SUPER transfer transaction hash.
4. The backend inserts an `exchange_orders` row.
5. Operators approve or complete the order.
6. Payout batches can group approved orders.
7. The USDT payout transaction hash is recorded.
8. `exchange_trade_logs` and `exchange_price_history` provide audit context.

## Important Tables

- `exchange_orders`: request lifecycle.
- `exchange_trade_logs`: user-facing and admin-facing trade history.
- `exchange_price_history`: exchange price changes.
- `payout_batches`: grouped USDT payout operations.
- `payout_batch_items`: orders included in a batch.
- `super_distributions`: owner/admin SUPER distribution history.
- `token_locks`: lock/release state for distributed SUPER.
- `reward_withdrawals`: reward withdrawal records.

## Contract Deployment Output

`contracts/deployment.json` should contain:

```json
{
  "contracts": {
    "SUPER": "0x...",
    "USDT": "0x...",
    "MiningPool": "0x..."
  },
  "implementations": {
    "SUPER": "0x...",
    "MiningPool": "0x..."
  }
}
```

## Environment Keys

Web:

```env
VITE_SUPER_ADDRESS=0x...
VITE_USDT_ADDRESS=0x...
VITE_MINING_POOL_ADDRESS=0x...
```

Mobile:

```env
EXPO_PUBLIC_SUPER_ADDRESS=0x...
EXPO_PUBLIC_USDT_ADDRESS=0x...
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
```

Contracts:

```env
USDT_ADDRESS=0x...
RPC_URL=https://bsc-dataseed.binance.org/
DEPLOYER_PRIVATE_KEY=0x...
```

## Invariants

- Contract addresses must match the target chain.
- Reward accrual must stop when contract or activation state is not eligible.
- Exchange orders must preserve the price snapshot used for settlement.
- Owner/admin token operations must be audited.
- Payout transaction hashes should be recorded before marking orders complete.
