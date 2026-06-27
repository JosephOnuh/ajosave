# Payout Randomization

Ajosave supports two payout-order modes for savings circles: **join order** (deterministic) and **randomized** (Fisher-Yates shuffle). This document explains how randomization works, its trust model, how members can verify their assigned position, and the known limitations of the current approach.

---

## Algorithm

When a circle fills and `payout_method = "randomized"`, the backend generates a random seed and uses it to shuffle member positions via a **seeded Fisher-Yates** algorithm.

### Pseudocode

```
seed = timestamp_ms + "-" + crypto.randomBytes(16).hex()

positions = [1, 2, ..., N]         // N = max_members

rng = seededRandom(seed)            // deterministic LCG seeded from seed

for i from N-1 down to 1:
    j = floor(rng() * (i + 1))     // 0 ≤ j ≤ i
    swap(positions[i], positions[j])

// positions is now the shuffled payout order
// positions[0] = member index of cycle-1 recipient
// positions[k] = member index of cycle-(k+1) recipient
```

The seed is stored in `circles.randomization_seed` (PostgreSQL) and the resulting `positions` array is written to `members.position` (one row per member) and pushed to the Soroban contract via `set_payout_order()`.

### Where randomization happens

| Layer | Role |
|-------|------|
| Backend (`circle.service.ts`) | Generates seed, shuffles, assigns `position` in DB, calls `set_payout_order` on contract |
| Soroban contract | Stores the order on-chain; `payout()` reads it to determine the recipient each cycle |

---

## Randomness Source

The seed is derived from two components:

1. **`Date.now()`** — millisecond-precision wall clock at the moment the circle fills.
2. **`crypto.randomBytes(16)`** — 128 bits of OS-level CSPRNG entropy (Node.js `crypto` module, backed by `/dev/urandom` or equivalent).

The combined seed is a string: `"<ms_timestamp>-<32-hex-chars>"`.

This provides sufficient entropy for the purposes of a fair shuffle; a single compromised component (e.g. a predictable clock) cannot alone determine the outcome because of the CSPRNG component.

---

## Verifiability

Any member can independently verify their assigned payout position:

1. **Read the seed** — `circles.randomization_seed` is exposed via `GET /api/circles/:id` in the API response.
2. **Read the on-chain order** — Call `get_payout_order()` on the Soroban contract; it returns the stored `Vec<u32>`.
3. **Re-run the shuffle** — Apply the Fisher-Yates algorithm with the same seed and `seededRandom` function (LCG below) to reproduce the order deterministically.
4. **Compare** — The reproduced order must match the on-chain value.

### Reference implementation (TypeScript)

```ts
function seededRandom(seed: string): () => number {
  let h = 0;
  for (const c of seed) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return function () {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    return (h >>> 0) / 0x100000000;
  };
}

function reproducePayout(seed: string, memberCount: number): number[] {
  const positions = Array.from({ length: memberCount }, (_, i) => i);
  const rng = seededRandom(seed);
  for (let i = memberCount - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions; // positions[k] = member index for cycle k+1
}
```

---

## Known Limitations

### LCG PRNG quality

The seeded RNG is a **Linear Congruential Generator (LCG)** with a 32-bit state:

```
h = (1664525 × h + 1013904223) mod 2³²
```

LCGs have well-known weaknesses:

- **Short period** — 2³² ≈ 4 billion states. Not an issue for N ≤ 20 members, but worth noting.
- **Predictable from output** — Given one output, the next can be computed. An adversary who can observe the shuffle could in theory infer the seed, though the seed itself is already public.
- **Not cryptographically secure** — The LCG is unsuitable for security-critical applications. For a savings circle, the shuffle is a convenience feature (fairness) rather than a security primitive; the on-chain enforcement of the committed order is what provides the trust guarantee.

### Planned improvement

A future upgrade will replace the LCG with **on-chain randomness via Soroban's `env.prng()` API** (available in Soroban SDK ≥ 0.9). This moves the shuffle entirely on-chain:

- The seed becomes a Soroban-native random value, not injectable by the backend.
- The shuffle is reproducible by any party with access to the ledger.
- No off-chain trust required for position assignment.

Until that upgrade ships, the trust model is: **the backend picks the order fairly (verifiable via seed + LCG), and the Soroban contract enforces it immutably**.

---

## Trust Model Summary

| Property | Current | Planned (on-chain PRNG) |
|----------|---------|--------------------------|
| Seed generation | Backend (CSPRNG + clock) | Soroban `env.prng()` |
| Order commitment | On-chain (`set_payout_order`) | On-chain (computed in-contract) |
| Verifiability | Re-run LCG with published seed | Read ledger state |
| Trust assumption | Backend generates seed honestly | None (fully trustless) |

---

*See also: [Soroban contract README](../contracts/ajo/README.md) · [payout-db-refactoring](payout-db-refactoring.md)*
