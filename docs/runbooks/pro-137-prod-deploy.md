# PRO-137 — Prod-deploy runbook

Concrete, copy-pasteable procedure for deploying PRO-137 (Under-Leverage Score) to production. Manual gates by design — the deployer is the human checkpoint.

## When to run

Before `vercel --prod` (or the equivalent release step) for any release that includes either PR#1 (`feat/pro-137-schema-and-compute`) or PR#2 (`feat/pro-137-ui`).

**Schema shipped:**
- New `EmployeeInsights` table (PR#1) — one row per converted employee assessment, derived insight scores
- Columns: `id`, `assessmentId` (FK to Assessment, UNIQUE, ON DELETE CASCADE), `underLeverageScore` (Int, nullable), `orgId`, `roleFamily`, `profileId`, `profileUpdatedAt`, `createdAt`, `updatedAt`
- Indexes: `EmployeeInsights_assessmentId_key` (unique), `EmployeeInsights_orgId_roleFamily_idx`, `EmployeeInsights_orgId_underLeverageScore_idx`

…and code that reads/writes the new table. Migrating the schema before deploying the code is non-negotiable — old code is forward-compatible (no existing code references the table), but new code crashes against the old schema.

**No backfill** — rows are created lazily at first touch (conversion, profile save batch invalidation, or dossier read). Pre-PRO-137 EMPLOYEE assessments show `—` in the People Table until they're individually viewed or a matching profile gets saved. This is documented in the PR description as a known gap.

## Prerequisites

- `DATABASE_URL` exported in your shell, pointing at the **production** Neon DB
- Neon DB accessible from your environment (VPN if required)
- Production DB snapshot taken (or confirmed available via Neon's continuous backup)
- The PR#1 branch (`feat/pro-137-schema-and-compute`) or merged-to-main checked out locally

**Before running any step below:**

```bash
echo $DATABASE_URL
```

**Confirm the host matches your prod database — not dev, not staging.** Every command operates against whichever DB the variable points to. A `DATABASE_URL=$DEV_URL` typo runs against dev and "deploys" against prod with stale information. Cheap to verify, expensive to recover from.

---

## Step 1 — Check prod migration tracking status

```bash
DATABASE_URL=$PROD_URL npx prisma migrate status
```

- **If clean** (every migration in `prisma/migrations/` is "Applied"): proceed to Step 2.
- **If drift** (prod schema applied migrations not tracked in `_prisma_migrations`): for each orphan migration named in the output, run:

  ```bash
  DATABASE_URL=$PROD_URL npx prisma migrate resolve --applied <migration_name>
  ```

  This marks the migration as "Applied" in `_prisma_migrations` without re-running its SQL. Repeat per orphan. Then re-run `migrate status` and verify clean before proceeding.

PRO-181 tracks the recurring shadow-DB drift pattern. If the drift situation looks unfamiliar or you're unsure which migrations are safe to mark as applied, stop and investigate — `migrate resolve --applied` on a migration that hasn't actually been applied at the schema level would silently desync state.

---

## Step 2 — Apply the migration

```bash
DATABASE_URL=$PROD_URL npx prisma migrate deploy
```

Applies pending PRO-137 migration:
- `20260512_pro_137_employee_insights`

Step 1 confirmed everything else is tracked. Output should report 1 migration applied.

**If you hit shadow-DB drift errors and have to fall back to `db execute`:**

```bash
DATABASE_URL=$PROD_URL npx prisma db execute --file prisma/migrations/20260512_pro_137_employee_insights/migration.sql
DATABASE_URL=$PROD_URL npx prisma migrate resolve --applied 20260512_pro_137_employee_insights
```

PRO-181 still tracks the root cause. Once that ticket ships, the fallback is no longer needed.

---

## Step 3 — Post-deploy schema verification

```bash
DATABASE_URL=$PROD_URL npx tsx scripts/verify-pro-137-schema.ts
```

**Hard gate.** The script exits non-zero on any discrepancy. Expected output ends with:

```
✅ PRO-137 schema verification PASSED
```

The script checks: table exists, all 9 columns with correct type + nullability, 3 indexes, FK with `ON DELETE CASCADE`.

If verification fails: STOP. Investigate the migration state. Do NOT proceed to Step 4. The app code expects the table to exist; deploying it against a missing schema is unsafe.

---

## Step 4 — Deploy app code

```bash
vercel --prod
```

(Or whatever your release flow is.) The app code now writes to the new table at the three invalidation trigger sites:
- Conversion (inline in the convert transaction)
- Role-demand profile save (batch UPDATE to mark stale)
- Re-assessment via the scoring pipeline (post-transaction recompute)

---

## Step 5 — Smoke test the deploy (manual)

In a browser logged in as an admin:

1. Convert an existing candidate to employee with a roleFamily that has an active demand profile in that org
2. Confirm an `EmployeeInsights` row exists for the new employee (via DB query or PR#2's UI once merged):
   ```sql
   SELECT * FROM "EmployeeInsights"
   WHERE "assessmentId" = '<the assessment id>'
   ```
3. Edit the role-demand profile for that roleFamily. Confirm `EmployeeInsights.profileUpdatedAt` and `profileId` are NULL for affected rows in the same org:
   ```sql
   SELECT "assessmentId", "profileUpdatedAt", "profileId" FROM "EmployeeInsights"
   WHERE "orgId" = '<org id>' AND LOWER("roleFamily") = LOWER('<role family>')
   ```

PR#2 (UI) provides the visual smoke path — dossier headline + People Table chip. PR#1 alone is invisible from the UI; the schema + write paths are tested via the integration tests in `npx vitest run src/app/api/`.

---

## Rollback procedure

If anything fails post-deploy:

### Code rollback

```bash
vercel rollback
```

(Or use the Vercel dashboard.) Reverts the app code without touching the database. The `EmployeeInsights` table stays in place — old code doesn't reference it, so no functional break.

### Schema rollback

NOT automatic. The new table is additive (no FK from existing tables points at it), so leaving it in place is safe even with the old app code. If you must remove it:

```sql
DROP TABLE "EmployeeInsights";
```

Cascade rules already handle FK cleanup — the table cascades from Assessment, nothing cascades into the table.

Also remove the migration tracking row:

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260512_pro_137_employee_insights';
```

### Deploy-window caveat

If **Step 2 succeeds but Step 4 fails or rolls back**, prod has the new table with the old code. Old code doesn't write to or read from `EmployeeInsights`, so the table stays empty. No functional impact; no data correction needed.

---

## Post-deploy follow-ups

- **Backfill consideration**: pre-PRO-137 EMPLOYEE assessments have no `EmployeeInsights` row until lazy-touched. People Table shows `—` for them. If immediate backfill is desired, file a one-shot script ticket; not required for PRO-137 acceptance.
- **PRO-138 / PRO-139**: these tickets add sibling `Int?` columns on `EmployeeInsights`. The pattern is established — each ticket adds a column-only migration, not a new table.
