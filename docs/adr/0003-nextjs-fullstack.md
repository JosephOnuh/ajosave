# ADR-0003: Next.js as the Full-Stack Framework

**Date:** 2024-01-01  
**Status:** Accepted

## Context

The product needs a public marketing site, an authenticated dashboard, and server-side API logic (Paystack webhooks, cron-based payout triggers, database access). Options considered:

- **Next.js (App Router)** — collocates frontend and backend; API Route Handlers and Server Actions reduce infrastructure surface area; strong TypeScript support.
- **Separate React SPA + Express API** — standard separation of concerns but doubles deployment complexity (two services, two CI pipelines).
- **Remix** — similar full-stack model but smaller ecosystem and less mature hosting support at time of decision.

## Decision

Use Next.js 14 with the App Router. API Route Handlers serve as the backend (auth, circles CRUD, webhooks, cron). A `server/` services layer encapsulates business logic, keeping route handlers thin.

## Consequences

- **Positive:** Single deployable unit; shared TypeScript types across frontend and backend; built-in image optimisation, caching, and SSR reduce infrastructure overhead.
- **Negative:** Mixing frontend and backend in one repo can blur boundaries as the codebase grows; App Router is still maturing (edge cases in caching and streaming); long-running cron jobs are awkward in a serverless Next.js deployment.
