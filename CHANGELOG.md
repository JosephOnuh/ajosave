# Changelog

All notable changes to Ajosave are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **Smile Identity API key log sanitization** (Issue #547): `api_key` is now stripped from all application logs. Added `redactLogObject` utility in `sanitize.ts` that replaces sensitive keys (`api_key`, `apiKey`, `password`, `secret`, `token`) with `[REDACTED]` before logging. `kyc.ts` uses this on any failed token request log entry.

### Key Rotation Procedure

To rotate the Smile Identity API key:
1. Generate a new key in the [Smile Identity portal](https://portal.smileidentity.com) → Settings → API Keys.
2. Update the `SMILE_API_KEY` environment variable in your secrets manager (AWS Secrets Manager, Vercel environment variables, etc.).
3. Restart the application. The key is read from `process.env` at call time — no code changes needed.
4. Revoke the old key in the Smile Identity portal once traffic confirms the new key is working.

## [0.1.0] - 2026-04-24

### Added

- Soroban smart contract (`contracts/ajo/`) implementing the full Ajo circle lifecycle: `initialize`, `join`, `contribute`, `payout`, `upgrade`
- On-chain events for all state transitions: `initialized`, `started`, `joined`, `contributed`, `payout`, `completed`, `defaulted`, `upgraded`
- OTP phone authentication via Termii SMS and NextAuth session management
- JWT session expiry and secure cookie handling
- Circle creation, browse, and join flows (Next.js 14 App Router)
- Dashboard for tracking a user's active circles and contribution history
- Paystack NGN on-ramp for fiat contributions
- PostgreSQL persistence for circle records and payout state
- Redis-backed rate limiting and caching
- Soroban payout integration — server-side signing and submission to Stellar network
- Docker and docker-compose configuration for local development
- Vercel deployment configuration (`vercel.json`)
- CI pipeline (GitHub Actions): lint, type-check, Prettier format check, unit tests with Codecov, Next.js build, Soroban contract tests, and automatic testnet contract deployment on merge to `main`
- Automated PostgreSQL backup workflow
- Branch protection and PR validation checks via GitHub Actions
- HTTPS/HSTS and Content Security Policy (CSP) response headers
- SQL injection prevention via parameterised queries
- Sentry APM integration for client, server, and edge runtimes
- Health check endpoint (`/api/health`)
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`

### Infrastructure

- Stellar Testnet contract deployment: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

[Unreleased]: https://github.com/JosephOnuh/ajosave/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JosephOnuh/ajosave/releases/tag/v0.1.0
