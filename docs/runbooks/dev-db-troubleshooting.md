# Dev DB troubleshooting

> **Status: scaffold.** This runbook is being authored as part of PRO-181 ([Linear](https://linear.app/project-arklight/issue/PRO-181)). The sections below outline the structure; content lands during Step 6 of the PRO-181 execution sequence (see PR description).

## Setup

`DATABASE_URL` vs `DIRECT_URL` — when to use each, which Neon endpoint goes where. Drop the `-pooler` suffix for the direct URL.

*(TODO: fill during PRO-181 execution.)*

## If `prisma migrate dev` fails

Baseline migration as the floor. If shadow-DB replay fails, regenerate the baseline.

*(TODO: fill during PRO-181 execution.)*

## If `_prisma_migrations` rows desync

`migrate resolve --applied` pattern. When to use; why; when NOT to use it (anything more invasive than tracker reconciliation needs a Neon snapshot first).

*(TODO: fill during PRO-181 execution.)*
