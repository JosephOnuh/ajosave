# Architecture Decision Records

This directory records significant architectural decisions made in the Ajosave project. Each ADR describes the context, the decision taken, and the consequences.

## Records

| # | Title | Status |
|---|-------|--------|
| [0001](0001-stellar-over-evm.md) | Use Stellar/Soroban Instead of an EVM Chain | Accepted |
| [0002](0002-paystack-ngn-onramp.md) | Paystack as the NGN On-Ramp | Accepted |
| [0003](0003-nextjs-fullstack.md) | Next.js as the Full-Stack Framework | Accepted |
| [0004](0004-postgresql-primary-database.md) | PostgreSQL as the Primary Database | Accepted |
| [0005](0005-phone-otp-authentication.md) | Phone Number + OTP as the Authentication Method | Accepted |

## Adding a New ADR

1. Copy [template.md](template.md) to `XXXX-short-title.md` (next sequential number).
2. Fill in the date, status, context, decision, and consequences.
3. Add a row to the table above.
4. Open a PR for review.
