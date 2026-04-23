# Ajosave

> **Trustless rotating savings circles (Ajo/Esusu) on the Stellar blockchain.**  
> The traditional West African savings group — now with smart contracts, no middleman, automatic payouts.

[![CI](https://github.com/JosephOnuh/ajosave/actions/workflows/ci.yml/badge.svg)](https://github.com/JosephOnuh/ajosave/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built on Stellar](https://img.shields.io/badge/Built%20on-Stellar-blue)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-blueviolet)](https://developers.stellar.org/docs/build/smart-contracts)

---

## What is Ajosave?

Ajo (also called Esusu or Susu) is a traditional rotating savings group practiced across West Africa and the diaspora. A group of people each contribute a fixed amount every cycle, and one member takes the full pot each round until everyone has received their payout.

Today this runs entirely on trust — no contracts, no guarantees, frequent fraud. **Ajosave puts it on-chain.**

**Who is it for?**
- Nigerians and West Africans running savings circles domestically and in the diaspora
- Anyone who wants a disciplined, community-based savings mechanism with zero counterparty risk

---

## Architecture

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

### Tech Stack

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

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── circles/                  # Browse + create circles
│   ├── dashboard/                # User's circles
│   ├── auth/login/               # Phone OTP login
│   └── api/
│       ├── circles/              # Circle CRUD + join
│       ├── auth/                 # OTP + NextAuth
│       └── cron/cycle/           # Payout scheduler
├── server/
│   ├── services/                 # circle, payout, scheduler
│   ├── middleware/               # Auth, rate limiting
│   └── config/
├── components/
│   ├── ui/                       # Button, Input, Badge
│   ├── circle/                   # CircleCard, CreateCircleForm
│   └── layout/                   # Navbar
├── lib/                          # Stellar SDK, Paystack, SMS, Auth
├── types/                        # TypeScript types + Zod schemas
└── styles/                       # Vanilla CSS design system
contracts/
└── ajo/                          # Soroban Ajo contract (Rust)
scripts/
└── deploy-contract.ts
```

---

## Smart Contract

The Ajo contract (`contracts/ajo/`) handles the full circle lifecycle:

| Function | Description |
|----------|-------------|
| `initialize` | Set up circle params (members, amount, frequency) |
| `join` | Member joins and locks first contribution |
| `contribute` | Member pays for current cycle |
| `payout` | Admin triggers rotation payout after cycle time |
| `get_state` | Read current cycle, next payout time, completion |
| `get_members` | List all member addresses |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20, npm ≥ 10
- Rust + `wasm32-unknown-unknown` (for contract work)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)

### Installation

```bash
git clone https://github.com/JosephOnuh/ajosave.git
cd ajosave
npm install
cp .env.example .env.local
# Fill in environment variables
npm run dev
```

### Smart Contract

```bash
npm run contract:build   # Build WASM
npm run contract:test    # Run Rust tests
STELLAR_NETWORK=testnet npm run contract:deploy
```

#### Testnet Deployment

The Ajo contract is deployed on **Stellar Testnet**:

| Field | Value |
|-------|-------|
| Network | Stellar Testnet |
| Contract ID | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Explorer | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

Set in your environment:
```
STELLAR_AJO_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

> CI automatically re-deploys the contract to testnet on every merge to `main` via the `deploy-contract-testnet` job.

---

## Benefits to the Stellar Ecosystem

- **Real-World DeFi** — Brings a financial primitive used by millions of Africans on-chain for the first time
- **Soroban Smart Contracts** — Full circle lifecycle managed trustlessly: join, contribute, rotate, payout
- **USDC Stability** — Contributions hold value across the full cycle duration
- **Low Fees** — Stellar's near-zero fees make micro-contributions viable
- **Financial Inclusion** — NGN on-ramp via Paystack bridges local finance to global stablecoin liquidity
- **On-Chain Reputation** — Contribution history builds a verifiable credit score on Stellar

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

- Bugs → [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
- Features → [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)
- Security → **security@ajosave.app**

---

## License

[MIT](LICENSE) © 2024 Ajosave
