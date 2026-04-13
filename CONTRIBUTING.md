# Contributing to Ajosave

Thank you for your interest! Ajosave is open-source and we welcome all contributions.

## Setup

```bash
git clone https://github.com/JosephOnuh/ajosave.git
cd ajosave
npm install
cp .env.example .env.local
npm run dev
```

## Commands

```bash
npm run dev           # Dev server
npm run lint          # ESLint
npm run type-check    # TypeScript
npm test              # Jest
npm run contract:build  # Build Soroban WASM
npm run contract:test   # Rust tests
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(circle): add member kick functionality
fix(contract): prevent payout before all contributions received
docs: update README
```

## Pull Requests

1. Branch from `develop`: `git checkout -b feat/your-feature`
2. Make changes with tests where applicable
3. Open PR against `develop`
4. Fill in the PR template — requires one approval

## Smart Contract

Contract lives in `contracts/ajo/`. Write tests in `src/lib.rs`. Run `npm run contract:test` before submitting.

Security-sensitive contract changes require two approvals.

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md).  
Security issues → **security@ajosave.app** only.
