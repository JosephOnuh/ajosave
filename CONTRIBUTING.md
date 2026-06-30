# Contributing to Ajosave

Thank you for your interest in Ajosave! This guide covers everything you need to go from zero to a working local environment, run the full test suite (unit, integration, and E2E), deploy the smart contract to testnet, and open a pull request.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Running Tests](#running-tests)
  - [Unit & Integration Tests (Jest)](#unit--integration-tests-jest)
  - [Smart Contract Tests (Rust)](#smart-contract-tests-rust)
  - [End-to-End Tests (Playwright)](#end-to-end-tests-playwright)
  - [Visual Regression Tests](#visual-regression-tests)
- [Smart Contract Development](#smart-contract-development)
- [Code Style](#code-style)
- [Commit Convention](#commit-convention)
- [Branching Strategy](#branching-strategy)
- [Pull Request Process](#pull-request-process)
- [PR Checklist](#pr-checklist)
- [Reporting Issues](#reporting-issues)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Public Pages│  │  API Routes  │  │  Server Services │  │
│  │  /circles    │  │  /api/circles│  │  circle.service  │  │
│  │  /dashboard  │  │  /api/auth   │  │  payout.service  │  │
│  │  /auth/login │  │  /api/cron   │  │  scheduler       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Paystack (NGN)       PostgreSQL DB         Stellar Network
   (contributions)      (circle records)      (USDC + Soroban)
                                                    │
                                          ┌─────────────────┐
                                          │   Ajo Contract   │
                                          │  (Soroban/Rust)  │
                                          │  Auto-rotation   │
                                          │  Trustless payout│
                                          └─────────────────┘
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Vanilla CSS |
| Backend | Next.js Route Handlers, server services layer |
| Blockchain | Stellar, Soroban smart contracts (Rust) |
| Stablecoin | USDC on Stellar |
| Payments | Paystack (NGN on-ramp) |
| SMS/OTP | Termii |
| Database | PostgreSQL |
| Cache/Queue | Redis |

Key directories:

```
src/
├── app/api/          # Next.js Route Handlers (REST API)
├── server/
│   ├── services/     # Business logic (circle, payout, scheduler)
│   └── middleware/   # Auth, rate limiting, error handling
├── lib/              # Stellar SDK, Paystack, SMS, Auth helpers
└── types/            # TypeScript types + Zod schemas
contracts/
└── ajo/              # Soroban smart contract (Rust)
e2e/                  # Playwright end-to-end tests
```

---

## Prerequisites

Install all of the following before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | Bundled with Node |
| Rust (stable) | latest stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | latest | [Installation guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| PostgreSQL | ≥ 14 | [postgresql.org](https://www.postgresql.org/download/) |
| Redis | ≥ 7 | [redis.io](https://redis.io/docs/getting-started/) |
| Docker (optional) | latest | Replaces local PostgreSQL + Redis with `docker compose up -d` |

### Verify your environment

```bash
node --version    # should print v20.x or higher
npm --version     # should print 10.x or higher
rustc --version   # should print stable
stellar --version # should print the Stellar CLI version
```

---

## Local Setup

```bash
# 1. Clone the repo (or your fork)
git clone https://github.com/JosephOnuh/ajosave.git
cd ajosave

# 2. Install Node dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local — see the Environment Variables section below

# 4. Start PostgreSQL and Redis (skip if already running locally)
docker compose up -d

# 5. Run database migrations
npm run migrate

# 6. Start the development server
npm run dev
```

The app is now available at [http://localhost:3000](http://localhost:3000).

> **Contributing on a fork?** After cloning your fork, add the upstream remote so you can pull the latest changes:
> ```bash
> git remote add upstream https://github.com/JosephOnuh/ajosave.git
> git fetch upstream
> ```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. Variables marked **required** must be set for the app to start; the startup check (`src/server/startup.ts`) will throw if any required variable is missing.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | ✅ | Random string ≥ 32 chars — `openssl rand -base64 32` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `STELLAR_NETWORK` | ✅ | `testnet` or `mainnet` |
| `STELLAR_AJO_CONTRACT_ID` | ✅ | Deployed Soroban contract address (testnet value in `.env.example`) |
| `STELLAR_SERVER_SECRET_KEY` | ✅ | Stellar secret key for the platform wallet (**never commit**) |
| `PAYSTACK_SECRET_KEY` | ✅ | Paystack secret key — [dashboard](https://dashboard.paystack.com/#/settings/developer) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | ✅ | Paystack public key — same location |
| `TERMII_API_KEY` | ✅ | Termii API key for SMS OTP — [dashboard](https://termii.com/dashboard) |
| `CRON_SECRET` | ✅ | Secret for the `/api/cron/cycle` endpoint — `openssl rand -hex 32` |
| `SENTRY_DSN` | optional | Sentry error tracking DSN |
| `SLACK_WEBHOOK_URL` | optional | Slack alerts webhook |

For local development use Stellar testnet and Paystack test keys — no real funds are involved.

See `.env.example` for the full list with per-variable explanations and links to provider dashboards.

---

## Running the App

```bash
npm run dev          # Development server with hot reload (http://localhost:3000)
npm run build        # Production build
npm run start        # Serve the production build
npm run lint         # ESLint + SQL audit check
npm run lint:fix     # ESLint with auto-fix
npm run type-check   # TypeScript type check (no emit)
npm run format       # Prettier — format all files
npm run format:check # Prettier — check formatting without writing
```

---

## Running Tests

### Unit & Integration Tests (Jest)

The project uses **Jest** with two project configs — `unit` and `integration` — defined in `jest.config.js`.

```bash
npm test                  # Run all tests (unit + integration)
npm run test:watch        # Watch mode — re-runs on file changes
npm run test:coverage     # Coverage report (threshold: 70% lines/functions/branches)
```

Test files live alongside the source they test:

```
src/server/services/__tests__/payout.service.test.ts
src/server/middleware/__tests__/rateLimit.test.ts
src/__tests__/integration/api-route-integration.test.ts
```

- **Unit tests** run in `jest-environment-jsdom` and cover services, middleware, and lib utilities.
- **Integration tests** run in `jest-environment-node` and exercise real database queries via a test DB (`src/__tests__/integration/test-db.ts`).

> Integration tests require a running PostgreSQL instance. Set `DATABASE_URL` in your `.env.local` before running.

### Smart Contract Tests (Rust)

```bash
npm run contract:test
# equivalent to:
cd contracts && cargo test
```

Contract tests live in `contracts/ajo/src/lib.rs` under `#[cfg(test)]`. These run entirely in the Stellar Soroban test environment — no network connection needed.

### End-to-End Tests (Playwright)

E2E tests use **Playwright** and require a running application. Run them after starting `npm run dev` (or against a production build with `npm run start`):

```bash
# 1. Install browser binaries (first time only)
npx playwright install --with-deps chromium

# 2. Start the app in another terminal
npm run dev

# 3. Run E2E tests
npm run test:e2e

# Interactive UI mode — step through tests visually
npm run test:e2e:ui
```

E2E test files are in `e2e/`:

```
e2e/
├── login.spec.ts
├── join-circle.spec.ts
├── create-circle.spec.ts
├── contribute.spec.ts
└── helpers/
    └── auth.ts          # shared login helper
```

To run a single test file:

```bash
npx playwright test e2e/login.spec.ts
```

To run tests against a different base URL (e.g., a staging environment):

```bash
PLAYWRIGHT_BASE_URL=https://staging.ajosave.app npm run test:e2e
```

### Visual Regression Tests

Visual snapshot tests live in `e2e/visual/` and are run as separate Playwright projects (`visual-desktop` and `visual-mobile`):

```bash
# Run visual tests
npx playwright test --project=visual-desktop
npx playwright test --project=visual-mobile

# Update baselines after intentional visual changes
npx playwright test --project=visual-desktop --update-snapshots
```

Snapshot baselines are stored in `e2e/visual/__snapshots__/`. Commit updated baselines alongside your UI changes.

---

## Smart Contract Development

The Ajo contract lives in `contracts/ajo/`. See [`contracts/ajo/README.md`](contracts/ajo/README.md) for the full technical reference (lifecycle, storage layout, events, security model).

### Prerequisites for contract work

Make sure Rust and the wasm32 target are installed:

```bash
rustup target add wasm32-unknown-unknown
# Install the Stellar CLI if not already done
cargo install --locked stellar-cli --features opt
```

### Build

```bash
npm run contract:build
# Outputs: contracts/target/wasm32-unknown-unknown/release/ajo.wasm
```

### Test

```bash
npm run contract:test
```

### Deploy to testnet

```bash
# Ensure STELLAR_SERVER_SECRET_KEY is set in your environment
STELLAR_NETWORK=testnet npm run contract:deploy
```

The deploy script (`scripts/deploy-contract.ts`) uploads the WASM, deploys the contract, and prints the new contract ID. Update `STELLAR_AJO_CONTRACT_ID` in your `.env.local`.

### Generate TypeScript bindings

After deploying a new contract version, regenerate the client bindings:

```bash
STELLAR_AJO_CONTRACT_ID=<new-contract-id> npm run contract:bindings
```

Bindings are output to `contracts/ajo/bindings/`.

### Testnet contract

| Field | Value |
|-------|-------|
| Network | Stellar Testnet |
| Contract ID | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Explorer | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

CI automatically re-deploys the contract to testnet on every merge to `main`.

### Per-circle deployment model

Each savings circle deploys its own Soroban contract instance when the last member joins. `STELLAR_AJO_CONTRACT_ID` in `.env.local` is used only by the event indexer and reputation fallback — it is **not** used for circle creation or payouts. See [docs/adr/001-per-circle-contract-deployment.md](docs/adr/001-per-circle-contract-deployment.md) for the architecture decision record.

---

## Code Style

### TypeScript

Strict mode is enabled (`"strict": true` in `tsconfig.json`). All code must type-check cleanly:

```bash
npm run type-check
```

### ESLint

Rules are defined in `.eslintrc.json` (extends `next/core-web-vitals` and `prettier`):

- `no-unused-vars` is set to `error` — prefix unused variables and parameters with `_` to suppress it.
- `no-console` is `off` — structured logging via `pino` is preferred in server code.

```bash
npm run lint       # Check for ESLint errors (also runs the SQL audit script)
npm run lint:fix   # Auto-fix fixable issues
```

### Prettier

Formatting is enforced by Prettier with the following settings (`.prettierrc`):

| Option | Value |
|--------|-------|
| `semi` | `true` |
| `singleQuote` | `false` (double quotes) |
| `trailingComma` | `"es5"` |
| `printWidth` | `100` |
| `tabWidth` | `2` |

```bash
npm run format        # Format all files
npm run format:check  # Verify formatting without writing
```

Prettier and ESLint both run automatically on staged files via `lint-staged` when you commit (configured in `package.json`).

### CSS

Vanilla CSS only (see `src/styles/`). Do not introduce CSS-in-JS libraries (styled-components, Emotion, etc.).

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer: Closes #<issue>]
```

**Common types:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`.

**Examples:**

```
feat(circle): add member kick functionality
fix(contract): prevent payout before all contributions received
docs: add E2E testing instructions to CONTRIBUTING.md
test(middleware): add rate limit edge case tests
chore: upgrade next.js to 14.3
```

---

## Branching Strategy

Branch names follow `<prefix>/<short-description>`, where the prefix signals intent:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/circle-invite-link` |
| `fix/` | Bug fixes | `fix/payout-double-trigger` |
| `docs/` | Documentation only | `docs/contributing-guide` |
| `test/` | Adding or updating tests | `test/payout-service-coverage` |
| `chore/` | Maintenance, deps, config | `chore/upgrade-nextjs-15` |
| `hotfix/` | Urgent production fixes | `hotfix/contract-overflow` |

Always branch from `develop` (or `main` for hotfixes):

```bash
git checkout develop && git pull
git checkout -b feature/your-feature-name
```

---

## Pull Request Process

1. **Branch from `develop`** (see Branching Strategy above).

2. **Make your changes** with tests where applicable.

3. **Verify locally before pushing:**
   ```bash
   npm run type-check          # TypeScript
   npm run lint                # ESLint + SQL audit
   npm test                    # Unit + integration tests
   npm run test:e2e            # E2E tests (requires npm run dev in another terminal)
   npm run contract:test       # Contract tests (only if you touched contracts/)
   ```

4. **Open a PR against `develop`** (or `main` for hotfixes) in the upstream repo and fill in the PR template.

5. PRs require **one approval** to merge. Security-sensitive contract changes require **two approvals**.

6. **Link the issue** in your PR description: `Closes #<issue-number>`.

7. **Keep your branch up to date** by rebasing on `develop` before requesting review:
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

---

## PR Checklist

Before marking your PR ready for review, confirm all of the following:

- [ ] Tests added or updated for changed behaviour
- [ ] `npm run type-check` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes with no failures
- [ ] `npm run test:e2e` passes (if you changed UI or API routes)
- [ ] `npm run contract:test` passes (if you changed `contracts/`)
- [ ] `.env.example` updated if a new environment variable was introduced
- [ ] Issue number linked in the PR description (`Closes #<issue>`)
- [ ] PR title follows Conventional Commits format

---

## Reporting Issues

- **Bugs** → [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md)
- **Features** → [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md)
- **Security vulnerabilities** → **security@ajosave.app** only (do not open a public issue)
