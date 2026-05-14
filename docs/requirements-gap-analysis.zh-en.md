# Coin Planet Requirements Gap Analysis

This file summarizes the current implementation against the product requirements.

## Executive Summary

The repository now contains the core operating loop:

- wallet and user bootstrap
- device registration and heartbeat tracking
- contract/month-card activation gates
- hourly reward ledger
- on-chain mining actions through `MiningPool`
- backend exchange orders
- operator approval/completion workflow
- payout batches
- owner/admin audit logs
- maintenance, agreement, announcement, and support settings

The biggest remaining work is operational hardening: deployed migrations, production env verification, end-to-end staging, risk controls, and richer reporting.

## Requirement Alignment

| Requirement | Status | Notes |
| --- | --- | --- |
| Maintenance mode | Implemented | `system_settings` drives maintenance flags and messages. |
| Customer/device/sub-account visibility | Implemented | Admin APIs aggregate users, profiles, devices, rewards, and hierarchy data. |
| User-scoped client data | Implemented | App fetches user state by signed wallet/user identity. |
| 30-day month-card logic | Implemented | Profile and reward paths include monthly-card and contract-term fields. |
| Hourly reward accounting | Implemented | Device heartbeat and scheduled logic write reward ledger entries. |
| Auto/manual exchange switch | Implemented | Global and user-level flags determine exchange handling. |
| Unified payout wallets/batches | Implemented | Exchange orders can be grouped into payout batches. |
| SUPER/USDT exchange price and logs | Implemented | `exchange_price_super_per_usdt`, price history, and trade logs are present. |
| Agreement/contract acceptance | Implemented | User agreement and contract tables/settings exist. |
| Risk control and analytics | Partial | Audit logs exist; deeper risk rules and dashboards remain future work. |

## Existing Capabilities

### Frontend

- public Web experience
- admin dashboard
- owner console
- wallet login
- contract and token interactions
- customer/device/reward/exchange operations UI

### Mobile

- wallet identity handling
- backend user sync
- mining actions
- profile and reward views
- exchange request flow
- transaction persistence

### Backend

- Cloudflare Worker routes
- D1 schema for users, devices, profiles, rewards, exchange orders, payouts, agreements, announcements, referrals, and owner audit logs
- exchange naming patch for old data
- owner/admin authorization
- tests for auth, locks, and scheduled reward behavior

### Contracts

- `SUPER`
- `USDT_Mock`
- `MiningPool`
- deployment and finalize scripts
- tests covering token/admin/mining behavior

## Priority Recommendations

### P0

- Apply D1 migrations and `backend/db/patch-exchange-naming.sql` where old data exists.
- Confirm production env variables for Web, backend, mobile, and contracts.
- Set exchange price and payout wallets in admin settings.
- Run end-to-end staging with one small account.

### P1

- Add explicit smoke-test scripts for exchange request, approval, payout batch, and completion.
- Add dashboard panels for payout queue health and stale exchange orders.
- Improve risk rules for repeated wallets, abnormal reward deltas, and offline/online anomalies.

### P2

- Add richer analytics export.
- Add automated reconciliation between exchange orders, payout hashes, and ledger changes.
- Add production alerting for failed payouts and reward accrual gaps.

## Verification Commands

```bash
npm run test:deprecated-swaprouter
npm run lint
npm run build
npm --prefix backend run typecheck
npm --prefix backend test -- --run
npm --prefix contracts test
cd app-client
npx tsc --noEmit
```
