# SUPER Token Mechanism Analysis

This document summarizes how SUPER is used in the current Coin Planet system.

## Role Of SUPER

SUPER is the platform token used for mining rewards, staking thresholds, account balances, and exchange requests.

The active model is:

- Mining and reward claims are handled through `MiningPool`.
- SUPER token permissions are handled by `SUPER`.
- USDT settlement is handled by backend operations and payout workflows.
- Exchange pricing is configured in the backend as `exchange_price_super_per_usdt`.

## User Value Flow

1. User creates or loads a wallet in the app.
2. User syncs identity with the backend.
3. User registers or activates a miner.
4. Device heartbeat keeps operational state fresh.
5. Rewards accrue in backend ledgers and/or are claimable through on-chain mining flows.
6. User can submit an exchange request for SUPER-to-USDT settlement.
7. Operations approves/completes the request and records payout hashes.

## Contract Surface

### SUPER

- Upgradeable ERC20.
- Owner/admin controls.
- Minter controls.
- Burn support.
- Used by owner and pool workflows.

### MiningPool

- Miner registration.
- Hashrate updates.
- Reward claim behavior.
- SUPER staking threshold checks.
- Admin operations.

### USDT

- Production uses configured BSC USDT.
- Local/demo can use `USDT_Mock`.

## Backend Exchange Controls

Important storage:

- `exchange_orders`
- `exchange_trade_logs`
- `exchange_price_history`
- `payout_batches`
- `payout_batch_items`

Important settings:

- `exchange_price_super_per_usdt`
- `exchange_auto_enabled`
- `payout_wallets_json`

## Risk Points

- Exchange price must be configured before enabling exchange requests.
- Payout wallet and owner wallet controls must be audited.
- Payout hashes should be recorded before marking orders complete.
- Reward accrual must stop when contract/month-card activation is invalid.
- Admin token operations must be visible in `owner_audit_logs`.

## Verification

```bash
npm run test:deprecated-swaprouter
npm --prefix contracts test
npm --prefix backend test -- --run
```
