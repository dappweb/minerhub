# Development Timeline And Costs

This document is a planning reference for the current implementation.

## Current Implementation Status

Completed in the repository:

- Web app and admin console build.
- Expo mobile client compiles.
- Cloudflare Worker backend type-checks and tests pass.
- D1 schema includes users, devices, profiles, rewards, exchange orders, payout batches, agreements, announcements, owner audit logs, and referrals.
- Contracts are reduced to `SUPER`, `USDT_Mock`, and `MiningPool`.
- Deprecated exchange-router references are covered by a project check.
- Docs and deployment guides now describe the backend exchange workflow.

## Suggested Delivery Phases

### Phase 1: Stabilization

Focus:

- Apply D1 migrations.
- Confirm production environment variables.
- Confirm contract addresses.
- Configure owner/admin wallets.
- Configure exchange price and payout wallets.
- Run staging end-to-end flows.

Estimated effort:

- Backend/full-stack: 3-5 days.
- DevOps: 1-2 days.
- QA: 2-3 days.

### Phase 2: Operations Hardening

Focus:

- Add exchange order smoke-test scripts.
- Add payout reconciliation checks.
- Add stale order alerts.
- Improve reward anomaly reporting.
- Add dashboard filters and exports.

Estimated effort:

- Backend/full-stack: 1-2 weeks.
- QA: 3-5 days.

### Phase 3: Release Readiness

Focus:

- Production deploy rehearsal.
- App release-channel validation.
- Support contact setup.
- Owner/admin runbook.
- Monitoring and incident response.

Estimated effort:

- Product/operations: 2-4 days.
- DevOps: 2-4 days.
- QA: 2-4 days.

## Cost Buckets

Actual cost depends on team rates, but the remaining work mostly falls into:

- Engineering hardening.
- QA and staging devices.
- Cloudflare/D1/R2/Worker runtime.
- BSC gas for deploy, owner operations, and test transactions.
- App distribution and signing.
- Monitoring and support tooling.

## Release Exit Criteria

- `npm run lint` passes.
- `npm run build` passes.
- `npm run test:deprecated-swaprouter` passes.
- Backend type-check and tests pass.
- Contract tests pass.
- Mobile TypeScript check passes.
- One staging user completes identity sync, miner registration, reward accrual, exchange request, approval, payout, and audit-log review.
