# Coin Planet System Integration Roadmap

This roadmap reflects the current repository state.

## Current Direction

Coin Planet now uses a split model:

- On-chain: SUPER token, USDT token address, and MiningPool.
- Backend: customer profiles, rewards, exchange orders, payout batches, agreements, announcements, audit logs, and owner operations.
- Frontend/mobile: wallet flows, mining actions, account state, reward withdrawal, and exchange request UI.

Exchange settlement is handled by the backend operations layer. There is no dedicated on-chain exchange router in the active architecture.

## End-to-End User Flow

1. User opens the mobile app.
2. App creates or loads the wallet identity.
3. App syncs the wallet/user record with the backend.
4. User accepts required agreements/contracts.
5. Operator activates the user profile and contract/month-card term.
6. User registers a miner on-chain through `MiningPool`.
7. Device heartbeats update backend online status.
8. Backend accrues hourly rewards into `reward_ledger`.
9. User claims on-chain mining rewards where applicable.
10. User submits a reward withdrawal or exchange request.
11. Backend stores an `exchange_orders` record.
12. Operator approves/completes the order and records payout transaction hashes.

## Admin / Owner Flow

1. Owner signs in with wallet-based auth.
2. Admin dashboard reads customers, devices, rewards, exchange orders, payout batches, and audit logs.
3. Owner can configure system settings:
   - maintenance mode
   - agreement/contract content
   - monthly-card and contract terms
   - reward rates
   - exchange price
   - support contacts
4. Owner can run token operations:
   - SUPER mint/transfer/burn workflows where enabled
   - distribution records
   - token lock/release workflows
5. Operators process exchange orders and payout batches.

## Integration Surfaces

### Contracts

- `SUPER`: token permissions and minting surface.
- `USDT_Mock`: local/demo support.
- `MiningPool`: miner registration, hashrate, staking threshold, and reward claiming.

### Backend API

- `/api/users`
- `/api/devices`
- `/api/claims`
- `/api/gas`
- `/api/operations`
- `/api/owner`
- `/api/admin`
- `/api/system`
- `/api/downloads`

### Database

Core D1 tables:

- `users`
- `devices`
- `customer_profiles`
- `device_status_history`
- `reward_ledger`
- `exchange_orders`
- `exchange_trade_logs`
- `exchange_price_history`
- `payout_batches`
- `payout_batch_items`
- `super_distributions`
- `token_locks`
- `reward_withdrawals`
- `owner_sessions`
- `owner_audit_logs`
- `referral_edges`
- `referral_closure`

## Completed Work

- Web app builds successfully.
- Backend type-checks and tests pass.
- Contract test suite passes.
- Mobile TypeScript check passes.
- Deprecated exchange-router references are guarded by `npm run test:deprecated-swaprouter`.
- Exchange naming is aligned around `exchange_*` storage and API fields.
- Contract deployment output now contains `SUPER`, `USDT`, and `MiningPool`.

## Remaining Operational Work

- Apply D1 migrations in each deployed environment.
- Confirm production contract addresses in Web, backend, and mobile envs.
- Set exchange price before enabling production exchange requests.
- Configure owner/sub-admin wallets.
- Configure payout wallets and payout operating procedure.
- Verify download links and app release channels.
- Run a staged end-to-end test using a small user/account before opening the flow broadly.

## Suggested Verification Matrix

### Web

```bash
npm run lint
npm run build
```

### Backend

```bash
npm --prefix backend run typecheck
npm --prefix backend test -- --run
```

### Contracts

```bash
npm --prefix contracts test
```

### Mobile

```bash
cd app-client
npx tsc --noEmit
```

### Deprecated Reference Guard

```bash
npm run test:deprecated-swaprouter
```

## Deployment Order

1. Deploy or confirm contracts.
2. Sync contract addresses to root, backend, and mobile environments.
3. Apply D1 schema and exchange naming patch where needed.
4. Deploy backend Worker.
5. Build and deploy Web app.
6. Publish or update mobile app.
7. Configure admin settings.
8. Run smoke tests for wallet login, user sync, miner registration, rewards, exchange request, order approval, and payout completion.
