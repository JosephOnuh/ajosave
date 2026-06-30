# Soroban Contract Upgrade Procedure

This document describes how to safely upgrade the Ajo Soroban contract in production. It covers the full lifecycle: when to upgrade, how to coordinate with active circles, the storage migration procedure, testnet-to-mainnet promotion, and rollback if something goes wrong.

---

## Overview

The Ajo contract supports in-place WASM upgrades via `upgrade()` and coordinated storage migrations via `migrate()`. Every upgrade follows a two-step process:

1. **`upgrade(new_wasm_hash)`** — replaces the contract bytecode on-chain.
2. **`migrate()`** — applies any storage layout changes introduced by the new WASM.

`STORAGE_VERSION` in `contracts/ajo/src/lib.rs` is the authoritative version counter. Any time the `DataKey` enum or the structure of stored values changes, you must bump this constant and add a migration block inside `migrate()`.

---

## When Is an Upgrade Needed?

Trigger an upgrade when any of the following are true:

| Situation | Requires `migrate()` call? |
|-----------|---------------------------|
| Bug fix with no storage changes | No |
| New contract function, no new storage keys | No |
| New `DataKey` variant added | Yes |
| Existing stored value format changed | Yes |
| Storage tier changed (e.g. instance → persistent) | Yes |
| `STORAGE_VERSION` bumped in source | Yes |

When in doubt, always call `migrate()` after an upgrade — it is a no-op if `StorageVersion` is already at the current value.

---

## Impact on Active Circles

> **Critical:** Active circles continue to hold member funds. Upgrades must be coordinated carefully to avoid disrupting in-flight payouts.

- `upgrade()` replaces the contract code atomically but does **not** touch existing storage. Members' contribution records, payout order, balances, and cycle state are all preserved.
- `migrate()` only writes to storage keys that need updating (e.g. initialising `PayoutLock` on v0 contracts). It does not modify member funds or cycle progress.
- During the upgrade window the contract may transiently panic if a call arrives between `upgrade()` and `migrate()` when the new code reads a storage key that the old state does not yet have. **Pause the contract before upgrading to prevent this.**

---

## Step-by-Step Upgrade Procedure

### 1. Prepare the new WASM

```bash
# Build the new contract WASM
npm run contract:build

# The output is at:
# contracts/ajo/target/wasm32-unknown-unknown/release/ajo.wasm
```

### 2. Run the full test suite

```bash
npm run contract:test
npm test
```

All tests must pass before promoting to any network.

### 3. Deploy and validate on testnet first

See [Testnet → Mainnet Promotion](#testnet--mainnet-promotion) below. Never skip this step.

### 4. Pause the contract on the target network

Pausing halts `contribute` and `payout`, preventing any calls from arriving during the upgrade window.

```bash
# Using Stellar CLI
stellar contract invoke \
  --id $CONTRACT_ID \
  --network $STELLAR_NETWORK \
  --source $ADMIN_SECRET \
  -- pause
```

Notify circle members (via your front end or out-of-band) that a brief maintenance window is in progress.

### 5. Upload the new WASM and get its hash

```bash
stellar contract upload \
  --wasm contracts/ajo/target/wasm32-unknown-unknown/release/ajo.wasm \
  --source $ADMIN_SECRET \
  --network $STELLAR_NETWORK
```

The command prints a 32-byte WASM hash. Save it:

```
NEW_WASM_HASH=<hex-value-from-output>
```

### 6. Call `upgrade`

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --network $STELLAR_NETWORK \
  --source $ADMIN_SECRET \
  -- upgrade \
  --new_wasm_hash $NEW_WASM_HASH
```

An `upgraded` event is emitted on success.

### 7. Call `migrate`

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --network $STELLAR_NETWORK \
  --source $ADMIN_SECRET \
  -- migrate
```

A `migrated` event is emitted with `(from_version, to_version)`. If the contract was already at the latest version, `migrate` returns silently without emitting an event.

### 8. Verify post-upgrade state

```bash
# Read circle state — should match pre-upgrade values
stellar contract invoke \
  --id $CONTRACT_ID \
  --network $STELLAR_NETWORK \
  --source $ADMIN_SECRET \
  -- get_state

# Confirm StorageVersion is now at the new value
# (inspect raw storage if needed via Stellar Expert or horizon events)
```

Check that:
- `current_cycle` is unchanged
- `completed` and `paused` flags are correct
- Member list is intact

### 9. Unpause the contract

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --network $STELLAR_NETWORK \
  --source $ADMIN_SECRET \
  -- unpause
```

An `unpaused` event is emitted. Normal operations resume.

---

## Bumping the Storage Version

When you add or change stored data, follow these steps in `contracts/ajo/src/lib.rs`:

1. **Increment `STORAGE_VERSION`:**
   ```rust
   const STORAGE_VERSION: u32 = 2; // was 1
   ```

2. **Add a migration block in `migrate()`:**
   ```rust
   // ── v1 → v2 ──────────────────────────────────────────────────────────
   // Example: initialize a new NewFeatureFlag key
   if from < 2 {
       if !env.storage().instance().has(&DataKey::NewFeatureFlag) {
           env.storage().instance().set(&DataKey::NewFeatureFlag, &false);
       }
   }
   ```

3. **Update tests** to exercise the new migration path (see `contracts/ajo/src/integration_tests.rs` for patterns).

### Current version history

| Version | What changed | Migration action |
|---------|-------------|-----------------|
| 0 | Initial deployment | — |
| 1 | Added `PayoutLock` reentrancy guard | Initialises `PayoutLock = false` if absent |

---

## Testnet → Mainnet Promotion

Always promote through testnet before touching mainnet.

### Testnet validation checklist

- [ ] Build new WASM: `npm run contract:build`
- [ ] All Rust unit + integration tests pass: `npm run contract:test`
- [ ] Deploy to testnet: `STELLAR_NETWORK=testnet npm run contract:deploy`
- [ ] Upload new WASM on testnet and record hash
- [ ] Pause testnet contract
- [ ] Call `upgrade` on testnet
- [ ] Call `migrate` on testnet — confirm `migrated` event with correct versions
- [ ] Call `get_state` — confirm circle state is intact
- [ ] Exercise at least one `contribute` and one `payout` on testnet
- [ ] Unpause testnet contract
- [ ] Monitor testnet for 24 hours; check for unexpected errors

### Mainnet deployment

Only after all testnet checks pass:

- [ ] Schedule a low-traffic maintenance window
- [ ] Announce maintenance to circle members
- [ ] Complete steps 4–9 above on mainnet
- [ ] Verify on [Stellar Expert](https://stellar.expert) that the `upgraded` and `migrated` events appear in the transaction history
- [ ] Smoke-test one full contribute + payout cycle
- [ ] Update `STELLAR_AJO_CONTRACT_ID` in deployment configuration if a new contract was deployed (for event indexer / reputation fallback)

---

## Rollback Procedure

Soroban contract upgrades are **not automatically reversible** — once `upgrade()` is called, the on-chain WASM is replaced. To roll back:

### Option A: Re-upload the previous WASM

1. Retrieve the previous WASM file from your release archive or build it from the previous Git tag.
2. Upload it:
   ```bash
   stellar contract upload \
     --wasm path/to/previous/ajo.wasm \
     --source $ADMIN_SECRET \
     --network $STELLAR_NETWORK
   ```
3. Call `upgrade` with the old WASM hash.
4. If the old code does not understand the storage keys written by the new `migrate()` call, you may need to write a compensating migration. **This is why testnet validation is mandatory.**

### Option B: Keep the contract paused

If the new WASM is broken and you cannot safely roll back storage:

1. Leave the contract paused (`pause` was called before upgrading).
2. Deploy a new contract instance from scratch.
3. Migrate members off the broken circle manually (requires admin intervention and communication with members).

### Prevention

- Always pause before upgrading.
- Always test on testnet first.
- Keep a build artifact of every deployed WASM alongside its hash in your release notes.
- Tag every release in Git: `git tag -a contract/v<N> -m "STORAGE_VERSION=<N>"`.

---

## References

- `contracts/ajo/src/lib.rs` — `upgrade()`, `migrate()`, `STORAGE_VERSION`, `DataKey`
- [`docs/multisig-admin.md`](./multisig-admin.md) — admin key management and multisig setup
- [`docs/migrations.md`](./migrations.md) — database (PostgreSQL) migration procedure
- [`docs/DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — full application deployment guide
- [Soroban contract upgrade docs](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/upgradeable-contract)
