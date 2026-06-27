# ADR-0001: Use Stellar/Soroban Instead of an EVM Chain

**Date:** 2024-01-01  
**Status:** Accepted

## Context

Ajosave targets West African users making micro-contributions (small NGN amounts). EVM chains (Ethereum, Polygon) carry gas fees that can be a significant percentage of a small contribution, and onboarding requires users to hold a native gas token in addition to their stablecoin. We needed a chain where:

- Transaction fees are near-zero (viable for micro-contributions)
- USDC is natively supported
- Smart contract infrastructure is production-ready

## Decision

Build on the Stellar network using Soroban smart contracts. Stellar's fee structure charges fractions of a cent per operation, USDC (Circle) is a first-class asset on the network, and Soroban provides a Rust-based smart contract environment that is auditable and deterministic.

## Consequences

- **Positive:** Near-zero fees make every contribution size economically viable; native USDC eliminates wrapping complexity; Stellar's built-in account model simplifies key management.
- **Negative:** Soroban is a newer ecosystem with a smaller developer tooling surface than EVM; fewer third-party integrations and auditing firms have Soroban experience; developer hiring pool is smaller.
