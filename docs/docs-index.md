# Coin Planet Docs Index

This index points to the current project documentation.

## Core Docs

- [Token and Reward Model](./token-model.md)
- [Implementation Guide](./implementation-guide.md)
- [System Integration Roadmap](./system-integration-roadmap.md)
- [Requirements Gap Analysis](./requirements-gap-analysis.zh-en.md)
- [Admin System Design](./admin-system-design.md)
- [Development Timeline and Costs](./development-timeline-and-costs.md)
- [Investment Quick Reference](./investment-quickref.md)
- [SUPER Token Mechanism Analysis](./SUPER-token-mechanism-analysis.md)

## Current Architecture Snapshot

- Web app: `src/`
- Mobile app: `app-client/`
- Backend Worker: `backend/`
- Contracts: `contracts/`
- Database schema: `backend/db/schema.sql`
- Exchange naming patch: `backend/db/patch-exchange-naming.sql`

## Current Contract Set

- `SUPER`
- `USDT_Mock` for tests/demo
- `MiningPool`

Exchange settlement is implemented in backend operations tables and APIs rather than a dedicated on-chain exchange contract.

## Useful Commands

```bash
npm run test:deprecated-swaprouter
npm run lint
npm run build
npm --prefix backend run typecheck
npm --prefix backend test -- --run
npm --prefix contracts test
```

Mobile type-check:

```bash
cd app-client
npx tsc --noEmit
```

## Release Reading Order

1. Read [Implementation Guide](./implementation-guide.md).
2. Confirm [Token and Reward Model](./token-model.md).
3. Follow [System Integration Roadmap](./system-integration-roadmap.md).
4. Review [Requirements Gap Analysis](./requirements-gap-analysis.zh-en.md).
5. Run the verification commands above.
