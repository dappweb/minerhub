# Coin Planet Contracts

This package contains the on-chain contracts used by Coin Planet.

The active contract set is intentionally small:

- `SUPER.sol`: upgradeable ERC20 token with owner/admin/minter controls.
- `USDT_Mock.sol`: local and demo USDT token for tests or mock deployments.
- `MiningPool.sol`: upgradeable mining pool contract for miner registration, hashrate updates, reward claims, SUPER staking thresholds, and admin operations.

SUPER-to-USDT exchange is no longer implemented as a dedicated on-chain exchange contract. It is handled by the backend operations flow, using `exchange_orders`, `exchange_trade_logs`, `exchange_price_history`, and payout batch tables.

## Install

```bash
npm install
```

## Environment

Create `contracts/.env` from `contracts/.env.example` and configure:

```env
RPC_URL=https://bsc-dataseed.binance.org/
BSC_RPC_URL=https://bsc-dataseed.binance.org/
DEPLOYER_PRIVATE_KEY=0x...
DEPLOY_ADMIN_ADDRESSES=0xAdmin1,0xAdmin2
BSCSCAN_API_KEY=...
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
```

`DEPLOY_ADMIN_ADDRESSES` is optional. The deploy script adds those addresses as admins on `SUPER` and `MiningPool`. The deployer remains the initial owner/admin.

## Commands

Compile:

```bash
npm run compile
```

Test:

```bash
npm test
```

Deploy to BSC:

```bash
npm run deploy:bsc
```

Finalize an existing deployment:

```bash
npm run deploy:finalize
```

Upgrade `MiningPool`:

```bash
npm run upgrade:mining-pool
```

## Deploy Output

`scripts/deploy.ts` writes `deployment.json` with:

- `contracts.SUPER`
- `contracts.USDT`
- `contracts.MiningPool`
- `implementations.SUPER`
- `implementations.MiningPool`
- `initialization.chainAdmins`
- `initialization.superMinters`

Use these addresses in the Web, mobile, and backend environments:

```env
VITE_SUPER_ADDRESS=0x...
VITE_USDT_ADDRESS=0x...
VITE_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SUPER_ADDRESS=0x...
EXPO_PUBLIC_USDT_ADDRESS=0x...
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
```

## Tested Behavior

The contract test suite covers:

- SUPER initial state.
- Minter-only minting.
- Admin management for minters and contract admins.
- Miner registration.
- Duplicate registration rejection.
- Hashrate updates.
- Invalid hashrate rejection.
- Admin-gated owner operations.
- Preventing removal of the last admin.
- SUPER stake threshold gating for rewards.
- End-to-end mining flow.

Run:

```bash
npm test
```

Expected current result:

```text
11 passing
```

## Security Notes

- Keep deployer and owner keys out of source control.
- Use real BSC USDT by setting `USDT_ADDRESS`.
- Keep `SUPER` minting permissions limited to the pool and trusted owner/admin workflows.
- Run tests after any contract or deployment-script change.
