# ADR-001: Per-Circle Soroban Contract Deployment

**Date:** 2026-06-26  
**Status:** Accepted  
**Deciders:** Core team  

---

## Context

The Ajosave platform deploys a Soroban smart contract for every savings circle.
There was ambiguity in the codebase: the README and `env.example` documented a
single global `STELLAR_AJO_CONTRACT_ID`, while the implementation called
`deployAjoContract()` on each circle creation and stored the resulting contract
address in the `circles.contract_id` DB column.

This ADR formalises the per-circle model and explains the remaining use of
`STELLAR_AJO_CONTRACT_ID`.

---

## Decision

**Each circle gets its own deployed Soroban contract instance.**

### Why per-circle, not a single shared contract?

| Concern | Per-circle | Single shared contract |
|---------|-----------|------------------------|
| Isolation | Circle funds locked in its own contract — a bug in one circle cannot drain another | All funds in one contract; higher blast radius |
| Simplicity of contract logic | Contract only knows its own members; no member-namespacing needed | Requires member-keyed storage across all circles |
| Parallel execution | Soroban contracts can execute concurrently | Single contract is a serialisation bottleneck |
| Upgrade path | Upgrade individual contracts; old circles are unaffected | One upgrade touches every active circle simultaneously |
| Auditability | Stellar Explorer shows per-circle ledger history | History is interleaved across all circles |

The contract code is deployed once to the network as a WASM blob; each circle
call to `deployAjoContract()` creates a *new contract instance* from that same
WASM — cheap and consistent.

---

## Consequences

### `circles.contract_id` column

Every circle row in PostgreSQL has a `contract_id` column populated at circle
creation time (when the last member joins and the contract is initialised).
This is the authoritative address for all on-chain interactions with that circle.

### `STELLAR_AJO_CONTRACT_ID` — retained for two purposes only

1. **Event indexer** (`event-indexer.service.ts`): polls a single contract for
   platform-level event streaming. In production this should point to a
   monitoring/aggregator contract or be replaced with per-circle polling.
2. **Reputation fallback** (`reputation.ts`): used when no explicit `contractId`
   is passed to `getReputationFromContract()`.

This env var is **not** used during circle creation or payout. New deployments
that do not need a global fallback contract can leave it blank; the event
indexer will log a warning and skip.

### `env.example` annotation

`STELLAR_AJO_CONTRACT_ID` is now marked `[OPTIONAL]` with a comment explaining
its scope is the event indexer / reputation fallback, not per-circle lifecycle.

---

## Alternatives Considered

**Single shared contract with member tracking** — Rejected. Would require
namespacing all storage keys by circle ID, increasing ledger costs and contract
complexity. Does not buy meaningful gas savings given Soroban's per-entry fee
model.

---

## References

- `src/server/services/circle.service.ts` — `createCircle()` calls `deployAjoContract()`
- `src/lib/soroban.ts` — `deployAjoContract()` implementation
- `src/server/services/event-indexer.service.ts` — global contract ID usage
- Migration `1749200000000_add-contract-events.ts` — `contract_events` table
- `docs/schema.sql` — `circles.contract_id` column definition
