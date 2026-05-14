# Investment Quick Reference

This quick reference reflects the current operating model.

## Product Snapshot

Coin Planet combines:

- mobile mining client
- wallet identity
- SUPER rewards
- backend reward ledger
- backend exchange orders
- operations-led USDT payouts
- admin/owner audit controls
- BSC contract settlement for mining and token actions

## Current Technical Assets

- Web app: Vite + React.
- Mobile app: Expo + React Native.
- Backend: Cloudflare Workers + D1.
- Contracts: `SUPER`, `USDT_Mock`, `MiningPool`.
- Deployment scripts: Hardhat and Wrangler.
- Verification scripts: TypeScript, backend tests, contract tests, deprecated reference guard.

## Revenue / Operations Levers

Potential business levers:

- hardware/service package sales
- monthly-card or contract-term renewals
- managed exchange spread or service fee
- premium operations support
- enterprise or channel partnerships

These are product and finance assumptions, not guaranteed returns.

## Key Operating Risks

- Exchange price misconfiguration.
- Payout wallet operational risk.
- Reward accrual anomalies.
- Contract address mismatch across Web, backend, and mobile.
- App release-channel drift.
- User support load during onboarding.

## Go-Live Checklist

- Contracts confirmed on the intended BSC network.
- D1 schema and exchange naming patch applied.
- Owner/admin wallets configured.
- Exchange price configured.
- Payout wallets configured.
- Android/iOS download channels verified.
- Staging end-to-end flow completed.
- Monitoring and support contacts enabled.

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
