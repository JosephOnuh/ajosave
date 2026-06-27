# Secret Management & Key Rotation

This document covers how Ajosave handles API secrets and how to rotate them safely.

## Smile Identity API Key

### Storage options (in priority order)

| Method | Variable | When to use |
|--------|----------|-------------|
| AWS Secrets Manager | `SMILE_API_KEY_SECRET_ARN` | Production (recommended) |
| Environment variable | `SMILE_API_KEY` | Local dev / CI |

Set **one** of these in your environment. `SMILE_API_KEY_SECRET_ARN` takes precedence.

### AWS Secrets Manager setup

1. Create a secret with the raw key as the secret value (plain string, not JSON):
   ```bash
   aws secretsmanager create-secret \
     --name ajosave/smile-api-key \
     --secret-string "your-smile-api-key"
   ```

2. Grant your app's IAM role read access:
   ```json
   {
     "Effect": "Allow",
     "Action": "secretsmanager:GetSecretValue",
     "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:ajosave/smile-api-key-*"
   }
   ```

3. Set the ARN in your environment:
   ```
   SMILE_API_KEY_SECRET_ARN=arn:aws:secretsmanager:<region>:<account>:secret:ajosave/smile-api-key-XXXXXX
   ```

### Key rotation procedure

1. **Generate a new key** in the [Smile Identity portal](https://portal.smileidentity.com) → Settings → API Keys.

2. **Update the secret** (zero-downtime: update the secret value, not the ARN):
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id ajosave/smile-api-key \
     --secret-string "your-new-smile-api-key"
   ```
   The next request will automatically fetch the new value — no redeploy needed.

3. **If using env var**: update `SMILE_API_KEY` in your deployment environment and redeploy.

4. **Revoke the old key** in the Smile Identity portal once you've confirmed the new key works.

5. **Verify** that KYC flows and webhook signature checks still succeed after rotation.

## Log sanitization

The `api_key` field is blocked from ever appearing in application logs by two layers:

- **pino redact config** (`src/lib/logger.ts`): strips `api_key` (and `password`, `secret`, `authorization`, `token`) at the serialisation layer.
- **`redactKey()` helper** (`src/lib/kyc.ts`): replaces the key value with `[REDACTED]` in any error messages thrown from KYC functions.

## Other secrets

| Secret | Variable | Rotation notes |
|--------|----------|----------------|
| Paystack | `PAYSTACK_SECRET_KEY` | Regenerate in Paystack Dashboard → rotate env var |
| Stellar server key | `STELLAR_SERVER_SECRET_KEY` | Generate new keypair → fund → update env var |
| NextAuth | `NEXTAUTH_SECRET` | Update env var → all existing sessions invalidated |
| Cron token | `CRON_SECRET` | Update env var → update any cron scheduler config |

> **Security issues**: report to **security@ajosave.app** — do not open a public issue.
