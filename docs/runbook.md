# Production Operations Runbook

This runbook covers day-to-day and emergency operations for Ajosave in production: initial deploy, rolling deploy, rollback, migrations, secret rotation, incident response, and database backup/restore. Read it end to end before your first production deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Production Deployment](#initial-production-deployment)
3. [Rolling Deploy (Routine Update)](#rolling-deploy-routine-update)
4. [Database Migrations](#database-migrations)
5. [Emergency Rollback](#emergency-rollback)
6. [Secret Rotation](#secret-rotation)
7. [Incident Response Checklist](#incident-response-checklist)
8. [Database Backup and Restore](#database-backup-and-restore)
9. [Contacts and Escalation](#contacts-and-escalation)

---

## Prerequisites

You need the following before operating Ajosave in production:

| Tool | Purpose | Install |
|------|---------|---------|
| Node.js ≥ 20 | Build and test | [nodejs.org](https://nodejs.org) |
| Vercel CLI | Deploy and manage environments | `npm i -g vercel` |
| Stellar CLI | Contract operations | [Stellar Docs](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| AWS CLI | S3 backup operations | [AWS Docs](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) |
| `gh` CLI | GitHub operations | [cli.github.com](https://cli.github.com) |
| `psql` | Database inspection | Comes with PostgreSQL client |

Verify access to:
- Vercel project (production environment variables, deployments)
- GitHub repository (branch push, PR creation)
- Database host (direct `psql` access or a connection proxy)
- Stellar admin keypair (stored in a hardware wallet or secrets manager — never on disk)
- AWS S3 backup bucket

---

## Initial Production Deployment

Run this checklist for a brand-new production environment. For routine updates see [Rolling Deploy](#rolling-deploy-routine-update).

### 1. Provision infrastructure

- PostgreSQL database (Vercel Postgres, Supabase, Railway, or self-hosted)
- Redis instance (Upstash, Redis Cloud, or self-hosted)
- Vercel project linked to the `JosephOnuh/ajosave` repository

### 2. Set all environment variables in Vercel

```bash
# Authenticate
vercel login

# Add each required variable — run once per variable
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add DATABASE_URL production
vercel env add REDIS_URL production
vercel env add STELLAR_NETWORK production              # mainnet
vercel env add STELLAR_HORIZON_URL production
vercel env add STELLAR_SOROBAN_RPC_URL production
vercel env add STELLAR_SERVER_SECRET_KEY production
vercel env add STELLAR_AJO_CONTRACT_ID production
vercel env add USDC_ISSUER production
vercel env add USDC_ASSET_CODE production
vercel env add PAYSTACK_SECRET_KEY production
vercel env add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY production
vercel env add TERMII_API_KEY production
vercel env add TERMII_SENDER_ID production
vercel env add CRON_SECRET production
```

See `.env.example` for the full list including optional variables (Sentry, Slack, Datadog).

### 3. Apply database migrations

```bash
DATABASE_URL=<prod-url> npm run migrate
```

Verify:
```bash
psql "$DATABASE_URL" -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"
```

### 4. Deploy the Soroban contract to mainnet

```bash
# Build WASM
npm run contract:build

# Deploy to mainnet
STELLAR_NETWORK=mainnet npm run contract:deploy
```

Note the contract ID that is printed. Set it in Vercel:
```bash
vercel env add STELLAR_AJO_CONTRACT_ID production
# enter the contract ID when prompted
```

### 5. Deploy the application

```bash
vercel --prod
```

### 6. Post-deploy smoke test

```bash
# Health check
curl https://ajosave.app/api/health

# Verify cron job appears in Vercel dashboard
# Project → Settings → Cron Jobs → should show /api/cron/cycle hourly
```

---

## Rolling Deploy (Routine Update)

For every merge to `main`, CI automatically runs tests and (on success) triggers a Vercel production deployment. This section covers the manual path and what CI does automatically.

### Automated path (preferred)

1. Open a PR against `main`.
2. CI runs: type-check → lint → unit tests → contract tests → migration smoke test.
3. Merge when all checks pass.
4. Vercel's GitHub integration deploys to production automatically.
5. Monitor the deployment in the Vercel dashboard and check the [status page](https://stats.uptimerobot.com/ajosave).

### Manual deployment

Use this if CI is broken or you need to deploy a hotfix directly.

```bash
# From a clean main branch
git checkout main && git pull

# Run all checks locally first
npm run type-check
npm test
npm run contract:test

# Deploy
vercel --prod
```

### Rolling deploy checklist

- [ ] All CI checks pass
- [ ] No pending database migrations that break backwards compatibility
- [ ] Staging/preview deployment has been reviewed (Vercel preview URL on the PR)
- [ ] If schema changes: migration was applied before new code goes live (see [Database Migrations](#database-migrations))
- [ ] `CHANGELOG.md` updated
- [ ] Git tag created: `git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`

---

## Database Migrations

Ajosave uses [node-pg-migrate](https://salsita.github.io/node-pg-migrate/). Migration files are in `migrations/` and run automatically at startup (via `instrumentation.ts` on Vercel). For details on writing migrations, see [`docs/migrations.md`](./migrations.md).

### Pre-deploy migration (schema-first approach)

When a migration adds a new column or table that the old code can tolerate (NULL-safe), apply it before deploying new code:

```bash
# 1. Take a backup
./scripts/pg_backup.sh

# 2. Apply the migration
DATABASE_URL=<prod-url> npm run migrate

# 3. Verify
psql "$DATABASE_URL" -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"

# 4. Deploy new code
vercel --prod
```

### Post-deploy migration (data migrations)

For migrations that depend on code already being deployed (e.g. backfilling a new column with computed data):

1. Deploy the new code first (with the migration file included but not yet applied automatically — guard with an env flag if needed).
2. Apply the migration:
   ```bash
   DATABASE_URL=<prod-url> npm run migrate
   ```

### Checking migration state

```bash
psql "$DATABASE_URL" -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
```

### Rolling back a migration

> **Always take a backup before rolling back.**

```bash
# 1. Backup
./scripts/pg_backup.sh

# 2. Roll back one step
DATABASE_URL=<prod-url> npm run migrate:down

# 3. Verify schema
psql "$DATABASE_URL" -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"

# 4. Redeploy previous application version
git checkout <previous-tag>
vercel --prod
```

Repeat `migrate:down` for each step you need to roll back.

---

## Emergency Rollback

### Application rollback

```bash
# Option 1: Instant rollback via Vercel dashboard
# Deployments → find last good deployment → "Promote to Production"

# Option 2: Via CLI — list recent deployments and promote
vercel ls --prod
vercel promote <deployment-url>
```

### Full rollback (code + database)

Use this only if a migration caused data corruption.

```bash
# 1. Pause traffic (optional — set maintenance page in Vercel)

# 2. Restore database from backup (see Database Backup and Restore)
export S3_BACKUP_BUCKET=ajosave-db-backups-eu-west-1
export AWS_DEFAULT_REGION=eu-west-1
./scripts/pg_restore.sh backups/postgres/<TIMESTAMP>.sql.gz

# 3. Verify restore
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM circles;"

# 4. Roll back code to the Git tag that matches the backup timestamp
git checkout <matching-tag>
vercel --prod
```

### Contract rollback

If a Soroban contract upgrade is faulty, see [`docs/contract-upgrade.md`](./contract-upgrade.md) for the full procedure including WASM re-upload.

---

## Secret Rotation

Rotate secrets immediately if you suspect a compromise, or on the schedule below (recommended: every 90 days for critical secrets).

### General procedure

1. Generate the new secret (provider-specific — see below).
2. Update the value in Vercel:
   ```bash
   vercel env rm <VARIABLE_NAME> production
   vercel env add <VARIABLE_NAME> production
   # Enter the new value when prompted
   ```
3. Trigger a redeployment so the new value is picked up:
   ```bash
   vercel --prod
   ```
4. Verify the service works with the new secret.
5. Revoke the old secret in the provider dashboard.

### Service-specific steps

#### `NEXTAUTH_SECRET`

```bash
# Generate new secret
openssl rand -base64 32

# Update in Vercel and redeploy
```

> **Note:** Rotating `NEXTAUTH_SECRET` invalidates **all active sessions**. Users will be logged out immediately.

#### `STELLAR_SERVER_SECRET_KEY`

```bash
# Generate new Stellar keypair
stellar keys generate new-server-key --network mainnet

# Fund new account (mainnet — transfer XLM from existing wallet)
# Set up USDC trustline on new account via Stellar Laboratory

# Update in Vercel and redeploy
# OLD keypair: keep funded until all in-flight transactions complete
# Deactivate old keypair by removing its signers after confirming zero pending txns
```

> **Critical:** The server keypair signs every on-chain transaction. Do not deactivate the old keypair until the new one is confirmed working in production.

#### `PAYSTACK_SECRET_KEY`

1. Log in to [Paystack Dashboard](https://dashboard.paystack.com) → Settings → API Keys & Webhooks.
2. Roll the live secret key.
3. Immediately update `PAYSTACK_SECRET_KEY` in Vercel and redeploy.
4. Paystack provides a short grace period where both old and new keys work — redeploy within it.

#### `DATABASE_URL` (password rotation)

1. Rotate the password in your database provider (Supabase dashboard, AWS RDS, etc.).
2. Update `DATABASE_URL` in Vercel with the new password and redeploy.
3. The connection pool reconnects automatically.

> Tip: Use a connection pooler (PgBouncer) in front of your database so password rotation does not require a full restart.

#### `REDIS_URL`

1. Rotate in your Redis provider dashboard.
2. Update `REDIS_URL` in Vercel and redeploy.
3. Any in-flight rate-limit or session data will be lost — acceptable for a brief rotation window.

#### `TERMII_API_KEY`

1. Regenerate in the [Termii Dashboard](https://termii.com) → API Settings.
2. Update in Vercel and redeploy.
3. SMS will fail during the window between rotation and redeployment — schedule during low-traffic hours.

#### `CRON_SECRET`

```bash
# Generate new secret
openssl rand -hex 32

# Update in Vercel and redeploy
# Also update the Authorization header in any external cron scheduler
```

#### `SENTRY_AUTH_TOKEN` / `SLACK_WEBHOOK_URL`

Regenerate in the respective provider dashboard, update in Vercel, and redeploy.

#### CI secrets (GitHub Actions)

For `CODECOV_TOKEN` and `STELLAR_TESTNET_SECRET_KEY`:
1. Repository → Settings → Secrets and variables → Actions.
2. Update the secret value.
3. The next CI run picks up the new value automatically.

---

## Incident Response Checklist

### Severity levels

| Level | Description | Example | Response time |
|-------|-------------|---------|---------------|
| P1 | Production down / all users affected | Health endpoint returning 5xx, payouts failing | Immediate |
| P2 | Partial outage / feature degraded | SMS not sending, Stellar tx timeouts | < 1 hour |
| P3 | Minor issue / workaround available | Slow queries, non-critical errors | < 24 hours |

### P1 Incident Response

```
1. DETECT
   [ ] Confirm via status page: https://stats.uptimerobot.com/ajosave
   [ ] Check Sentry for error spikes
   [ ] Check Vercel deployment logs: `vercel logs --prod`
   [ ] Check Slack #alerts channel

2. COMMUNICATE
   [ ] Post in #incidents: "Investigating [issue description] — ETA unknown"
   [ ] If payout-related: notify affected circle admins

3. ASSESS
   [ ] Is this a code regression? → Check recent deployments in Vercel dashboard
   [ ] Is this a database issue? → Check DB connection, run health query:
       psql "$DATABASE_URL" -c "SELECT 1;"
   [ ] Is this a Stellar/Soroban issue? → Check Stellar network status:
       https://status.stellar.org
   [ ] Is this a Paystack issue? → Check https://status.paystack.com

4. CONTAIN
   [ ] If regression: roll back (see Emergency Rollback above)
   [ ] If DB overload: scale up or reduce pool size
   [ ] If active payout at risk: pause the contract:
       stellar contract invoke --id $CONTRACT_ID --network mainnet \
         --source $ADMIN_SECRET -- pause
   [ ] If secrets compromised: rotate immediately (see Secret Rotation above)

5. RESOLVE
   [ ] Deploy fix or rollback
   [ ] Verify health endpoint: curl https://ajosave.app/api/health
   [ ] Verify payout cron is running: check Vercel Cron Jobs dashboard
   [ ] Unpause contract if paused:
       stellar contract invoke --id $CONTRACT_ID --network mainnet \
         --source $ADMIN_SECRET -- unpause

6. POST-MORTEM
   [ ] Document timeline, root cause, and remediation
   [ ] Open GitHub issue with label "incident" if not already tracked
   [ ] Update runbook with any missing steps discovered
```

### Common failure modes

| Symptom | Likely cause | Quick fix |
|---------|-------------|-----------|
| Health endpoint 500 | DB connection failure | Check `DATABASE_URL`, verify DB is up |
| Payouts not triggering | Cron not running | Vercel dashboard → Cron Jobs → trigger manually |
| SMS not sending | Termii key expired or rate-limited | Check Termii dashboard, rotate key if needed |
| Stellar txn timeout | Network congestion or stale fee | Check `https://horizon.stellar.org/fee_stats`, retry |
| NGN payments failing | Paystack key invalid | Rotate `PAYSTACK_SECRET_KEY` |
| Login loop | `NEXTAUTH_SECRET` mismatch | Verify env var matches deployed value |
| High DB connections | Pool exhausted | Reduce `DB_POOL_SIZE` or scale DB |

---

## Database Backup and Restore

For full details see [`docs/backup.md`](./backup.md). This section provides quick-reference commands.

### Manual backup

```bash
export DATABASE_URL=<prod-url>
export S3_BACKUP_BUCKET=ajosave-db-backups-eu-west-1
export AWS_DEFAULT_REGION=eu-west-1

./scripts/pg_backup.sh
```

Backups are stored at `s3://$S3_BACKUP_BUCKET/backups/postgres/<TIMESTAMP>.sql.gz`.

### List available backups

```bash
aws s3 ls s3://ajosave-db-backups-eu-west-1/backups/postgres/ --recursive
```

### Restore from backup

> **Warning:** The restore script drops and recreates the target database. Ensure the application is not writing during the restore window (take it offline or redirect traffic).

```bash
export DATABASE_URL=<prod-url>
export S3_BACKUP_BUCKET=ajosave-db-backups-eu-west-1
export AWS_DEFAULT_REGION=eu-west-1

./scripts/pg_restore.sh backups/postgres/<TIMESTAMP>.sql.gz
```

The script shows a 5-second abort window. After restore:

```bash
# Verify row counts match expectations
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM circles;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM members;"

# Confirm latest migration is applied
psql "$DATABASE_URL" -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 3;"
```

### Automated backups

GitHub Actions runs a daily backup at **02:00 UTC** via `.github/workflows/backup.yml`. Backups are retained for 30 days. Configure the following GitHub Actions secrets to keep it running:

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | Production connection string |
| `AWS_ACCESS_KEY_ID` | IAM key with S3 read/write |
| `AWS_SECRET_ACCESS_KEY` | Corresponding IAM secret |
| `AWS_BACKUP_REGION` | S3 bucket region |
| `S3_BACKUP_BUCKET` | Bucket name |

---

## Contacts and Escalation

| Role | Responsibility | Contact |
|------|---------------|---------|
| On-call engineer | P1/P2 response, deployments | See team roster |
| Stellar network issues | Soroban/Horizon status | [status.stellar.org](https://status.stellar.org) / [Stellar Discord](https://discord.gg/stellardev) |
| Paystack issues | Payment processing | [Paystack support](https://paystack.com/support) |
| Termii issues | SMS delivery | [Termii support](https://termii.com) |
| Security incidents | Credential exposure, data breach | security@ajosave.app |

---

## Related Documentation

- [`docs/contract-upgrade.md`](./contract-upgrade.md) — Soroban contract upgrade procedure
- [`docs/migrations.md`](./migrations.md) — Database migration details
- [`docs/backup.md`](./backup.md) — Backup setup and S3 configuration
- [`docs/secrets-security.md`](./secrets-security.md) — Secret inventory and storage policy
- [`docs/multisig-admin.md`](./multisig-admin.md) — Admin key management
- [`docs/vercel-setup.md`](./vercel-setup.md) — Vercel environment variable reference
- [`docs/DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — Full deployment guide
