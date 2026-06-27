# ADR-0002: Paystack as the NGN On-Ramp

**Date:** 2024-01-01  
**Status:** Accepted

## Context

Target users contribute in Nigerian Naira (NGN). The product must convert NGN payments into USDC on Stellar seamlessly. Options considered:

- **Paystack** — dominant Nigerian payment processor, well-documented API, supports card and bank transfer in NGN.
- **Flutterwave** — broader pan-African reach but more complex integration and higher fee tiers for NGN.
- **Manual crypto on-ramp** — requires users to self-custody USDC before joining, creating too high a barrier for the target demographic.

## Decision

Use Paystack to accept NGN contributions. On a successful Paystack webhook, the backend converts the NGN amount to USDC at the prevailing rate and executes the Soroban `contribute` call on behalf of the user.

## Consequences

- **Positive:** Familiar checkout flow for Nigerian users (card, bank transfer, USSD); proven reliability; straightforward webhook-based payment confirmation.
- **Negative:** Introduces a custodial step between NGN receipt and USDC on-chain; Paystack is Nigeria-focused so diaspora users need a separate on-ramp path; FX rate risk between webhook receipt and USDC purchase.
