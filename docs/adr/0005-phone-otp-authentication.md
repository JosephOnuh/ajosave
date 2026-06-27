# ADR-0005: Phone Number + OTP as the Authentication Method

**Date:** 2024-01-01  
**Status:** Accepted

## Context

The target users are West African savers, many of whom do not use email regularly but almost universally have a mobile phone number. Authentication options considered:

- **Email + password** — familiar for tech-savvy users but high friction and password reset complexity for the primary demographic.
- **Social OAuth (Google, Facebook)** — requires a Google/Facebook account and reliable internet for OAuth flow; not universal in the target market.
- **Phone OTP via SMS** — matches how Nigerian fintech apps (e.g., Opay, PalmPay) authenticate users; no password to forget; Termii provides reliable SMS delivery in Nigeria.
- **Wallet-based (Freighter, LOBSTR)** — trustless but requires users to understand Stellar wallets; too high a barrier for non-crypto-native users.

## Decision

Use phone number + SMS OTP as the primary authentication method, delivered via Termii and managed through NextAuth with a custom credentials provider.

## Consequences

- **Positive:** Low barrier to entry for the target demographic; no passwords to manage; phone number doubles as the unique user identifier used in circle invitations.
- **Negative:** SMS delivery is not 100% reliable (especially internationally for diaspora users); Termii dependency introduces a potential single point of failure; phone numbers can be recycled by carriers, requiring care around account recovery.
