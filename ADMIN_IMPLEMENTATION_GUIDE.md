# Admin Implementation Guide

This document covers everything needed to operate and extend the Ajosave admin panel: API endpoints, role assignment, UI components, environment variables, and common workflows.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Admin Role Assignment](#admin-role-assignment)
3. [Authentication & Authorization](#authentication--authorization)
4. [Admin API Endpoints](#admin-api-endpoints)
5. [User Management](#user-management)
6. [Circle Oversight](#circle-oversight)
7. [Dispute Resolution](#dispute-resolution)
8. [Audit Logs](#audit-logs)
9. [Analytics Dashboard](#analytics-dashboard)
10. [Admin UI Components](#admin-ui-components)
11. [Admin-Only Environment Variables](#admin-only-environment-variables)
12. [Local Development Setup](#local-development-setup)

---

## Architecture Overview

```
Browser (Admin)
      │
      ▼
/app/admin                    ← Next.js admin page (role-gated)
      │
      ▼
/api/admin/*                  ← Next.js Route Handlers
      │
      ├── withAdminAuth()     ← Middleware: verifies session + role='admin'
      │
      ▼
src/server/services/
  ├── admin.service.ts        ← Circle/payout admin queries
  ├── dispute.service.ts      ← Dispute resolution logic
  ├── audit.service.ts        ← Audit log reads/writes
  └── analytics.service.ts   ← Daily + per-circle analytics

      │
      ▼
PostgreSQL (users, circles, members, payouts, disputes, audit_logs)
```

All admin API routes are protected by `withAdminAuth()` middleware, which verifies a valid NextAuth session where `user.role === 'admin'`.

---

## Admin Role Assignment

Admin roles are stored in the `users.role` column (PostgreSQL). The default role for new users is `'user'`.

### Promote a user to admin

Connect to the production database and run:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+2348012345678';
```

### Verify the role

```sql
SELECT id, phone, display_name, role FROM users WHERE role = 'admin';
```

### Revoke admin access

```sql
UPDATE users SET role = 'user' WHERE phone = '+2348012345678';
```

> **Security note:** There is no admin self-service registration. Role assignment is always done directly in the database by a superadmin or via a migration script. Never expose a role-assignment API endpoint publicly.

### How the role is loaded

On login (`src/lib/auth.ts`), the `jwt` callback reads `role` from the `users` table and stores it in the JWT token:

```ts
token.role = user.role ?? 'user';
```

The `session` callback then exposes it as `session.user.role`, which is checked in all admin middleware.

---

## Authentication & Authorization

### `withAdminAuth` middleware

Located at `src/server/middleware/`, this wrapper:

1. Calls `getServerSession(authOptions)` to verify the session
2. Returns `401 Unauthorized` if no session exists
3. Returns `403 Forbidden` if `session.user.role !== 'admin'`
4. Passes the request to the handler if the check passes

**Usage in route handlers:**

```ts
export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    // handler runs only for authenticated admins
  })
);
```

---

## Admin API Endpoints

All endpoints require a valid admin session cookie (set by NextAuth). There are no API keys for admin routes — authentication is session-based.

### Circles

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/circles` | List all circles with member counts |
| `GET` | `/api/admin/circles?includeDeleted=true` | Include soft-deleted circles |
| `GET` | `/api/admin/circles/deleted` | List only soft-deleted circles |
| `DELETE` | `/api/admin/circles/[id]` | Soft-delete a circle by ID |

**Example — list all circles:**

```bash
curl -b 'next-auth.session-token=...' \
  https://yourdomain.com/api/admin/circles
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Lagos Savings Group",
      "status": "active",
      "maxMembers": 5,
      "memberCount": 4,
      "currentCycle": 2,
      "nextPayoutAt": "2024-07-01T02:00:00Z"
    }
  ]
}
```

---

### Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `DELETE` | `/api/admin/users/[id]` | Soft-delete a user |

**Soft-delete a user:**

```bash
curl -X DELETE -b 'next-auth.session-token=...' \
  https://yourdomain.com/api/admin/users/USER_UUID
```

---

### Disputes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/disputes` | Resolve or reject a dispute |

**Request body:**

```json
{
  "disputeId": "uuid",
  "status": "resolved",
  "resolutionNotes": "Contribution verified on-chain via txHash",
  "txHash": "abc123...",
  "contributionId": "uuid"
}
```

- `status`: `"resolved"` or `"rejected"`
- `txHash` + `contributionId`: required only when `status === "resolved"` to confirm the on-chain contribution
- `resolutionNotes`: min 5 chars, max 500 chars

---

### Payouts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/payouts` | List all payouts with circle name and recipient user ID |

---

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/analytics` | Daily analytics + per-circle analytics |
| `GET` | `/api/admin/analytics/export` | Export analytics data (CSV) |

**Response shape:**

```json
{
  "success": true,
  "data": {
    "dailyAnalytics": [ { "date": "2024-06-01", "newUsers": 12, "newCircles": 3, ... } ],
    "circleAnalytics": [ { "circleId": "uuid", "name": "...", "totalContributions": 50000 } ]
  }
}
```

---

### Audit Logs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/audit-logs` | Paginated audit log with filters |

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `actorId` | UUID | Filter by admin who performed the action |
| `action` | string | `TRIGGER_PAYOUT`, `REMOVE_MEMBER`, `DELETE_USER`, `RESOLVE_DISPUTE`, etc. |
| `targetType` | string | `CIRCLE`, `MEMBER`, `USER`, `PAYOUT` |
| `targetId` | UUID | ID of the target entity |
| `startDate` | ISO 8601 | Filter from date |
| `endDate` | ISO 8601 | Filter to date |
| `limit` | number | Results per page (default: 100, max: 1000) |
| `offset` | number | Pagination offset (default: 0) |

**Example:**

```bash
curl -b 'next-auth.session-token=...' \
  'https://yourdomain.com/api/admin/audit-logs?action=RESOLVE_DISPUTE&limit=20'
```

---

### Horizon Stream

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/horizon-stream` | SSE stream of live Stellar Horizon events |

This endpoint proxies Stellar Horizon's SSE stream for real-time on-chain event monitoring.

---

## User Management

From the admin panel, administrators can:

- **View all users** — list with phone, display name, role, reputation score, creation date
- **Soft-delete users** — sets `deleted_at` timestamp; the user can no longer log in or join circles
- **Filter by role** — separate view of admin vs regular users

Soft-deleted users are excluded from all public queries but remain in the database for audit purposes.

---

## Circle Oversight

Admins can view all circles regardless of status, including:

- **Active circles** — in-progress savings rounds
- **Completed circles** — finished payout cycles
- **Paused circles** — temporarily halted (contract-level pause)
- **Soft-deleted circles** — removed from public listings

Key fields visible to admins (not exposed to regular users):

- `memberCount` — real-time member count
- `contractId` — deployed Soroban contract address
- `creatorId` — UUID of the circle creator
- `deletedAt` — soft-delete timestamp

To restore a soft-deleted circle (database only):

```sql
UPDATE circles SET deleted_at = NULL WHERE id = 'CIRCLE_UUID';
```

---

## Dispute Resolution

### Workflow

```
Member raises dispute (UI)
       │
       ▼
disputes table: status = 'open'
       │
       ▼
Admin reviews via /api/admin/disputes (POST)
       │
       ├── status = 'resolved' + txHash provided
       │       └── contribution confirmed on-chain
       │               └── dispute.status = 'resolved'
       │
       └── status = 'rejected'
               └── dispute.status = 'rejected'
```

### Service functions (`dispute.service.ts`)

- `resolveDispute(disputeId, status, notes, adminId)` — updates `disputes.status` and logs to audit table
- `confirmContributionFromDispute(disputeId, contributionId, txHash)` — marks the contribution as confirmed with the provided Stellar tx hash

### Required fields for resolution

When resolving a dispute where the contribution happened on-chain but wasn't tracked in DB, provide:
- `txHash`: The Stellar transaction hash
- `contributionId`: The UUID of the pending contribution record to confirm

---

## Audit Logs

Every admin action is written to the `audit_logs` table via `src/server/services/audit.service.ts`.

### Schema (relevant columns)

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tracked actions

| Action | Triggered by |
|--------|-------------|
| `TRIGGER_PAYOUT` | Admin triggers payout |
| `REMOVE_MEMBER` | Admin removes member from circle |
| `DELETE_USER` | Admin soft-deletes a user |
| `RESOLVE_DISPUTE` | Admin resolves a dispute |
| `REJECT_DISPUTE` | Admin rejects a dispute |
| `PAUSE_CIRCLE` | Admin pauses a circle |
| `UNPAUSE_CIRCLE` | Admin unpauses a circle |

### Querying audit logs

```ts
import { getAuditLogs } from '@/server/services/audit.service';

const logs = await getAuditLogs({
  action: 'RESOLVE_DISPUTE',
  startDate: new Date('2024-01-01'),
  limit: 50,
  offset: 0,
});
```

---

## Analytics Dashboard

The `AnalyticsDashboard` component (`src/components/admin/AnalyticsDashboard.tsx`) displays:

- **Daily metrics** — new users, new circles, contributions, payout volume over time
- **Per-circle analytics** — contribution rates, payout history, member counts per circle
- **Export** — CSV export via `/api/admin/analytics/export`

The dashboard polls `/api/admin/analytics` every 30 seconds to keep metrics fresh.

### AdminDashboard tabs

| Tab | Component | Data source |
|-----|-----------|-------------|
| Circles | `CirclesTable` | `GET /api/admin/circles` |
| Payouts | `PayoutsTable` | `GET /api/admin/payouts` |
| Analytics | `AnalyticsDashboard` | `GET /api/admin/analytics` |

The main `AdminDashboard` component polls circles and payouts every 5 seconds using the `usePolling` hook and shows a `ConnectionStatus` indicator.

---

## Admin UI Components

All admin components live in `src/components/admin/`.

| Component | File | Description |
|-----------|------|-------------|
| `AdminDashboard` | `AdminDashboard.tsx` | Root dashboard with tab navigation, polling, connection status |
| `CirclesTable` | `CirclesTable.tsx` | Sortable table of all circles with status badges |
| `PayoutsTable` | `PayoutsTable.tsx` | List of all payouts with circle name and recipient |
| `AnalyticsDashboard` | `AnalyticsDashboard.tsx` | Charts and metrics for platform-wide analytics |
| `DisputeList` | `DisputeList.tsx` | List of open/resolved disputes with resolve action |

### Accessing the admin panel

Navigate to `/admin` when logged in as an admin. Non-admin users are redirected to `/dashboard`.

---

## Admin-Only Environment Variables

The following environment variables are required for admin and monitoring features:

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | Yes | Bearer token for authenticating `/api/cron/*` endpoints. Generate with `openssl rand -hex 32` |
| `SLACK_WEBHOOK_URL` | Optional | Slack incoming webhook URL for critical alerts (backup failures, restore failures) |
| `AWS_ACCESS_KEY_ID` | Yes (backup) | AWS credentials for S3 backup access |
| `AWS_SECRET_ACCESS_KEY` | Yes (backup) | AWS secret for S3 backup access |
| `AWS_BACKUP_REGION` | Yes (backup) | AWS region for the backup S3 bucket |
| `S3_BACKUP_BUCKET` | Yes (backup) | S3 bucket name for database backups |
| `BACKUP_RETENTION_DAYS` | Optional | Days to retain backups (default: 30) |

> All environment variables should be set in the `production` GitHub Actions environment for CI workflows, and in `.env.local` for local development (never commit this file).

---

## Local Development Setup

1. **Set up the database with an admin user:**

   ```bash
   npm run migrate
   ```

   Then in psql:

   ```sql
   UPDATE users SET role = 'admin' WHERE phone = '+2348000000000';
   ```

2. **Start the dev server:**

   ```bash
   npm run dev
   ```

3. **Access the admin panel:**

   Navigate to `http://localhost:3000/admin` after logging in with the admin phone number.

4. **Test admin API endpoints locally:**

   ```bash
   # Get session cookie from browser DevTools → Application → Cookies
   curl -b 'next-auth.session-token=YOUR_TOKEN' \
     http://localhost:3000/api/admin/circles
   ```

5. **Simulate an audit log entry in tests:**

   ```ts
   import { logAuditEvent } from '@/server/services/audit.service';

   await logAuditEvent({
     actorId: adminUserId,
     action: 'DELETE_USER',
     targetType: 'USER',
     targetId: targetUserId,
     metadata: { reason: 'test' },
   });
   ```
