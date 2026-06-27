# ADR-0004: PostgreSQL as the Primary Database

**Date:** 2024-01-01  
**Status:** Accepted

## Context

Ajosave needs persistent storage for circle metadata, member rosters, contribution history, and payout schedules. The data is relational (circles → members → contributions) and requires transactional integrity (e.g., marking a contribution paid and scheduling the on-chain call atomically). Options considered:

- **PostgreSQL** — mature relational database with strong ACID guarantees, JSON support for flexible fields, and a wide hosting ecosystem.
- **MongoDB** — flexible document model but weaker transactional guarantees across collections; better suited for unstructured data.
- **PlanetScale (MySQL)** — serverless MySQL with branching, but lacks some Postgres features (e.g., partial indexes, advisory locks) needed for scheduling.

## Decision

Use PostgreSQL as the sole persistent store. Redis is used as an ephemeral cache and job queue but holds no source-of-truth data.

## Consequences

- **Positive:** ACID transactions ensure contribution and payout state are always consistent; rich query capability for analytics and reporting; large ecosystem of managed hosting options (Supabase, Neon, RDS).
- **Negative:** Schema migrations require care in production; vertical scaling is the default path (though read replicas can be added); operational overhead compared to fully managed NoSQL options.
